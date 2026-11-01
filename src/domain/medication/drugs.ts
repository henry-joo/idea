import type { SasangFoodItem } from '../food/types';
import type { UserProfile } from '../profile/types';
import { fromMinutes, inCircularRange, toMinutes, type HHMM } from '../shared/time';
import type { DrugDef, DrugFoodRule, DrugNote, MedicationEntry } from './types';

/**
 * 약물 사전 (D5, H6).
 *
 * ⚠ 이 사전의 모든 규칙은 `verified: false`다. 약리학 교과서 수준의 일반 지식을 옮겼을 뿐,
 *   식약처 의약품안전나라(DUR)·허가사항 원문을 대조하지 않았다. 그래서 화면마다 "약사 확인 필요"가 붙는다.
 *   원문을 대조한 규칙만 `verified: true`로 바꾸고 `source`에 문서명과 확인일을 적는다.
 */
const SRC = '일반 약리 지식. 의약품안전나라(DUR)·허가사항 대조 필요';

export const DRUGS: readonly DrugDef[] = [
  { id: 'fluvoxamine', ingredient: '플루복사민', names: ['플루복사민', '듀미록스', 'fluvoxamine', 'luvox'], classLabel: 'SSRI', pathway: 'CYP1A2 억제' },
  { id: 'escitalopram', ingredient: '에스시탈로프람', names: ['에스시탈로프람', '렉사프로', 'escitalopram', 'lexapro'], classLabel: 'SSRI' },
  { id: 'sertraline', ingredient: '서트랄린', names: ['서트랄린', '졸로푸트', 'sertraline', 'zoloft'], classLabel: 'SSRI' },
  { id: 'paroxetine', ingredient: '파록세틴', names: ['파록세틴', '세로자트', 'paroxetine', 'seroxat'], classLabel: 'SSRI' },
  { id: 'alprazolam', ingredient: '알프라졸람', names: ['알프라졸람', '자낙스', 'alprazolam', 'xanax'], classLabel: '벤조디아제핀', pathway: 'CYP3A4 기질' },
  { id: 'buspirone', ingredient: '부스피론', names: ['부스피론', '부스파', 'buspirone'], classLabel: '항불안제', pathway: 'CYP3A4 기질' },
  { id: 'propranolol', ingredient: '프로프라놀롤', names: ['프로프라놀롤', '인데놀', 'propranolol', 'inderal'], classLabel: '베타차단제' },
  { id: 'mosapride', ingredient: '모사프리드', names: ['모사프리드', '가스모틴', 'mosapride'], classLabel: '위장관운동촉진제', pathway: 'CYP3A4 기질' },
  { id: 'furosemide', ingredient: '푸로세미드', names: ['푸로세미드', '라식스', 'furosemide', 'lasix'], classLabel: '이뇨제' },
  { id: 'hctz', ingredient: '히드로클로로티아지드', names: ['히드로클로로티아지드', 'hctz', 'hydrochlorothiazide'], classLabel: '이뇨제' },
];

export const DRUG_FOOD_RULES: readonly DrugFoodRule[] = [
  { drugId: 'fluvoxamine', target: 'CAFFEINE', rule: 'BLOCK', reason: 'CYP1A2를 강하게 억제해 카페인 분해가 크게 느려집니다. 두근거림·불안·불면이 심해질 수 있습니다', source: SRC, verified: false },
  { drugId: 'fluvoxamine', target: 'ALCOHOL', rule: 'CAUTION', reason: '졸림·집중력 저하가 겹칠 수 있습니다', source: SRC, verified: false },
  { drugId: 'alprazolam', target: 'GRAPEFRUIT', rule: 'BLOCK', reason: 'CYP3A4 억제로 약 농도가 올라 졸림·호흡 억제가 커질 수 있습니다', source: SRC, verified: false },
  { drugId: 'alprazolam', target: 'ALCOHOL', rule: 'BLOCK', reason: '중추신경 억제가 겹칩니다. 함께 드시면 안 됩니다', source: SRC, verified: false },
  { drugId: 'buspirone', target: 'GRAPEFRUIT', rule: 'BLOCK', reason: 'CYP3A4 억제로 약 농도가 크게 오를 수 있습니다', source: SRC, verified: false },
  { drugId: 'escitalopram', target: 'ALCOHOL', rule: 'CAUTION', reason: '졸림·우울감 악화 가능', source: SRC, verified: false },
  { drugId: 'sertraline', target: 'ALCOHOL', rule: 'CAUTION', reason: '졸림·우울감 악화 가능', source: SRC, verified: false },
  { drugId: 'paroxetine', target: 'ALCOHOL', rule: 'CAUTION', reason: '졸림·우울감 악화 가능', source: SRC, verified: false },
  { drugId: 'mosapride', target: 'GRAPEFRUIT', rule: 'CAUTION', reason: 'CYP3A4 기질이라 자몽과 병용 시 농도가 오를 수 있습니다', source: SRC, verified: false },
  { drugId: 'propranolol', target: 'MEAL_TIMING', rule: 'CONSISTENT', reason: '식후 복용이 흡수를 높입니다. 식전·식후 중 하나로 매일 똑같이 드세요', source: SRC, verified: false },
  { drugId: 'furosemide', target: 'LICORICE', rule: 'CAUTION', reason: '감초는 칼륨을 떨어뜨려 이뇨제와 겹치면 저칼륨 위험이 커집니다', source: SRC, verified: false },
  { drugId: 'hctz', target: 'LICORICE', rule: 'CAUTION', reason: '감초는 칼륨을 떨어뜨려 이뇨제와 겹치면 저칼륨 위험이 커집니다', source: SRC, verified: false },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s()·\-]/g, '');

