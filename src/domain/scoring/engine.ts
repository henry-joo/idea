import { CONSTITUTION_MATRIX, SUB_CONDITION_SPECS } from '../constitution/matrix';
import {
  COOKED_METHODS,
  THERMAL_ORDER,
  type CookingContext,
  type FoodCategory,
  type SasangFoodItem,
  type Suitability,
  type ThermalNature,
} from '../food/types';
import { drugNotesFor } from '../medication/drugs';
import type { DrugNote } from '../medication/types';
import type { UserProfile } from '../profile/types';

export type Verdict = 'BEST' | 'GOOD' | 'CAUTION' | 'AVOID' | 'BLOCKED';

/**
 * 규칙 적중 기록. 모든 점수는 어떤 규칙이 몇 점을 움직였는지 추적 가능해야 한다
 * (임상 설명 책임 + UI의 "왜 이 판정인가" 근거).
 */
export interface RuleHit {
  ruleId: string;
  label: string;
  /** 가감점. BLOCK이면 0 */
  delta: number;
  block?: boolean;
}

export interface FoodScore {
  foodId: string;
  score: number;
  verdict: Verdict;
  blocked: boolean;
  effectiveThermal: ThermalNature;
  hits: RuleHit[];
  /** 약물 사전에서 걸린 규칙 (H6). 출처와 검증 여부를 함께 보여 준다 */
  drugNotes: DrugNote[];
  /** 미검증 약물 규칙이 하나라도 걸렸으면 true → 화면에 "약사 확인 필요" */
  needsVerification: boolean;
}

export const BASE_SCORE: Record<Suitability, number> = { BEST: 70, GOOD: 55, CAUTION: 35, AVOID: 15 };

/** 조정 요소가 없으면 기본점이 같은 등급에 떨어지도록 기본점 바로 아래에 둔다 */
export const VERDICT_THRESHOLDS = { BEST: 68, GOOD: 50, CAUTION: 30 } as const;

const SUIT_LABEL: Record<Suitability, string> = { BEST: '최적', GOOD: '적합', CAUTION: '주의', AVOID: '부적합' };
const THERMAL_LABEL: Record<ThermalNature, string> = { HOT: '열(熱)', WARM: '온(溫)', NEUTRAL: '평(平)', COOL: '량(涼)', COLD: '한(寒)' };

/** 조리 보정 대상이 아닌 카테고리: 그대로 먹는 과일·차·유제품·음료 */
const NON_COOKING_CATEGORIES: readonly FoodCategory[] = ['FRUIT', 'TEA_SPICE', 'DAIRY', 'BEVERAGE'];

export function isCooked(ctx: CookingContext): boolean {
  return COOKED_METHODS.includes(ctx.method);
}

/**
 * 실효 한열: 식재료 고유 성질에 조리·제공 온도를 반영한다.
 * - 차갑게 제공(냉식) → 한 단계 차게
 * - 뜨겁게 제공, 또는 익혀서 따뜻하게 제공 → 한 단계 따뜻하게
 * - 생식·상온 → 고유 성질 그대로
 */
export function thermalShift(ctx: CookingContext, warmCookedShift: boolean): { shift: number; reason: string } {
  if (ctx.servingTemp === 'COLD') return { shift: -1, reason: '차갑게 제공' };
  if (ctx.servingTemp === 'HOT') return { shift: 1, reason: '뜨겁게 제공' };
  if (warmCookedShift && ctx.servingTemp === 'WARM' && isCooked(ctx)) return { shift: 1, reason: '익혀 따뜻하게' };
  return { shift: 0, reason: '' };
}

export function effectiveThermal(food: SasangFoodItem, ctx: CookingContext, warmCookedShift = true): ThermalNature {
  const idx = THERMAL_ORDER.indexOf(food.thermalNature) + thermalShift(ctx, warmCookedShift).shift;
  return THERMAL_ORDER[Math.max(0, Math.min(THERMAL_ORDER.length - 1, idx))]!;
}

export function verdictOf(score: number, blocked: boolean): Verdict {
  if (blocked) return 'BLOCKED';
  if (score >= VERDICT_THRESHOLDS.BEST) return 'BEST';
  if (score >= VERDICT_THRESHOLDS.GOOD) return 'GOOD';
  if (score >= VERDICT_THRESHOLDS.CAUTION) return 'CAUTION';
  return 'AVOID';
}

