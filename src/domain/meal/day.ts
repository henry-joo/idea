import type { DishTag } from '../constitution/matrix';
import { evaluateTray, type MealSlot, type TrayFinal, type TrayItem } from '../cafeteria/tray';
import type { UserProfile } from '../profile/types';

/**
 * 오늘 먹은 아침·점심을 평가하고, 그 결과로 저녁이 어때야 하는지 정한다.
 * 흐름: 입력(먹은 것) → 평가(끼니별 등급·반찬별 한 줄) → 저녁 맞춤(DinnerContext).
 */

export type EatenSlot = Extract<MealSlot, 'BREAKFAST' | 'LUNCH'>;

/** 한 끼 입력. 안 먹었으면 skipped, 먹었으면 반찬을 쉼표·줄바꿈으로 */
export interface MealEntry {
  text: string;
  skipped: boolean;
}
export interface DayMeals {
  breakfast: MealEntry;
  lunch: MealEntry;
}
export const EMPTY_ENTRY: MealEntry = { text: '', skipped: false };
export const emptyDayMeals = (): DayMeals => ({ breakfast: { ...EMPTY_ENTRY }, lunch: { ...EMPTY_ENTRY } });

/** 먹은 뒤의 평가 표현. 먹기 전 판정(담기·거르기)과 말이 다르다 */
export type EatenLabel = 'GOOD' | 'OK' | 'PITY' | 'AVOID' | 'OVERLAP';
export const EATEN_LABEL_TEXT: Record<EatenLabel, string> = {
  GOOD: '좋아요',
  OK: '무난',
  PITY: '아쉬워요',
  AVOID: '피할 것',
  OVERLAP: '시간 겹침',
};
const LABEL_OF: Record<TrayFinal, EatenLabel> = { TAKE: 'GOOD', LITTLE: 'OK', SKIP: 'PITY', BLOCKED: 'AVOID', HOLD: 'OVERLAP' };

export interface EatenItem {
  name: string;
  label: EatenLabel;
  reason: string;
  inferred: boolean;
  item: TrayItem;
}

export type MealGrade = 'GOOD' | 'OK' | 'CAUTION';
export const GRADE_TEXT: Record<MealGrade, string> = { GOOD: '좋은 한 끼', OK: '무난한 한 끼', CAUTION: '부담될 수 있는 한 끼' };

export interface MealEvaluation {
  slot: EatenSlot;
  skipped: boolean;
  /** 입력이 비어 있고 거르지도 않았음 */
  empty: boolean;
  items: EatenItem[];
  unknown: string[];
  grade: MealGrade | null;
  summary: string;
}

/**
 * 규칙 엔진의 근거(한열·화식 같은 용어)를 일상 말 한 줄로 바꾼다.
 * 좋은 반찬은 이유를 생략하고(빈 문자열), 아쉬운 반찬은 무엇이 문제인지만 말한다.
 */
export function plainReason(it: TrayItem): string {
  const t = it.dish.tags;
  switch (it.final) {
    case 'TAKE':
      return '';
    case 'HOLD':
      return `복약 시간과 겹쳐요${it.holdUntil ? ` (${it.holdUntil} 이후 가능)` : ''}`;
    case 'LITTLE':
      if (t.includes('KIMCHI')) return '2~3조각만 드세요';
      return t.includes('RICE') ? '흰 진밥이 속에 더 편해요' : '많이 먹기엔 아쉬워요';
    default:
      break;
  }
  if (t.includes('SOUR_KIMCHI')) return '신김치·찬 김치는 속을 차게 해요';
  if (t.includes('FRIED')) return '튀김은 소화가 오래 걸려요';
  if (t.includes('PORK')) return '돼지고기는 속이 더부룩하기 쉬워요';
  if (t.includes('RAW_SALAD')) return '찬 생채소는 속을 식혀요';
  if (t.includes('NOODLE')) return '밀가루 면은 소화에 부담이에요';
  if (t.includes('SPICY_HEAVY')) return '많이 매워서 속이 쓰릴 수 있어요';
  if (t.includes('GLUTINOUS')) return '찰기가 강해 소화가 느려요';
  if (t.includes('SWEET_SAUCE')) return '달고 끈적한 양념이에요';
  const allHits = [...it.result.hits, ...it.result.ingredientScores.flatMap((s) => s.hits)];
  if (allHits.some((h) => h.ruleId === 'G-CAP')) return '약·컨디션 때문에 가급적 피하세요';
  if (allHits.some((h) => h.ruleId === 'T' && h.delta < 0 && (h.label.includes('한(寒)') || h.label.includes('량(涼)')))) return '차가운 성질이라 속을 식혀요';
  if (it.final === 'BLOCKED') return '지금은 드시지 않는 게 좋아요';
  return it.headline;
}

