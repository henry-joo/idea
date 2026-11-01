import { describe, expect, it } from 'vitest';
import { evaluateTray, portionFor } from './cafeteria/tray';
import { parseMenu } from './cafeteria/parser';
import { getDish } from './cafeteria/dishes';
import { getFood, FOODS } from './food/catalog';
import type { CookingContext } from './food/types';
import { emptyLog, type DailyHealthLog } from './log/types';
import { computeInsights, detectRedFlags } from './log/insights';
import { exampleLogs } from './log/examples';
import { checkIntakeAt, medWindows } from './medication/safeguard';
import {
  chooseSubstitute,
  chooseWarmDrink,
  defend,
  fakeHungerScore,
  fastingHours,
  finishWaiting,
  isLateNight,
  nightLogDate,
  rankSubstitutes,
  startFunnel,
  submitHungerCheck,
} from './night/funnel';
import { DEFAULT_PROFILE, withConstitution } from './profile/defaults';
import type { UserProfile } from './profile/types';
import { scoreDish } from './scoring/dish';
import { scoreFood } from './scoring/engine';
import { addDays, toMinutes } from './shared/time';

const P = DEFAULT_PROFILE;
const ctx = (method: CookingContext['method'], warmSeasoning = false, servingTemp: CookingContext['servingTemp'] = 'WARM'): CookingContext => ({ method, warmSeasoning, servingTemp });
const at = toMinutes;
const noMeds: UserProfile = { ...P, autonomicStatus: { ...P.autonomicStatus, takingWesternMeds: false, parasympatheticLow: false } };

describe('카탈로그 무결성', () => {
  it('모든 식재료가 4체질 적합도와 1~5 범위 속성을 가진다', () => {
    for (const f of FOODS) {
      expect(Object.keys(f.suitabilityByType).sort()).toEqual(['SOEUM', 'SOYANG', 'TAEEUM', 'TAEYANG']);
      expect(f.clinicalProperties.qiMovingScore).toBeGreaterThanOrEqual(1);
      expect(f.clinicalProperties.qiMovingScore).toBeLessThanOrEqual(5);
      expect(f.clinicalProperties.viscosity).toBeGreaterThanOrEqual(1);
      expect(f.clinicalProperties.viscosity).toBeLessThanOrEqual(5);
    }
  });
});

describe('§3-1 순기·소도 우선 원칙', () => {
  it('기체증 소음인: 인삼·홍삼은 차단', () => {
    for (const id of ['ginseng', 'red_ginseng']) {
      const r = scoreFood(getFood(id), ctx('AS_IS', false, 'HOT'), noMeds);
      expect(r.verdict).toBe('BLOCKED');
      expect(r.hits.some((h) => h.ruleId === 'R1' && h.block)).toBe(true);
    }
  });

  it('허한증 소음인(양약 없음)에선 홍삼이 다시 허용된다', () => {
    const p: UserProfile = { ...noMeds, subCondition: 'COLD_DEFICIENCY' };
    expect(scoreFood(getFood('red_ginseng'), ctx('AS_IS', false, 'HOT'), p).blocked).toBe(false);
  });

  it('찹쌀·떡·밀가루는 점성 페널티를 받고 백미보다 낮다', () => {
    const rice = scoreFood(getFood('rice'), ctx('STEAMED'), P);
    for (const id of ['glutinous_rice', 'rice_cake', 'wheat']) {
      const r = scoreFood(getFood(id), ctx('STEAMED'), P);
      expect(r.hits.some((h) => h.ruleId === 'V' && h.delta < 0)).toBe(true);
      expect(r.score).toBeLessThan(rice.score);
      expect(['CAUTION', 'AVOID']).toContain(r.verdict);
    }
  });

  it('순기·소도 식품이 최상위 가중치를 받는다', () => {
    const top = ['jinpi_tea', 'nurungji', 'radish', 'chive', 'perilla_leaf', 'minari', 'chinese_yam'];
    for (const id of top) {
      const f = getFood(id);
      const c = f.category === 'TEA_SPICE' ? ctx('AS_IS', false, 'HOT') : ctx('SOUP', true, 'HOT');
      expect(scoreFood(f, c, P).score, id).toBeGreaterThanOrEqual(75);
    }
  });

  it('기체증에선 순기 점수 배율 ×2가 적용된다', () => {
    const qi = scoreFood(getFood('radish'), ctx('SOUP', true, 'HOT'), P).hits.find((h) => h.ruleId === 'Q')!;
    const qiCold = scoreFood(getFood('radish'), ctx('SOUP', true, 'HOT'), { ...P, subCondition: 'COLD_DEFICIENCY' }).hits.find((h) => h.ruleId === 'Q')!;
    expect(qi.delta).toBe(qiCold.delta * 2);
  });

  it('대추·꿀 같은 단맛은 기체증에서 감점(甘令人中滿)', () => {
    const r = scoreFood(getFood('jujube'), ctx('AS_IS', false, 'ROOM'), P);
    expect(r.hits.some((h) => h.label.includes('단맛 정체') && h.delta < 0)).toBe(true);
  });
});

