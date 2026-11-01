import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, serializeBackup } from './backup/backup';
import { getDish } from './cafeteria/dishes';
import { parseMenu } from './cafeteria/parser';
import { evaluateDishAt, evaluateTray, portionFor } from './cafeteria/tray';
import { getFood } from './food/catalog';
import type { CookingContext } from './food/types';
import { migrateLog, mergeProfile } from './log/migrate';
import { emptyLog, type DailyHealthLog } from './log/types';
import { dinnerCutoff, isHomeDay, recommendMeal } from './meal/recommend';
import { DRUG_FOOD_RULES, DRUGS, drugNotesFor, matchDrug, medAdvisories, resolveMedication, separationHold, UNKNOWN_DRUG_ADVICE } from './medication/drugs';
import { effectiveMedTimes, medWindows } from './medication/safeguard';
import { finishWaiting, startFunnel } from './night/funnel';
import { DEFAULT_PROFILE, withConstitution } from './profile/defaults';
import type { UserProfile } from './profile/types';
import { buildIcs, foldLine } from './reminders/ics';
import { dailyReminders } from './reminders/schedule';
import { scoreDish } from './scoring/dish';
import { scoreFood } from './scoring/engine';
import { toMinutes } from './shared/time';

const P = DEFAULT_PROFILE;
const ctx = (method: CookingContext['method'] = 'AS_IS', warmSeasoning = false, servingTemp: CookingContext['servingTemp'] = 'HOT'): CookingContext => ({ method, warmSeasoning, servingTemp });
const withMeds = (...meds: ReturnType<typeof resolveMedication>[]): UserProfile => ({ ...P, autonomicStatus: { ...P.autonomicStatus, medications: meds } });
const relaxed: UserProfile = { ...P, autonomicStatus: { ...P.autonomicStatus, takingWesternMeds: false, parasympatheticLow: false } };

describe('AT-11 D3 카페인·자몽은 조건이 꺼지면 차단이 아니라 주의', () => {
  it('양약·부교감 저하가 없으면 커피·녹차는 주의', () => {
    for (const id of ['coffee', 'green_tea']) {
      const r = scoreFood(getFood(id), ctx(), relaxed);
      expect(r.blocked, id).toBe(false);
      expect(r.verdict, id).toBe('CAUTION');
    }
  });
  it('양약이 없어도 부교감 저하면 카페인은 차단', () => {
    expect(scoreFood(getFood('coffee'), ctx(), { ...relaxed, autonomicStatus: { ...relaxed.autonomicStatus, parasympatheticLow: true } }).verdict).toBe('BLOCKED');
  });
  it('자몽은 양약을 먹을 때만 차단, 아니면 주의', () => {
    expect(scoreFood(getFood('grapefruit'), ctx('AS_IS', false, 'ROOM'), P).verdict).toBe('BLOCKED');
    expect(scoreFood(getFood('grapefruit'), ctx('AS_IS', false, 'ROOM'), relaxed).verdict).toBe('CAUTION');
  });
});

describe('AT-13/14 D4 김치', () => {
  it('기체증 소음인: 배추김치·깍두기는 조금만', () => {
    expect(scoreDish(getDish('kimchi_napa'), P).verdict).toBe('LITTLE');
    expect(scoreDish(getDish('kimchi_radish'), P).verdict).toBe('LITTLE');
  });
  it('신김치·묵은지·동치미는 거르기', () => {
    const m = parseMenu('신김치, 묵은지, 동치미');
    expect(m.items.map((i) => i.dish.id)).toEqual(['kimchi_sour', 'kimchi_sour', 'kimchi_sour']);
    for (const i of m.items) expect(scoreDish(i.dish, P).verdict).toBe('SKIP');
  });
  it('허한증으로 바뀌면 김치 고정이 풀리고 점수로 판정', () => {
    const r = scoreDish(getDish('kimchi_napa'), { ...P, subCondition: 'COLD_DEFICIENCY' });
    expect(r.hits.some((h) => h.ruleId === 'D4')).toBe(false);
  });
  it('식판에서 김치 판정 근거에 D4가 보인다', () => {
    const t = evaluateTray({ menuText: '배추김치, 신김치', meal: 'LUNCH', profile: P });
    expect(t.items.map((i) => i.final)).toEqual(['LITTLE', 'SKIP']);
    expect(t.items[0]!.result.hits.some((h) => h.ruleId === 'D4')).toBe(true);
  });
});