const names = (xs: EatenItem[], max = 3) => {
  const n = [...new Set(xs.map((x) => x.name))];
  return n.slice(0, max).join('·') + (n.length > max ? ' 등' : '');
};

export function evaluateEaten(entry: MealEntry, slot: EatenSlot, profile: UserProfile): MealEvaluation {
  const base = { slot, unknown: [] as string[], items: [] as EatenItem[] };
  if (entry.skipped) return { ...base, skipped: true, empty: false, grade: null, summary: '거르셨어요' };
  if (!entry.text.trim()) return { ...base, skipped: false, empty: true, grade: null, summary: '' };

  const plan = evaluateTray({ menuText: entry.text, meal: slot, profile });
  const items: EatenItem[] = plan.items.map((i) => ({
    name: i.dish.name,
    label: LABEL_OF[i.final],
    reason: plainReason(i),
    inferred: i.source === 'INFERRED',
    item: i,
  }));
  if (items.length === 0) return { slot, skipped: false, empty: false, items, unknown: plan.unknown, grade: null, summary: '알아본 반찬이 없어요. 반찬 이름을 쉼표로 적어 주세요.' };

  const bad = items.filter((x) => x.label === 'PITY' || x.label === 'AVOID');
  const good = items.filter((x) => x.label === 'GOOD');
  const hasBlock = items.some((x) => x.label === 'AVOID');
  let grade: MealGrade;
  if (hasBlock || bad.length / items.length >= 0.4) grade = 'CAUTION';
  else if (bad.length === 0 && good.length / items.length >= 0.5) grade = 'GOOD';
  else grade = 'OK';

  const summary =
    grade === 'GOOD'
      ? '속이 편한 구성이에요'
      : grade === 'OK'
        ? bad.length
          ? `대체로 무난해요. ${names(bad)}는 아쉬웠어요`
          : '무난해요'
        : `${names(bad)}가 부담될 수 있어요`;
  return { slot, skipped: false, empty: false, items, unknown: plan.unknown, grade, summary };
}

// ── 저녁 맞춤 ───────────────────────────────────────────

export interface DayFlags {
  cold: string[];
  oily: string[];
  flour: string[];
  spicy: string[];
  hasProtein: boolean;
  hasCookedVeg: boolean;
  hasWarmSoup: boolean;
  skipped: EatenSlot[];
  /** 입력이 있는 끼니 수 */
  entered: number;
  eatenProteinIds: string[];
  eatenDishIds: string[];
}

const PROTEIN_FOODS = ['chicken', 'beef_lean', 'duck', 'pork', 'processed_pork', 'hwangtae', 'white_fish', 'croaker', 'mackerel', 'anchovy', 'egg', 'tofu', 'soft_tofu', 'shrimp', 'squid', 'clam'];
const has = (tags: DishTag[], ...any: DishTag[]) => any.some((t) => tags.includes(t));
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