describe('§3-2 조리법(온도) 보정', () => {
  it('양배추·브로콜리 생식은 -25, 화식+온열양념은 +20', () => {
    for (const id of ['cabbage', 'broccoli']) {
      const raw = scoreFood(getFood(id), ctx('RAW', false, 'COLD'), P);
      const cooked = scoreFood(getFood(id), ctx('STEAMED', true, 'WARM'), P);
      const plain = scoreFood(getFood(id), ctx('STEAMED', false, 'WARM'), P);
      expect(raw.hits.find((h) => h.ruleId === 'R2')?.delta).toBe(-25);
      expect(cooked.hits.find((h) => h.ruleId === 'R2')?.delta).toBe(20);
      expect(plain.hits.find((h) => h.ruleId === 'R2')).toBeUndefined();
      expect(cooked.score - plain.score).toBe(20);
      expect(raw.verdict).toBe('AVOID');
    }
  });

  it('소양인은 생식 감점이 없고 열성 양념이 감점이다', () => {
    const p = withConstitution(noMeds, 'SOYANG');
    expect(scoreFood(getFood('cucumber'), ctx('RAW', false, 'ROOM'), p).verdict).toBe('BEST');
    const r = scoreFood(getFood('cabbage'), ctx('STIR_FRIED', true, 'WARM'), p);
    expect(r.hits.find((h) => h.ruleId === 'R2')!.delta).toBeLessThan(0);
  });

  it('냉식은 실효 한열을 한 단계 차게 만든다', () => {
    const hot = scoreFood(getFood('buckwheat'), ctx('BOILED', false, 'HOT'), P);
    const cold = scoreFood(getFood('buckwheat'), ctx('BOILED', false, 'COLD'), P);
    expect(cold.effectiveThermal).toBe('COLD');
    expect(cold.score).toBeLessThan(hot.score);
  });
});