export function matchDrug(name: string, drugs: readonly DrugDef[] = DRUGS): DrugDef | null {
  const n = norm(name);
  if (n.length < 2) return null;
  return drugs.find((d) => d.names.some((x) => norm(x) === n)) ?? drugs.find((d) => d.names.some((x) => n.includes(norm(x)))) ?? null;
}

/** 입력한 약 이름을 사전과 연결한 항목을 만든다 */
export function resolveMedication(name: string, times: HHMM[], timing: MedicationEntry['timing'] = 'ANY'): MedicationEntry {
  return { name: name.trim(), drugId: matchDrug(name)?.id ?? null, times, timing };
}

export function searchDrugs(q: string, drugs: readonly DrugDef[] = DRUGS): DrugDef[] {
  const n = norm(q);
  if (!n) return [];
  return drugs.filter((d) => d.names.some((x) => norm(x).includes(n)) || norm(d.ingredient).includes(n)).slice(0, 6);
}

export function rulesFor(drugId: string, rules: readonly DrugFoodRule[] = DRUG_FOOD_RULES): DrugFoodRule[] {
  return rules.filter((r) => r.drugId === drugId);
}

const medsOf = (p: UserProfile): MedicationEntry[] => p.autonomicStatus.medications ?? [];

/** 이 음식에 걸리는 약물 규칙 (복약 중일 때만) */
export function drugNotesFor(
  profile: UserProfile,
  food: SasangFoodItem,
  rules: readonly DrugFoodRule[] = DRUG_FOOD_RULES,
  drugs: readonly DrugDef[] = DRUGS,
): DrugNote[] {
  if (!profile.autonomicStatus.takingWesternMeds) return [];
  const out: DrugNote[] = [];
  for (const m of medsOf(profile)) {
    if (!m.drugId) continue;
    const def = drugs.find((d) => d.id === m.drugId);
    if (!def) continue;
    for (const r of rules) {
      if (r.drugId !== m.drugId || r.target === 'MEAL_TIMING') continue;
      if (!food.tags.includes(r.target)) continue;
      out.push({ drugName: m.name, ingredient: def.ingredient, rule: r.rule, reason: r.reason, source: r.source, verified: r.verified });
    }
  }
  return out;
}

/** 사전에 없는 약 이름 목록 */
export function unknownMedications(profile: UserProfile): string[] {
  return medsOf(profile).filter((m) => !m.drugId).map((m) => m.name);
}

export const UNKNOWN_DRUG_ADVICE = '이 약은 사전에 없습니다. 일반 규칙(복약 전후 60분, 카페인·자몽 주의)만 적용했으니 약사에게 확인하세요.';

/** 약 관련 안내 문구 (약 화면·판정 화면 공통) */
export function medAdvisories(profile: UserProfile): string[] {
  if (!profile.autonomicStatus.takingWesternMeds) return [];
  return unknownMedications(profile).map((n) => `${n}: ${UNKNOWN_DRUG_ADVICE}`);
}

/** 매일 같은 방식으로 먹어야 하는 약(CONSISTENT) 안내 */
export function consistencyNotes(profile: UserProfile, rules: readonly DrugFoodRule[] = DRUG_FOOD_RULES): DrugNote[] {
  const out: DrugNote[] = [];
  for (const m of medsOf(profile)) {
    const def = m.drugId ? DRUGS.find((d) => d.id === m.drugId) : undefined;
    if (!def) continue;
    for (const r of rules) {
      if (r.drugId === def.id && r.rule === 'CONSISTENT') out.push({ drugName: m.name, ingredient: def.ingredient, rule: r.rule, reason: r.reason, source: r.source, verified: r.verified });
    }
  }
  return out;
}

export interface SeparationHold {
  allowed: boolean;
  nextAllowedAt: HHMM | null;
  reason: string | null;
  note: DrugNote | null;
}

/**
 * SEPARATE 규칙: 약마다 n분 간격. 복약 시각 전후 n분 안이면 보류.
 * 약에 시각이 없으면 프로필의 복약 시각 전체를 쓴다.
 */
export function separationHold(
  profile: UserProfile,
  food: SasangFoodItem,
  atMin: number,
  rules: readonly DrugFoodRule[] = DRUG_FOOD_RULES,
  drugs: readonly DrugDef[] = DRUGS,
): SeparationHold {
  const free: SeparationHold = { allowed: true, nextAllowedAt: null, reason: null, note: null };
  if (!profile.autonomicStatus.takingWesternMeds) return free;
  for (const m of medsOf(profile)) {
    if (!m.drugId) continue;
    const def = drugs.find((d) => d.id === m.drugId);
    if (!def) continue;
    const times = m.times.length ? m.times : profile.autonomicStatus.medSchedules;
    for (const r of rules) {
      if (r.drugId !== m.drugId || r.rule !== 'SEPARATE' || r.target === 'MEAL_TIMING' || !food.tags.includes(r.target)) continue;
      const span = r.separateMinutes ?? 60;
      for (const t of times) {
        const c = toMinutes(t);
        if (inCircularRange(atMin, c - span, c + span)) {
          const next = fromMinutes(c + span + 1);
          return {
            allowed: false,
            nextAllowedAt: next,
            reason: `${m.name} ${t} 복약 ±${span}분: ${food.name} 보류 → ${next}부터`,
            note: { drugName: m.name, ingredient: def.ingredient, rule: r.rule, reason: r.reason, source: r.source, verified: r.verified },
          };
        }
      }
    }
  }
  return free;
}