export function dayFlags(evals: MealEvaluation[]): DayFlags {
  const f: DayFlags = { cold: [], oily: [], flour: [], spicy: [], hasProtein: false, hasCookedVeg: false, hasWarmSoup: false, skipped: [], entered: 0, eatenProteinIds: [], eatenDishIds: [] };
  for (const e of evals) {
    if (e.skipped) f.skipped.push(e.slot);
    if (e.items.length) f.entered++;
    for (const { item, name } of e.items) {
      const d = item.dish;
      if (has(d.tags, 'COLD_DISH', 'RAW_SALAD') || d.cooking.servingTemp === 'COLD') f.cold.push(name);
      if (has(d.tags, 'PORK', 'FRIED', 'FATTY', 'PAN_FRIED')) f.oily.push(name);
      if (has(d.tags, 'NOODLE') || d.ingredients.some((i) => i.foodId === 'wheat' && i.weight >= 0.3)) f.flour.push(name);
      if (has(d.tags, 'SPICY_HEAVY')) f.spicy.push(name);
      if (has(d.tags, 'EGG', 'TOFU', 'FISH') || d.ingredients.some((i) => PROTEIN_FOODS.includes(i.foodId) && i.weight >= 0.3)) f.hasProtein = true;
      if (has(d.tags, 'COOKED_NAMUL')) f.hasCookedVeg = true;
      if (has(d.tags, 'WARM_SOUP', 'RADISH')) f.hasWarmSoup = true;
      for (const i of d.ingredients) if (PROTEIN_FOODS.includes(i.foodId) && i.weight >= 0.3) f.eatenProteinIds.push(i.foodId);
      f.eatenDishIds.push(d.id);
    }
  }
  f.cold = uniq(f.cold);
  f.oily = uniq(f.oily);
  f.flour = uniq(f.flour);
  f.spicy = uniq(f.spicy);
  f.eatenProteinIds = uniq(f.eatenProteinIds);
  f.eatenDishIds = uniq(f.eatenDishIds);
  return f;
}

export type PortionLevel = 'LIGHT' | 'NORMAL' | 'FULL';

export interface DinnerReason {
  /** 오늘 먹은 것에서 본 사실 */
  because: string;
  /** 그래서 저녁은 */
  therefore: string;
}

export interface DinnerContext {
  /** 입력이 하나도 없으면 false → 기본 추천 */
  filled: boolean;
  headline: string;
  reasons: DinnerReason[];
  portion: { level: PortionLevel; text: string };
  /** 저녁 후보 반찬에 줄 가산점(태그 기준) */
  wantTags: Partial<Record<DishTag, number>>;
  /** 오늘 이미 먹은 단백질 재료·반찬은 저녁에서 피한다 */
  avoidFoodIds: string[];
  avoidDishIds: string[];
  /** 익힌 채소가 없었으면 채소 반찬을 2가지 */
  extraVeggie: boolean;
  flags: DayFlags;
}

const PORTION_TEXT: Record<PortionLevel, string> = {
  LIGHT: '밥은 2/3공기, 국물과 건더기 위주로 가볍게',
  NORMAL: '밥은 평소 양(한 공기)',
  FULL: '밥 한 공기를 다 챙기세요. 저녁이 적으면 밤에 허기가 옵니다',
};

const add = (m: DinnerContext['wantTags'], tag: DishTag, n: number) => {
  m[tag] = (m[tag] ?? 0) + n;
};