describe('AT-23/24/25 D5 약물 사전', () => {
  it('약 이름(상품명·성분명·공백·괄호)을 사전과 연결', () => {
    expect(matchDrug('렉사프로')?.id).toBe('escitalopram');
    expect(matchDrug('Lexapro 10mg')?.id).toBe('escitalopram');
    expect(matchDrug('알프라졸람 (자낙스)')?.id).toBe('alprazolam');
    expect(matchDrug('인데놀')?.id).toBe('propranolol');
    expect(matchDrug('처음 보는 약')).toBeNull();
  });

  it('AT-23 차단 규칙: 알프라졸람 + 술은 차단되고 출처가 따라온다', () => {
    const p = withMeds(resolveMedication('자낙스', ['21:30']));
    const r = scoreFood(getFood('alcohol'), ctx('AS_IS', false, 'ROOM'), p);
    expect(r.verdict).toBe('BLOCKED');
    expect(r.hits.some((h) => h.ruleId === 'G-DRUG' && h.block)).toBe(true);
    expect(r.drugNotes[0]!.source.length).toBeGreaterThan(0);
  });

  it('AT-23 주의 규칙: 서트랄린 + 술은 주의', () => {
    const p = withMeds(resolveMedication('졸로푸트', ['08:30']));
    expect(scoreFood(getFood('alcohol'), ctx('AS_IS', false, 'ROOM'), p).verdict).toBe('CAUTION');
  });

  it('AT-23 감초차는 이뇨제와 함께면 주의', () => {
    const p = withMeds(resolveMedication('라식스', ['08:30']));
    const r = scoreFood(getFood('licorice_tea'), ctx('AS_IS', false, 'HOT'), p);
    expect(r.verdict).toBe('CAUTION');
    expect(r.drugNotes[0]!.ingredient).toBe('푸로세미드');
  });

  it('AT-23 간격 규칙(SEPARATE): 복약 전후 n분이면 보류, 지나면 허용', () => {
    const rules = [{ drugId: 'fluvoxamine', target: 'HERBAL_TEA' as const, rule: 'SEPARATE' as const, separateMinutes: 120, reason: '테스트', source: '테스트', verified: true }];
    const p = withMeds(resolveMedication('듀미록스', ['08:30']));
    const tea = getFood('jinpi_tea');
    const held = separationHold(p, tea, toMinutes('09:30'), rules, DRUGS);
    expect(held.allowed).toBe(false);
    expect(held.nextAllowedAt).toBe('10:31');
    expect(separationHold(p, tea, toMinutes('11:00'), rules, DRUGS).allowed).toBe(true);
    expect(separationHold(p, getFood('rice'), toMinutes('09:30'), rules, DRUGS).allowed).toBe(true);
  });

  it('AT-24 사전에 없는 약: 일반 규칙 + 약사 확인 안내', () => {
    const p = withMeds(resolveMedication('희귀약X', ['09:00']));
    expect(p.autonomicStatus.medications[0]!.drugId).toBeNull();
    expect(medAdvisories(p)).toEqual([`희귀약X: ${UNKNOWN_DRUG_ADVICE}`]);
    expect(UNKNOWN_DRUG_ADVICE).toContain('약사');
    expect(scoreFood(getFood('coffee'), ctx(), p).verdict).toBe('BLOCKED'); // 일반 규칙(D3)은 그대로
    expect(drugNotesFor(p, getFood('alcohol'))).toEqual([]);
  });

  it('양약을 끄면 약 안내와 약물 규칙이 모두 꺼진다', () => {
    const p: UserProfile = { ...withMeds(resolveMedication('자낙스', ['21:30'])), autonomicStatus: { ...P.autonomicStatus, takingWesternMeds: false, medications: [resolveMedication('자낙스', ['21:30'])] } };
    expect(drugNotesFor(p, getFood('alcohol'))).toEqual([]);
    expect(medAdvisories(withMeds(resolveMedication('희귀약X', [])))).toHaveLength(1);
    expect(medAdvisories({ ...p, autonomicStatus: { ...p.autonomicStatus, medications: [resolveMedication('희귀약X', [])] } })).toEqual([]);
  });

  it('AT-25 미검증 규칙이 걸리면 "확인 필요" 플래그', () => {
    const p = withMeds(resolveMedication('졸로푸트', ['08:30']));
    const r = scoreFood(getFood('alcohol'), ctx('AS_IS', false, 'ROOM'), p);
    expect(r.needsVerification).toBe(true);
    expect(scoreFood(getFood('rice'), ctx('STEAMED', false, 'WARM'), p).needsVerification).toBe(false);
  });

  it('식판의 술도 약물 규칙을 거친다', () => {
    const p = withMeds(resolveMedication('자낙스', ['21:30']));
    const t = evaluateTray({ menuText: '회식 맥주', meal: 'LUNCH', profile: p });
    expect(t.items[0]!.final).toBe('BLOCKED');
    expect(t.items[0]!.result.needsVerification).toBe(true);
  });

  it('약 병용 주의 항목은 식판에서 "조금만"이 아니라 거르기', () => {
    const p = withMeds(resolveMedication('졸로푸트', ['08:30']));
    const t = evaluateTray({ menuText: '맥주, 황태국', meal: 'LUNCH', profile: p });
    expect(t.items.map((i) => i.final)).toEqual(['SKIP', 'TAKE']);
    expect(t.items[0]!.result.needsVerification).toBe(true);
    expect(t.items[0]!.result.hits.some((h) => h.ruleId === 'D-CAP')).toBe(true);
  });

  it('사전의 모든 규칙에 출처와 verified 값이 있다 (완료 기준)', () => {
    for (const r of DRUG_FOOD_RULES) {
      expect(r.source.trim().length, r.drugId).toBeGreaterThan(0);
      expect(typeof r.verified, r.drugId).toBe('boolean');
      expect(DRUGS.some((d) => d.id === r.drugId), r.drugId).toBe(true);
    }
  });

  it('약 목록의 복약 시각이 60분 창에 합쳐진다', () => {
    const p = withMeds(resolveMedication('렉사프로', ['08:30', '15:00']));
    expect(effectiveMedTimes(p)).toEqual(['08:30', '13:00', '15:00', '21:30']);
    expect(medWindows(p).map((w) => w.label)).toContain('14:00–16:00');
  });
});