/** 식재료를 처음 조회할 때 쓰는 기본 조리 맥락 */
export function defaultContext(food: SasangFoodItem): CookingContext {
  switch (food.category) {
    case 'FRUIT':
    case 'DAIRY':
      return { method: 'AS_IS', warmSeasoning: false, servingTemp: 'ROOM' };
    case 'TEA_SPICE':
      return { method: 'AS_IS', warmSeasoning: false, servingTemp: 'HOT' };
    case 'BEVERAGE':
      return {
        method: 'AS_IS',
        warmSeasoning: false,
        servingTemp: food.id === 'cold_water' ? 'COLD' : 'WARM',
      };
    default:
      return { method: 'STEAMED', warmSeasoning: false, servingTemp: 'WARM' };
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 사상체질 규칙 엔진 — 식재료 1개 × 조리 맥락 × 사용자 프로필 → 점수/판정/근거.
 *
 * 평가 순서
 *  R0  체질 적합도 기본점
 *  G1  카페인 전역 금기 (양약 복용 또는 부교감 저하)
 *  G2  자몽류 전역 금기 (양약 복용)
 *  G3  양약 상호작용 위험 식품 차단 (양약 복용)
 *  G-DRUG 약물 사전 규칙 (BLOCK 차단 / CAUTION 주의)
 *  G-CAP 차단은 아니지만 주의 필요 → '주의' 구간 고정
 *  R1  병리 상태 차단 태그 (기체증: 인삼·홍삼)
 *  T   실효 한열 가중
 *  Q   순기 점수 가중 (기체증 ×2)
 *  E   천연 소화효소 (기체증 ×1.5)
 *  V   점성 페널티 (기체증: 4 이상)
 *  TG  체질·병리 태그 가중
 *  R2  조리법 보정: 생식 감점 / 화식+온열양념 가점 / 튀김 감점
 */
export function scoreFood(food: SasangFoodItem, ctx: CookingContext, profile: UserProfile): FoodScore {
  const spec = CONSTITUTION_MATRIX[profile.constitution];
  const sub = SUB_CONDITION_SPECS[profile.subCondition];
  const w = spec.weights;
  const meds = profile.autonomicStatus.takingWesternMeds;
  const paraLow = profile.autonomicStatus.parasympatheticLow;
  const hits: RuleHit[] = [];
  let blocked = false;
  const block = (ruleId: string, label: string) => {
    blocked = true;
    hits.push({ ruleId, label, delta: 0, block: true });
  };
  const add = (ruleId: string, label: string, delta: number) => {
    const d = round1(delta);
    if (d !== 0) hits.push({ ruleId, label, delta: d });
  };

  const suit = food.suitabilityByType[profile.constitution];
  hits.push({ ruleId: 'R0', label: `${spec.label} 적합도 ${SUIT_LABEL[suit]}`, delta: BASE_SCORE[suit] });

  // ── 전역 가드 ──────────────────────────────────────
  // D3: 약을 먹는 동안(자몽) / 약을 먹거나 부교감이 저하된 동안(카페인)만 차단. 아니면 '주의'
  let cautionReason: string | null = null;
  if (food.tags.includes('CAFFEINE')) {
    if (meds || paraLow) block('G1', '카페인 금기: 교감신경 항진·약물 대사 교란');
    else {
      add('G1', '카페인: 자율신경 자극', -10);
      cautionReason = '카페인(복약·부교감 저하 없음)';
    }
  }
  if (food.tags.includes('GRAPEFRUIT')) {
    if (meds) block('G2', '자몽류 금기: CYP3A4 억제로 약 농도 상승');
    else {
      add('G2', '자몽류: 복약을 시작하면 금기로 바뀝니다', -5);
      cautionReason = '자몽류(복약 없음)';
    }
  }
  if (meds && food.clinicalProperties.medInteractionRisk && !blocked) {
    block('G3', '양약 상호작용 위험 식품');
  }

  // H6 약물 사전 (D5)
  const drugNotes = drugNotesFor(profile, food);
  for (const n of drugNotes) {
    const tail = n.verified ? '' : ' · 약사 확인 필요';
    if (n.rule === 'BLOCK') block('G-DRUG', `${n.drugName}(${n.ingredient}) 금기: ${n.reason}${tail}`);
    else if (n.rule === 'CAUTION') cautionReason = `${n.drugName}(${n.ingredient}) 병용 주의: ${n.reason}${tail}`;
  }

  // H8 술: 약 금기가 없어도 기체증·부교감 저하에서는 '주의'
  if (food.tags.includes('ALCOHOL') && !blocked && (profile.subCondition === 'QI_STAGNATION' || paraLow)) {
    cautionReason ??= '술: 기체증·부교감 저하에서 자율신경과 수면을 더 흐트러뜨림';
  }

  // ── 병리 상태 차단 ─────────────────────────────────
  const blockTag = sub.blockTags.find((t) => food.tags.includes(t));
  if (blockTag) block('R1', `${sub.label}: 기운을 끌어올리는 인삼·홍삼류 일시 차단`);

  // ── 한열 ───────────────────────────────────────────
  const eff = effectiveThermal(food, ctx, w.warmCookedShift);
  const thermalDelta = w.thermal[eff] * sub.multipliers.thermal;
  const why = thermalShift(ctx, w.warmCookedShift).reason;
  const thermalLabel =
    eff !== food.thermalNature
      ? `한열 ${THERMAL_LABEL[food.thermalNature]} → ${THERMAL_LABEL[eff]} (${why})`
      : `한열 ${THERMAL_LABEL[eff]}`;
  add('T', thermalLabel, thermalDelta);

  // ── 순기·소도 ──────────────────────────────────────
  const qi = food.clinicalProperties.qiMovingScore;
  const qiDelta = (qi - 2) * w.qiMovingPerPoint * sub.multipliers.qiMoving;
  add('Q', `순기 점수 ${qi}/5${sub.multipliers.qiMoving > 1 ? ` (${sub.label} ×${sub.multipliers.qiMoving})` : ''}`, qiDelta);

  if (food.clinicalProperties.digestiveEnzyme) {
    add('E', '천연 소화효소', w.enzymeBonus * sub.multipliers.enzyme);
  }

  const v = food.clinicalProperties.viscosity;
  if (sub.viscosity && v >= sub.viscosity.threshold) {
    add('V', `점성 ${v}/5: ${sub.label}에 정체 가중`, -(v - 3) * sub.viscosity.perPoint);
  }

  // ── 태그 가중 (체질 + 병리) ───────────────────────
  for (const tag of food.tags) {
    const cw = w.tagWeights[tag] ?? 0;
    const sw = sub.tagWeights[tag] ?? 0;
    if (cw) add('TG', `${spec.label} 가중: ${TAG_LABEL[tag] ?? tag}`, cw);
    if (sw) add('TG', `${sub.label} 가중: ${TAG_LABEL[tag] ?? tag}`, sw);
  }

  // ── 조리법 보정 (R2) ───────────────────────────────
  if (!NON_COOKING_CATEGORIES.includes(food.category)) {
    if (ctx.method === 'RAW') {
      const d = food.cookingModifier.rawPenalty * w.rawFactor * sub.multipliers.raw;
      add('R2', '생식(익히지 않음) 감점', d);
    } else if (ctx.method === 'DEEP_FRIED') {
      add('R2', '튀김: 기름이 위 배출을 늦춤', w.deepFriedPenalty);
    } else if (isCooked(ctx) && ctx.warmSeasoning) {
      const d = w.warmSeasoning === 'ITEM_BONUS' ? food.cookingModifier.warmCookedBonus : w.warmSeasoning;
      add('R2', d >= 0 ? '화식 + 온열 양념(생강·마늘·들기름)' : '열성 양념(생강·마늘·고추) 감점', d);
    }
  }

  const raw = hits.reduce((s, h) => s + h.delta, 0);
  let score = Math.max(0, Math.min(100, Math.round(raw)));

  // 차단은 아니지만 주의가 필요한 항목은 판정을 '주의' 구간에 고정한다
  if (!blocked && cautionReason) {
    const lo = VERDICT_THRESHOLDS.CAUTION;
    const hi = VERDICT_THRESHOLDS.GOOD - 1;
    const clamped = Math.max(lo, Math.min(hi, score));
    hits.push({ ruleId: 'G-CAP', label: `${cautionReason} → 판정을 '주의'로 고정`, delta: clamped - score });
    score = clamped;
  }
  return {
    foodId: food.id,
    score,
    verdict: verdictOf(score, blocked),
    blocked,
    effectiveThermal: eff,
    hits,
    drugNotes,
    needsVerification: drugNotes.some((n) => !n.verified),
  };
}

export const TAG_LABEL: Partial<Record<string, string>> = {
  SODO: '소도(식적 해소)',
  SWEET_CLOYING: '단맛 정체(甘令人中滿)',
  FATTY: '고지방',
  LEAN_PROTEIN: '담백한 단백질',
  CLEARING_HEAT: '청열',
  NOURISH_YIN: '보음',
  DISCHARGING: '발산·배출',
  SPICY: '매운맛',
  SUGAR: '당분',
  GLUTINOUS: '찰기',
  SHELLFISH: '어패류',
  WARMING_SEASONING: '온열 양념',
};
