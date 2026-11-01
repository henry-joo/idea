import { CONSTITUTION_MATRIX, type DishTag } from '../constitution/matrix';
import { getFood } from '../food/catalog';
import type { CookingContext } from '../food/types';
import type { UserProfile } from '../profile/types';
import { scoreFood, type FoodScore, type RuleHit } from './engine';

export type DishSlot = 'RICE' | 'SOUP' | 'MAIN' | 'SIDE' | 'KIMCHI' | 'DESSERT' | 'DRINK' | 'ONE_DISH';

export interface Dish {
  id: string;
  name: string;
  /** 메뉴판 문자열 매칭용 별칭 */
  aliases?: string[];
  slot: DishSlot;
  /** 주재료와 비중 (양념은 cooking.warmSeasoning으로 표현) */
  ingredients: { foodId: string; weight: number }[];
  cooking: CookingContext;
  tags: DishTag[];
  note?: string;
}

/** 식판 판정: 담기 / 조금만 / 거르기 / 차단 */
export type TrayVerdict = 'TAKE' | 'LITTLE' | 'SKIP' | 'BLOCKED';

export interface DishScore {
  dishId: string;
  score: number;
  verdict: TrayVerdict;
  hits: RuleHit[];
  ingredientScores: FoodScore[];
  /** 하드 룰로 걸러진 경우 그 태그 */
  hardSkipTag?: DishTag;
}

export const DISH_TAG_LABEL: Record<DishTag, string> = {
  RICE: '밥',
  WARM_SOUP: '따뜻한 국물',
  COOKED_NAMUL: '익힌 나물',
  TOFU: '두부',
  EGG: '계란',
  FISH: '생선',
  RADISH: '익힌 무',
  PORK: '돼지고기',
  FRIED: '튀김',
  PAN_FRIED: '전·부침',
  RAW_SALAD: '생야채·샐러드',
  NOODLE: '면류',
  SPICY_HEAVY: '자극적으로 매움',
  SWEET_SAUCE: '달고 끈적한 소스',
  FATTY: '기름진',
  GLUTINOUS: '찰기',
  COLD_DISH: '차가운 음식',
  FERMENTED: '젓갈·김치류',
  DESSERT: '후식',
};

export const TRAY_THRESHOLDS = { TAKE: 55, LITTLE: 35 } as const;

/**
 * 반찬 점수 = 주재료 점수 가중평균 + 체질별 식판 정책(가산·감점) → 하드 룰 적용.
 * 주재료 하나라도 BLOCKED면 반찬 전체 BLOCKED.
 */
export function scoreDish(dish: Dish, profile: UserProfile): DishScore {
  const policy = CONSTITUTION_MATRIX[profile.constitution].cafeteria;
  const ingredientScores = dish.ingredients.map((i) => scoreFood(getFood(i.foodId), dish.cooking, profile));
  const totalW = dish.ingredients.reduce((s, i) => s + i.weight, 0) || 1;
  const avg = dish.ingredients.reduce((s, i, idx) => s + i.weight * ingredientScores[idx]!.score, 0) / totalW;

  const hits: RuleHit[] = [{ ruleId: 'D0', label: '주재료 가중평균', delta: Math.round(avg) }];
  const blockedIng = ingredientScores.find((s) => s.blocked);
  if (blockedIng) {
    const reason = blockedIng.hits.find((h) => h.block)?.label ?? '차단 식재료 포함';
    hits.push({ ruleId: 'D-BLOCK', label: `${getFood(blockedIng.foodId).name}: ${reason}`, delta: 0, block: true });
    return { dishId: dish.id, score: 0, verdict: 'BLOCKED', hits, ingredientScores };
  }

  for (const tag of dish.tags) {
    const b = policy.takeBonus[tag];
    const p = policy.penalty[tag];
    if (b) hits.push({ ruleId: 'D+', label: `담을 반찬: ${DISH_TAG_LABEL[tag]}`, delta: b });
    if (p) hits.push({ ruleId: 'D-', label: `거를 쪽: ${DISH_TAG_LABEL[tag]}`, delta: p });
  }

  const score = Math.max(0, Math.min(100, Math.round(hits.reduce((s, h) => s + h.delta, 0))));
  const hardSkipTag = policy.hardSkip.find((t) => dish.tags.includes(t));
  if (hardSkipTag) {
    hits.push({ ruleId: 'D-HARD', label: `${DISH_TAG_LABEL[hardSkipTag]} 반찬 → 거르기 (하드 룰)`, delta: 0, block: true });
    return { dishId: dish.id, score, verdict: 'SKIP', hits, ingredientScores, hardSkipTag };
  }

  const verdict: TrayVerdict = score >= TRAY_THRESHOLDS.TAKE ? 'TAKE' : score >= TRAY_THRESHOLDS.LITTLE ? 'LITTLE' : 'SKIP';
  return { dishId: dish.id, score, verdict, hits, ingredientScores };
}