describe('AT-20 H5 저녁을 거르거나 적게 먹은 날', () => {
  const s = startFunnel(P, toMinutes('22:40'), 0);
  it('저녁 거름·적게: Step 2를 건너뛰고 대체식으로', () => {
    for (const d of ['SKIPPED', 'LIGHT'] as const) {
      const n = finishWaiting(s, 15 * 60_000, d);
      expect(n.step).toBe('SUBSTITUTE');
      expect(n.hungerVerdict).toBe('REAL');
      expect(n.skippedHungerCheck).toBe(true);
    }
  });
  it('저녁을 평소대로 먹었으면 판별 단계로', () => {
    expect(finishWaiting(s, 15 * 60_000, 'NORMAL').step).toBe('HUNGER_CHECK');
    expect(finishWaiting(s, 15 * 60_000).step).toBe('HUNGER_CHECK');
  });
});

describe('AT-26 H7 저녁 추천', () => {
  it('저녁 19:00 · 취침 23:30: 마감 20:30, 조합 3개, 모두 담기 판정', () => {
    expect(dinnerCutoff(P)).toBe('20:30');
    const plan = recommendMeal(P, 'DINNER');
    expect(plan.cutoff).toBe('20:30');
    expect(plan.combos).toHaveLength(3);
    for (const c of plan.combos) {
      for (const d of [c.rice, c.soup, c.protein, c.veggie]) {
        expect(evaluateDishAt(d, P, toMinutes('19:00')).final, d.name).toBe('TAKE');
      }
    }
    expect(plan.earlyDinner).toBe(false);
  });
  it('조합에 돼지고기·튀김·샐러드·면이 들어가지 않는다', () => {
    for (const c of recommendMeal(P, 'DINNER').combos) {
      for (const d of [c.rice, c.soup, c.protein, c.veggie]) {
        for (const bad of ['PORK', 'FRIED', 'RAW_SALAD', 'NOODLE'] as const) expect(d.tags, d.name).not.toContain(bad);
      }
    }
  });
  it('취침 5시간 이상 전 저녁이면 단백질을 충분히 넣으라고 안내', () => {
    const early: UserProfile = { ...P, routine: { ...P.routine, dinner: '18:00' } };
    const plan = recommendMeal(early, 'DINNER');
    expect(plan.earlyDinner).toBe(true);
    expect(plan.advice.join(' ')).toContain('단백질');
  });
  it('저녁 시각이 복약 창에 걸리면 과일·한방차 조합은 제외된다', () => {
    const p: UserProfile = { ...P, routine: { ...P.routine, dinner: '21:00' } };
    for (const c of recommendMeal(p, 'DINNER').combos) for (const d of [c.rice, c.soup, c.protein, c.veggie]) expect(d.slot).not.toBe('DESSERT');
  });
  it('다른 체질은 같은 규칙 엔진으로 다른 조합이 나온다', () => {
    const soeum = recommendMeal(P, 'DINNER').combos[0]!;
    const soyang = recommendMeal(withConstitution(P, 'SOYANG'), 'DINNER');
    expect(soyang.combos.length === 0 || soyang.combos[0]!.protein.id !== soeum.protein.id || soyang.combos[0]!.soup.id !== soeum.soup.id).toBe(true);
  });
  it('주말·쉬는 날 판정', () => {
    expect(isHomeDay(P, '2026-11-01')).toBe(true); // 일요일
    expect(isHomeDay(P, '2026-11-02')).toBe(false); // 월요일
    expect(isHomeDay({ ...P, holidayDates: ['2026-11-02'] }, '2026-11-02')).toBe(true);
  });
});

