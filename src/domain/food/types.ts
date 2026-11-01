import type { Constitution } from '../profile/types';

export type Suitability = 'BEST' | 'GOOD' | 'CAUTION' | 'AVOID';
export type ThermalNature = 'HOT' | 'WARM' | 'NEUTRAL' | 'COOL' | 'COLD';
export const THERMAL_ORDER: readonly ThermalNature[] = ['COLD', 'COOL', 'NEUTRAL', 'WARM', 'HOT'];

/**
 * 명세 §5-2 카테고리 + [확장] DAIRY, BEVERAGE.
 * 60분 세이프가드가 유제품을 따로 다루므로 유제품을 독립 카테고리로 둔다.
 */
export type FoodCategory = 'GRAIN' | 'MEAT_FISH' | 'VEGGIE' | 'FRUIT' | 'TEA_SPICE' | 'DAIRY' | 'BEVERAGE';

/**
 * [확장] 규칙 엔진이 참조하는 임상 태그.
 * 숫자형 속성(qiMovingScore 등)으로 표현되지 않는 성질만 태그로 둔다.
 */
export type FoodTag =
  | 'GINSENG' // 인삼·홍삼류: 기를 끌어올림 → 기체증 시 일시 차단
  | 'CAFFEINE' // 전역 금기
  | 'GRAPEFRUIT' // 전역 금기 (CYP3A4 억제)
  | 'HERBAL_TEA' // 복약 60분 창 제한 대상
  | 'SODO' // 소도(消導): 식적을 풀고 내려보냄 (누룽지·무·마)
  | 'SWEET_CLOYING' // 감미 정체(甘令人中滿): 대추·꿀 등 단맛이 명치를 더 막음
  | 'WARMING_SEASONING' // 생강·마늘·들기름·파 (조리 보정 판단용)
  | 'GLUTINOUS' // 찹쌀·떡
  | 'WHEAT'
  | 'PORK'
  | 'FATTY'
  | 'LEAN_PROTEIN'
  | 'SPICY'
  | 'SUGAR'
  | 'CLEARING_HEAT' // 청열
  | 'NOURISH_YIN' // 보음 (소양인 신음 / 태양인 간음)
  | 'DISCHARGING' // 발산·배출 (태음인)
  | 'SHELLFISH';

/** 명세 §5-2 SasangFoodItem (필드 그대로) + tags/note 확장 */
export interface SasangFoodItem {
  id: string;
  name: string;
  category: FoodCategory;
  suitabilityByType: Record<Constitution, Suitability>;
  thermalNature: ThermalNature;
  clinicalProperties: {
    qiMovingScore: number; // 1~5
    digestiveEnzyme: boolean;
    viscosity: number; // 1~5
    medInteractionRisk: boolean;
  };
  cookingModifier: {
    rawPenalty: number; // 소음인 기준 생식 감점 (음수)
    warmCookedBonus: number; // 소음인 기준 화식+온열양념 가점 (양수)
  };
  tags: FoodTag[];
  note?: string;
}

export type CookingMethod =
  | 'RAW' // 생식·샐러드
  | 'BLANCHED' // 데침·나물
  | 'STEAMED' // 찜
  | 'BOILED' // 삶기·죽
  | 'SOUP' // 국·탕·찌개
  | 'STIR_FRIED' // 볶음
  | 'BRAISED' // 조림
  | 'GRILLED' // 구이
  | 'PAN_FRIED' // 전·부침
  | 'DEEP_FRIED' // 튀김
  | 'AS_IS'; // 조리하지 않는 형태 그대로 (과일, 차, 음료)

export type ServingTemp = 'HOT' | 'WARM' | 'ROOM' | 'COLD';

export interface CookingContext {
  method: CookingMethod;
  /** 생강·마늘·들기름·파 등 온열 양념 사용 여부 */
  warmSeasoning: boolean;
  servingTemp: ServingTemp;
}

export const COOKED_METHODS: readonly CookingMethod[] = [
  'BLANCHED',
  'STEAMED',
  'BOILED',
  'SOUP',
  'STIR_FRIED',
  'BRAISED',
  'GRILLED',
  'PAN_FRIED',
];

/** 복약 60분 창에서 제한되는 섭취 분류 */
export type MedWindowClass = 'HERBAL_TEA' | 'DAIRY' | 'FRUIT';

export function medWindowClassOf(food: SasangFoodItem): MedWindowClass | null {
  if (food.tags.includes('HERBAL_TEA')) return 'HERBAL_TEA';
  if (food.category === 'DAIRY') return 'DAIRY';
  if (food.category === 'FRUIT') return 'FRUIT';
  return null;
}