/** 오늘 먹은 아침·점심 평가를 보고 저녁의 방향을 정한다 */
export function buildDinnerContext(profile: UserProfile, evals: MealEvaluation[]): DinnerContext {
  const flags = dayFlags(evals);
  const filled = flags.entered > 0 || flags.skipped.length > 0;
  const want: DinnerContext['wantTags'] = {};
  const reasons: DinnerReason[] = [];
  const adverbs: string[] = [];
  const soeum = profile.constitution === 'SOEUM';
  let level: PortionLevel = 'NORMAL';

  if (!filled) {
    return {
      filled,
      headline: '아침·점심을 적으면 오늘 먹은 것에 맞춰 저녁을 정해 드려요',
      reasons: [],
      portion: { level, text: PORTION_TEXT.NORMAL },
      wantTags: {},
      avoidFoodIds: [],
      avoidDishIds: [],
      extraVeggie: false,
      flags,
    };
  }

  if (soeum && flags.cold.length) {
    reasons.push({ because: `${flags.cold.slice(0, 2).join('·')} 같은 찬 음식을 드셨어요`, therefore: '따뜻한 국물로 속을 데워 주세요' });
    add(want, 'WARM_SOUP', 12);
    add(want, 'RADISH', 6);
    adverbs.push('따뜻하게');
  }
  if (flags.oily.length) {
    reasons.push({ because: `${flags.oily.slice(0, 2).join('·')} 같은 기름진 반찬이 있었어요`, therefore: '담백한 생선·두부와 익힌 무로 소화를 도와요' });
    add(want, 'RADISH', 10);
    add(want, 'FISH', 8);
    add(want, 'TOFU', 8);
    adverbs.push('담백하게');
    level = 'LIGHT';
  }
  if (flags.spicy.length) {
    reasons.push({ because: `${flags.spicy[0]}처럼 매운 반찬을 드셨어요`, therefore: '맵지 않은 순한 국으로 마무리해요' });
    add(want, 'WARM_SOUP', 6);
    adverbs.push('순하게');
  }
  if (flags.flour.length) {
    reasons.push({ because: `${flags.flour[0]} 같은 밀가루 음식을 드셨어요`, therefore: '저녁은 밥 중심으로 먹고 면·빵은 쉬어요' });
    add(want, 'RADISH', 6);
    adverbs.push('밥 위주로');
    level = 'LIGHT';
  }
  if (flags.entered > 0 && !flags.hasProtein) {
    reasons.push({ because: '오늘 단백질 반찬이 적었어요', therefore: '계란·두부·생선 중 하나는 꼭 넣어요' });
    add(want, 'EGG', 12);
    add(want, 'TOFU', 12);
    add(want, 'FISH', 12);
    adverbs.push('단백질을 챙겨서');
  }
  if (flags.entered > 0 && !flags.hasCookedVeg) {
    reasons.push({ because: '익힌 채소가 거의 없었어요', therefore: '나물 반찬을 두 가지로 늘려요' });
  }
  if (flags.skipped.length) {
    const which = flags.skipped.map((s) => (s === 'BREAKFAST' ? '아침' : '점심')).join('·');
    reasons.push({ because: `${which}을 거르셨어요`, therefore: '저녁을 든든히 먹어야 밤 허기를 막아요' });
    add(want, 'EGG', 8);
    add(want, 'TOFU', 8);
    add(want, 'FISH', 8);
    add(want, 'WARM_SOUP', 6);
    adverbs.push('든든하게');
    level = flags.oily.length || flags.flour.length ? 'NORMAL' : 'FULL';
  }

  const warn = reasons.length;
  const headline = warn === 0 ? '오늘 잘 드셨어요. 평소 저녁으로 충분해요' : `저녁은 ${adverbs.slice(0, 3).join(', ')} 드세요`;

  // 오늘 이미 먹은 단백질과 반찬은 저녁에서 피한다(같은 걸 두 번 먹지 않기)
  const avoidFoodIds = flags.eatenProteinIds;
  const repeated = flags.eatenProteinIds.length > 0;
  if (repeated && warn > 0) reasons.push({ because: '오늘 먹은 단백질 재료가 있어요', therefore: '저녁은 다른 재료로 골랐어요' });

  return {
    filled,
    headline,
    reasons,
    portion: { level, text: PORTION_TEXT[level] },
    wantTags: want,
    avoidFoodIds,
    avoidDishIds: flags.eatenDishIds,
    extraVeggie: flags.entered > 0 && !flags.hasCookedVeg,
    flags,
  };
}