describe('AT-28 D7 알림·캘린더', () => {
  const rem = dailyReminders(P);
  it('복약 3회 + 야식 + 저녁 마감: 마감 3 + 복약 3 + 야식 1 + 저녁 마감 1', () => {
    expect(rem).toHaveLength(8);
    expect(rem.filter((r) => r.kind === 'MED_CUTOFF').map((r) => r.time)).toEqual(['07:30', '12:00', '20:30']);
    expect(rem.filter((r) => r.kind === 'MED').map((r) => r.time)).toEqual(['08:30', '13:00', '21:30']);
    expect(rem.find((r) => r.kind === 'NIGHT')!.time).toBe('21:00');
    expect(rem.find((r) => r.kind === 'DINNER_CUTOFF')!.time).toBe('20:30');
  });
  it('양약을 끄면 복약 알림이 사라진다', () => {
    expect(dailyReminders(relaxed).map((r) => r.kind).sort()).toEqual(['DINNER_CUTOFF', 'NIGHT']);
  });

  const ics = buildIcs(rem, '2026-11-01', new Date('2026-11-01T03:00:00Z'));
  const unfolded = ics.replace(/\r\n /g, '');
  it('유효한 iCalendar 구조: CRLF, 균형 잡힌 BEGIN/END, 필수 속성', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.includes('\n') && ics.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
    const lines = unfolded.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.some((l) => l.startsWith('PRODID:'))).toBe(true);
    for (const k of ['VEVENT', 'VALARM']) expect(lines.filter((l) => l === `BEGIN:${k}`).length).toBe(lines.filter((l) => l === `END:${k}`).length);
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(8);
  });
  it('모든 이벤트가 매일 반복하고 고유한 UID·정각 시작을 가진다', () => {
    const lines = unfolded.split('\r\n');
    expect(lines.filter((l) => l === 'RRULE:FREQ=DAILY')).toHaveLength(8);
    const uids = lines.filter((l) => l.startsWith('UID:'));
    expect(new Set(uids).size).toBe(8);
    expect(lines.filter((l) => /^DTSTART:\d{8}T\d{6}$/.test(l))).toHaveLength(8);
    expect(lines).toContain('DTSTART:20261101T073000');
    expect(lines).toContain('DTSTAMP:20261101T030000Z');
    expect(lines.filter((l) => l === 'TRIGGER:PT0M')).toHaveLength(8);
  });
  it('한 줄은 75옥텟을 넘지 않고, 접어도 글자가 깨지지 않는다', () => {
    const enc = new TextEncoder();
    for (const l of ics.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(unfolded).toContain('SUMMARY:한방차·과일·유제품 마감');
    expect(foldLine('가'.repeat(60)).split('\r\n ').join('')).toBe('가'.repeat(60));
  });
  it('쉼표·세미콜론·줄바꿈을 이스케이프한다', () => {
    const out = buildIcs([{ id: 'x', kind: 'NIGHT', time: '21:00', title: 'a,b;c', body: '줄1\n줄2' }], '2026-11-01').replace(/\r\n /g, '');
    expect(out).toContain('SUMMARY:a\\,b\;c');
    expect(out).toContain('DESCRIPTION:줄1\\n줄2');
  });
});