describe('§3-3 양약-한방차 60분 세이프가드 & 전역 금기', () => {
  it('복약 시각마다 ±60분 창을 만든다', () => {
    expect(medWindows(P).map((w) => w.label)).toEqual(['07:30–09:30', '12:00–14:00', '20:30–22:30']);
  });

  it('창 안에서 한방차·유제품·과일은 보류, 창 밖은 허용', () => {
    for (const cls of ['HERBAL_TEA', 'DAIRY', 'FRUIT'] as const) {
      const c = checkIntakeAt(P, cls, at('21:00'));
      expect(c.allowed).toBe(false);
      expect(c.nextAllowedAt).toBe('22:31');
    }
    expect(checkIntakeAt(P, 'HERBAL_TEA', at('15:00')).allowed).toBe(true);
    expect(checkIntakeAt(P, null, at('21:00')).allowed).toBe(true);
  });

  it('겹치는 창은 마지막 창 끝까지 이어서 미룬다', () => {
    const p: UserProfile = { ...P, autonomicStatus: { ...P.autonomicStatus, medSchedules: ['12:00', '13:00'] } };
    expect(checkIntakeAt(p, 'FRUIT', at('11:30')).nextAllowedAt).toBe('14:01');
  });

  it('자정을 넘는 창을 다룬다', () => {
    const p: UserProfile = { ...P, autonomicStatus: { ...P.autonomicStatus, medSchedules: ['23:30'] } };
    expect(checkIntakeAt(p, 'DAIRY', at('00:15')).allowed).toBe(false);
    expect(checkIntakeAt(p, 'DAIRY', at('00:31')).allowed).toBe(true);
  });

  it('양약 복용을 끄면 창이 사라진다', () => {
    expect(medWindows(noMeds)).toEqual([]);
  });

  it('카페인·자몽은 시간과 무관하게 전역 차단', () => {
    for (const id of ['coffee', 'green_tea', 'grapefruit']) {
      expect(scoreFood(getFood(id), ctx('AS_IS', false, 'HOT'), P).verdict, id).toBe('BLOCKED');
    }
    for (const c of ['SOYANG', 'TAEEUM', 'TAEYANG'] as const) {
      expect(scoreFood(getFood('coffee'), ctx('AS_IS', false, 'HOT'), withConstitution(P, c)).verdict).toBe('BLOCKED');
    }
  });
});

describe('§3-4 구내식당 식판 시뮬레이터', () => {
  const lunch = evaluateTray({
    menuText: '잡곡밥, 소고기무국, 제육볶음, 생선까스, 두부조림, 콩나물무침, 양배추샐러드, 잔치국수, 사과',
    meal: 'LUNCH',
    profile: P,
  });
  const verdict = (name: string) => lunch.items.find((i) => i.dish.name === name)?.final;

  it('담을 반찬: 익힌 나물·두부·따뜻한 국물', () => {
    expect(verdict('소고기무국')).toBe('TAKE');
    expect(verdict('두부조림')).toBe('TAKE');
    expect(verdict('콩나물무침')).toBe('TAKE');
    expect(lunch.hasWarmSoupOrRadish).toBe(true);
  });

  it('거를 반찬: 돼지고기·튀김·생야채 샐러드·면류 (하드 룰)', () => {
    expect(verdict('제육볶음')).toBe('SKIP');
    expect(verdict('생선까스')).toBe('SKIP');
    expect(verdict('양배추샐러드')).toBe('SKIP');
    expect(verdict('잔치국수')).toBe('SKIP');
  });

  it('점심 12:00 후식 과일은 13:00 복약 창 때문에 보류', () => {
    const apple = lunch.items.find((i) => i.dish.name === '사과')!;
    expect(apple.final).toBe('HOLD');
    expect(apple.holdUntil).toBe('14:01');
  });

  it('계란·생선은 담는다', () => {
    expect(scoreDish(getDish('main_egg_steam'), P).verdict).toBe('TAKE');
    expect(scoreDish(getDish('main_white_fish'), P).verdict).toBe('TAKE');
  });

  it('삼계탕은 인삼 때문에 기체증에선 차단', () => {
    expect(scoreDish(getDish('soup_samgyetang'), noMeds).verdict).toBe('BLOCKED');
  });

  it('D2: 전날 일반 야식 50% · 대체식 75% · 방어 100%, 점심은 항상 100%', () => {
    const y: DailyHealthLog = { ...emptyLog('2026-10-31'), lateNightDefense: { cravingOccurred: true, teaTimer15MinCompleted: false, outcome: 'HEAVY_SNACK', fastingHoursToMorning: 8 } };
    const withOutcome = (outcome: 'HEAVY_SNACK' | 'SAFE_SUBSTITUTE' | 'DEFENDED'): DailyHealthLog => ({ ...y, lateNightDefense: { ...y.lateNightDefense, outcome } });
    expect(portionFor('BREAKFAST', y).percent).toBe(50);
    expect(portionFor('BREAKFAST', withOutcome('SAFE_SUBSTITUTE')).percent).toBe(75);
    expect(portionFor('BREAKFAST', withOutcome('DEFENDED')).percent).toBe(100);
    expect(portionFor('BREAKFAST', { ...y, lateNightDefense: { ...y.lateNightDefense, cravingOccurred: false } }).percent).toBe(100);
    expect(portionFor('BREAKFAST', null).percent).toBe(100);
    for (const o of ['HEAVY_SNACK', 'SAFE_SUBSTITUTE', 'DEFENDED'] as const) expect(portionFor('LUNCH', withOutcome(o)).percent).toBe(100);
  });

  it('체질을 바꾸면 같은 식판의 판정이 바뀐다', () => {
    const soyang = evaluateTray({ menuText: '제육볶음, 오이무침', meal: 'LUNCH', profile: withConstitution(noMeds, 'SOYANG') });
    const soeum = evaluateTray({ menuText: '제육볶음, 오이무침', meal: 'LUNCH', profile: noMeds });
    expect(soeum.items.map((i) => i.final)).toEqual(['SKIP', 'SKIP']);
    expect(soyang.items.find((i) => i.dish.name === '오이무침')!.final).toBe('TAKE');
  });
});

describe('메뉴판 파서', () => {
  it('쉼표·줄바꿈·공백 구분을 처리한다', () => {
    expect(parseMenu('백미밥\n된장국').items).toHaveLength(2);
    expect(parseMenu('백미밥 계란찜 시금치나물').items.map((i) => i.dish.name)).toEqual(['백미밥', '계란찜', '시금치나물']);
  });

  it('카탈로그 부분 일치와 추론을 구분한다', () => {
    const m = parseMenu('돼지고기김치찌개, 닭가슴살샐러드, 냉이된장국, 꽈리고추멸치볶음, 무지개떡');
    const by = (raw: string) => m.items.find((i) => i.raw === raw)!;
    expect(by('돼지고기김치찌개').dish.name).toBe('김치찌개');
    expect(by('닭가슴살샐러드').dish.tags).toContain('RAW_SALAD');
    expect(by('냉이된장국').dish.tags).not.toContain('COLD_DISH');
    expect(by('꽈리고추멸치볶음').dish.name).toBe('멸치볶음');
  });

  it('앞부분만 같은 메뉴는 카탈로그로 오인하지 않는다', () => {
    const m = parseMenu('김치볶음밥, 무지개떡');
    expect(m.items[0]!.dish.name).toBe('김치볶음밥');
    expect(m.items[0]!.source).toBe('INFERRED');
    expect(m.items[0]!.dish.ingredients.map((i) => i.foodId)).toEqual(expect.arrayContaining(['napa_cabbage', 'rice']));
  });

  it('추론: 튀김·돼지·면을 메뉴명에서 잡아낸다', () => {
    const m = parseMenu('치즈돈가스, 해물볶음우동, 양념치킨, 돼지국밥');
    for (const it of m.items) expect(evaluateTray({ menuText: it.raw, meal: 'LUNCH', profile: P }).items[0]!.final, it.raw).toBe('SKIP');
  });

  it('판별 불가 토큰은 따로 모은다', () => {
    expect(parseMenu('백미밥, 오늘의특선').unknown).toEqual(['오늘의특선']);
  });
});