describe('AT-29 v1 기록 마이그레이션 & D1 백업', () => {
  const v1 = (reduced: boolean) => ({
    date: '2026-10-31',
    vagalToneRoutine: { preMealBreathing478: true, postMealWalk15Min: false, warmWaterOnly: true },
    cafeteriaFilterLog: { morningPortionReduced: reduced, avoidedColdSaladAndPork: true, includedRadishOrWarmSoup: false },
    lateNightDefense: { cravingOccurred: true, teaTimer15MinCompleted: true, outcome: 'SAFE_SUBSTITUTE', fastingHoursToMorning: 10 },
    symptomFeedback: { epigastricStuffiness: 4, autonomicTension: 2 },
  });
  it('morningPortionReduced: true → 50, false → 100', () => {
    expect(migrateLog(v1(true))!.cafeteriaFilterLog.morningPortion).toBe(50);
    expect(migrateLog(v1(false))!.cafeteriaFilterLog.morningPortion).toBe(100);
  });
  it('값은 보존하고 빠진 dinnerLog는 기본값으로 채운다', () => {
    const m = migrateLog(v1(true))!;
    expect(m.vagalToneRoutine.warmWaterOnly).toBe(true);
    expect(m.symptomFeedback.epigastricStuffiness).toBe(4);
    expect(m.lateNightDefense.outcome).toBe('SAFE_SUBSTITUTE');
    expect(m.dinnerLog).toEqual({ eatenAt: null, amount: 'NORMAL', finishedBeforeCutoff: true });
    expect('morningPortionReduced' in m.cafeteriaFilterLog).toBe(false);
  });
  it('v2 값(75)은 그대로 둔다', () => {
    const l = { ...emptyLog('2026-10-31'), cafeteriaFilterLog: { ...emptyLog('x').cafeteriaFilterLog, morningPortion: 75 as const } };
    expect(migrateLog(l)!.cafeteriaFilterLog.morningPortion).toBe(75);
  });
  it('날짜가 잘못된 기록은 버린다', () => {
    expect(migrateLog({ date: '어제' })).toBeNull();
    expect(migrateLog(null)).toBeNull();
  });
  it('v1 프로필(약 목록·저녁·쉬는 날 없음)에 v2 필드를 채운다', () => {
    const old = { constitution: 'SOEUM', subCondition: 'QI_STAGNATION', autonomicStatus: { parasympatheticLow: true, takingWesternMeds: true, medSchedules: ['09:00'] }, mealEnvironment: { breakfast: 'HOME', lunch: 'HOME', lateNightHabit: 'NONE' } };
    const p = mergeProfile(old);
    expect(p.autonomicStatus.medications).toEqual([]);
    expect(p.mealEnvironment.dinner).toBe('HOME');
    expect(p.holidayDates).toEqual([]);
    expect(p.autonomicStatus.medSchedules).toEqual(['09:00']);
    expect(p.routine.bedtime).toBe('23:30');
  });
  it('백업 → 복원 왕복: 기록·약 목록이 그대로, 예시는 제외', () => {
    const prof = withMeds(resolveMedication('렉사프로', ['08:30']));
    const logs: DailyHealthLog[] = [{ ...emptyLog('2026-10-30') }, { ...emptyLog('2026-10-31'), isExample: true }];
    const back = parseBackup(serializeBackup(createBackup(prof, logs, new Date('2026-11-01T00:00:00Z'))));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.logs.map((l) => l.date)).toEqual(['2026-10-30']);
      expect(back.profile.autonomicStatus.medications[0]!.drugId).toBe('escitalopram');
    }
  });
  it('v1 백업(버전 없음)도 읽어서 올린다', () => {
    const r = parseBackup(JSON.stringify({ profile: P, logs: [v1(true)] }));
    expect(r.ok && r.logs[0]!.cafeteriaFilterLog.morningPortion).toBe(50);
  });
  it('깨진 파일은 이유를 알려 준다', () => {
    expect(parseBackup('안녕')).toMatchObject({ ok: false });
    expect(parseBackup('[]')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: 'other', profile: P }))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ version: 99, profile: P }))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ profile: { ...P, constitution: 'X' } }))).toMatchObject({ ok: false });
  });
  it('잘못된 시각과 중복·불량 기록은 경고로 알린다', () => {
    const bad = { ...P, autonomicStatus: { ...P.autonomicStatus, medSchedules: ['8시 반', '09:00'] } };
    const r = parseBackup(JSON.stringify({ profile: bad, logs: [emptyLog('2026-10-30'), emptyLog('2026-10-30'), { date: 'x' }] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.autonomicStatus.medSchedules).toEqual(['09:00']);
      expect(r.logs).toHaveLength(1);
      expect(r.warnings.length).toBe(2);
    }
  });
});

describe('AT-15/16 보강', () => {
  it('식판 아침 안내가 75%를 반영한다', () => {
    const y: DailyHealthLog = { ...emptyLog('2026-10-31'), lateNightDefense: { cravingOccurred: true, teaTimer15MinCompleted: true, outcome: 'SAFE_SUBSTITUTE', fastingHoursToMorning: 10 } };
    const t = evaluateTray({ menuText: '백미밥, 황태국', meal: 'BREAKFAST', profile: P, yesterday: y });
    expect(t.portion.percent).toBe(75);
    expect(t.eatingOrder.some((o) => o.includes('3/4'))).toBe(true);
    expect(portionFor('BREAKFAST', y).reason).toContain('대체식');
  });
  it('메뉴 파싱: 돼지고기김치찌개 / 김치볶음밥(추정) / 꽈리고추멸치볶음', () => {
    const m = parseMenu('돼지고기김치찌개, 김치볶음밥, 꽈리고추멸치볶음');
    expect(m.items.map((i) => [i.dish.name, i.source])).toEqual([
      ['김치찌개', 'CATALOG'],
      ['김치볶음밥', 'INFERRED'],
      ['멸치볶음', 'CATALOG'],
    ]);
  });
});