describe('§3-5 야식 방어 3단계 퍼널', () => {
  it('21시 이후 ~ 새벽 4시 전을 야식 시간으로 본다', () => {
    expect(isLateNight(at('20:59'))).toBe(false);
    expect(isLateNight(at('21:00'))).toBe(true);
    expect(isLateNight(at('01:30'))).toBe(true);
    expect(isLateNight(at('04:00'))).toBe(false);
  });

  it('Step 1: 21:30 복약 창이면 진피차 대신 미온수', () => {
    const d = chooseWarmDrink(P, at('21:10'));
    expect(d.foodId).toBe('warm_water');
    expect(d.swappedReason).toContain('21:30');
    const p: UserProfile = { ...P, autonomicStatus: { ...P.autonomicStatus, medSchedules: ['08:30', '13:00'] } };
    expect(chooseWarmDrink(p, at('21:10')).foodId).toBe('jinpi_tea');
  });

  it('Step 1: 15분 전에 넘기면 대기 미완료로 기록', () => {
    const s = startFunnel(P, at('22:40'), 0);
    expect(finishWaiting(s, 5 * 60_000).timerCompleted).toBe(false);
    expect(finishWaiting(s, 15 * 60_000).timerCompleted).toBe(true);
  });

  it('Step 2: 가짜 배고픔 신호 3개 이상이면 FAKE', () => {
    const ans = { recent_dinner: true, sudden: true, specific: true, stress: false, drink_helped: false, body_signal: true };
    expect(fakeHungerScore(ans)).toBe(3);
    expect(submitHungerCheck(startFunnel(P, at('22:40'), 0), ans).hungerVerdict).toBe('FAKE');
    expect(submitHungerCheck(startFunnel(P, at('22:40'), 0), { body_signal: true, recent_dinner: false }).hungerVerdict).toBe('REAL');
  });

  it('Step 3: 소음인 대체식은 누룽지·계란찜·연두부·마죽이고 모두 허용', () => {
    const r = rankSubstitutes(P, at('22:40'));
    expect(r.map((x) => x.dish.id).sort()).toEqual(['night_egg_steam', 'night_ma_juk', 'night_nurungji', 'night_soft_tofu']);
    expect(r.every((x) => x.allowed)).toBe(true);
  });

  it('공복 시간: 방어 성공은 저녁 식사부터, 대체식은 섭취 시각부터', () => {
    const s = startFunnel(P, at('22:40'), 0);
    expect(fastingHours(P, defend(s))).toBe(13); // 19:00 → 07:50 = 12h50m
    expect(fastingHours(P, chooseSubstitute(s, 'night_nurungji', at('22:40')))).toBe(9);
  });

  it('자정 이후 야식은 전날 기록에 귀속', () => {
    expect(nightLogDate('2026-11-02', at('00:40'))).toBe('2026-11-01');
    expect(nightLogDate('2026-11-01', at('22:40'))).toBe('2026-11-01');
  });
});

describe('기록 분석 & 레드 플래그', () => {
  it('예시 기록: 일반 야식 다음 날이 방어 성공 다음 날보다 답답하다', () => {
    const logs = exampleLogs('2026-11-01');
    const ins = computeInsights(logs, '2026-11-01');
    const g = Object.fromEntries(ins.nextDayStuffinessByNight.map((x) => [x.group, x.mean]));
    expect(g.HEAVY_SNACK!).toBeGreaterThan(g.DEFENDED!);
    expect(ins.days).toBe(14);
  });

  it('명치 답답함 4 이상 3일 연속이면 경고, 7일이면 진료 권고', () => {
    const mk = (date: string, s: 1 | 2 | 3 | 4 | 5): DailyHealthLog => ({ ...emptyLog(date), symptomFeedback: { epigastricStuffiness: s, autonomicTension: 2 } });
    const three = ['2026-10-30', '2026-10-31', '2026-11-01'].map((d) => mk(d, 4));
    expect(detectRedFlags(three, '2026-11-01').map((f) => f.id)).toEqual(['stuffy3']);
    const seven = Array.from({ length: 7 }, (_, i) => mk(addDays('2026-11-01', -i), 5));
    expect(detectRedFlags(seven, '2026-11-01').map((f) => f.level)).toEqual(['URGENT']);
    const broken = [...three, mk('2026-10-29', 2)].map((l) => (l.date === '2026-10-31' ? mk(l.date, 2) : l));
    expect(detectRedFlags(broken, '2026-11-01')).toEqual([]);
  });
});
