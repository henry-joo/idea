import type { FoodTag, ThermalNature } from '../food/types';
import type { Constitution, SubCondition } from '../profile/types';

/** 식판 반찬의 조리·구성 특성 */
export type DishTag =
  | 'RICE'
  | 'WARM_SOUP'
  | 'COOKED_NAMUL'
  | 'TOFU'
  | 'EGG'
  | 'FISH'
  | 'RADISH'
  | 'PORK'
  | 'FRIED'
  | 'PAN_FRIED'
  | 'RAW_SALAD'
  | 'NOODLE'
  | 'SPICY_HEAVY'
  | 'SWEET_SAUCE'
  | 'FATTY'
  | 'GLUTINOUS'
  | 'COLD_DISH'
  | 'FERMENTED'
  | 'DESSERT';

/**
 * 체질별 규칙 엔진 가중치. 명세 §4 매트릭스의 "식단 알고리즘 가중치" 열을 수치화한 것.
 * 점수 = 적합도 기본점 + Σ(가중치) → 0~100 클램프 (scoring/engine.ts 참조)
 */
export interface ConstitutionWeights {
  /** 실효 한열(조리·온도 보정 후)에 대한 가감점 */
  thermal: Record<ThermalNature, number>;
  /**
   * 익혀서 따뜻하게 먹으면 실효 한열을 한 단계 올리는가.
   * 비위가 찬 소음인에게만 의미가 있다. 열 체질은 뜨겁게/차게 제공할 때만 보정한다.
   */
  warmCookedShift: boolean;
  /** 순기 점수 1점당 가중 (2점을 중립으로 본다) */
  qiMovingPerPoint: number;
  /** 천연 소화효소 보유 시 */
  enzymeBonus: number;
  /** 생식 감점 배율 (식재료 rawPenalty × 배율). 소음인 1.0 = -25 */
  rawFactor: number;
  /**
   * 화식 + 온열양념 조합 보정.
   * 'ITEM_BONUS'면 식재료의 warmCookedBonus(+20)를 그대로 쓴다(소음인).
   * 숫자면 그 값을 쓴다(소양·태양인은 열성 양념 감점).
   */
  warmSeasoning: 'ITEM_BONUS' | number;
  /** 튀김 감점 */
  deepFriedPenalty: number;
  /** 식재료 태그 가중 */
  tagWeights: Partial<Record<FoodTag, number>>;
}

export interface CafeteriaPolicy {
  /** 담을 반찬 가산점 */
  takeBonus: Partial<Record<DishTag, number>>;
  /** 무조건 거르는 반찬 (하드 룰) */
  hardSkip: DishTag[];
  /** 거르는 쪽으로 미는 감점 */
  penalty: Partial<Record<DishTag, number>>;
  /** 밥 선택 안내 */
  riceGuide: string;
}

export interface ConstitutionSpec {
  id: Constitution;
  label: string;
  hanja: string;
  organ: string;
  status: 'DEFAULT' | 'EXTENSIBLE';
  pathology: string;
  weightLegend: string[];
  keyFoods: string[];
  cautionFoods: string[];
  defaultSubCondition: SubCondition;
  weights: ConstitutionWeights;
  cafeteria: CafeteriaPolicy;
  /** 야식 퍼널 Step 1의 따뜻한 음료 (food id) */
  nightDrinkId: string;
  /** 야식 퍼널 Step 3 대체식 후보 (night dish id) */
  nightSubstituteIds: string[];
}

export const CONSTITUTION_MATRIX: Record<Constitution, ConstitutionSpec> = {
  SOEUM: {
    id: 'SOEUM',
    label: '소음인',
    hanja: '少陰人',
    organ: '신대비소 (腎大脾小)',
    status: 'DEFAULT',
    pathology: '비위허한, 기체증(명치 막힘), 자율신경 실조',
    weightLegend: ['온열(+)', '순기/효소(++)', '저점성(+)', '생식/냉식(--)'],
    keyFoods: ['쌀(진밥·누룽지)', '닭고기', '황태', '익힌 무', '진피', '생강', '부추', '마', '사과'],
    cautionFoods: ['돼지고기', '밀가루', '보리', '찬물', '참외·수박', '(기체 시) 인삼·홍삼·찰떡'],
    defaultSubCondition: 'QI_STAGNATION',
    weights: {
      thermal: { HOT: 6, WARM: 8, NEUTRAL: 0, COOL: -12, COLD: -22 },
      warmCookedShift: true,
      qiMovingPerPoint: 3,
      enzymeBonus: 6,
      rawFactor: 1,
      warmSeasoning: 'ITEM_BONUS',
      deepFriedPenalty: -15,
      tagWeights: { FATTY: -5, LEAN_PROTEIN: 4 },
    },
    cafeteria: {
      takeBonus: { COOKED_NAMUL: 6, TOFU: 4, EGG: 4, FISH: 4, WARM_SOUP: 8, RADISH: 4 },
      hardSkip: ['PORK', 'FRIED', 'RAW_SALAD', 'NOODLE'],
      penalty: { SPICY_HEAVY: -15, SWEET_SAUCE: -6, PAN_FRIED: -10, COLD_DISH: -15, FATTY: -6 },
      riceGuide: '백미 진밥. 잡곡·보리밥이면 반만, 찰밥은 기체증 동안 거르기',
    },
    nightDrinkId: 'jinpi_tea',
    nightSubstituteIds: ['night_nurungji', 'night_egg_steam', 'night_soft_tofu', 'night_ma_juk'],
  },
  SOYANG: {
    id: 'SOYANG',
    label: '소양인',
    hanja: '少陽人',
    organ: '비대신소 (脾大腎小)',
    status: 'EXTENSIBLE',
    pathology: '위열 과다, 음허화동, 조급증, 변비',
    weightLegend: ['청열/보음(++)', '서늘한 성질(+)', '열성/매운맛(--)'],
    keyFoods: ['보리', '팥', '녹두', '돼지고기', '오리고기', '흰살생선', '오이', '상추', '양배추', '수박', '구기자'],
    cautionFoods: ['닭고기', '인삼·홍삼', '생강', '마늘', '고추', '카레', '꿀'],
    defaultSubCondition: 'HEAT_EXCESS',
    weights: {
      thermal: { HOT: -22, WARM: -10, NEUTRAL: 0, COOL: 8, COLD: 4 },
      warmCookedShift: false,
      qiMovingPerPoint: 1,
      enzymeBonus: 3,
      rawFactor: 0,
      warmSeasoning: -12,
      deepFriedPenalty: -10,
      tagWeights: { CLEARING_HEAT: 12, NOURISH_YIN: 8, SPICY: -12, SUGAR: -4 },
    },
    cafeteria: {
      takeBonus: { COOKED_NAMUL: 4, RAW_SALAD: 6, FISH: 4, TOFU: 4, PORK: 4 },
      hardSkip: ['SPICY_HEAVY', 'FRIED'],
      penalty: { FATTY: -6, SWEET_SAUCE: -4 },
      riceGuide: '보리밥·잡곡밥 좋음. 맵게 비비지 않기',
    },
    nightDrinkId: 'barley_tea',
    nightSubstituteIds: ['night_soft_tofu', 'night_mung_bean_juk', 'night_egg_steam', 'night_nurungji'],
  },
  TAEEUM: {
    id: 'TAEEUM',
    label: '태음인',
    hanja: '太陰人',
    organ: '간대폐소 (肝大肺小)',
    status: 'EXTENSIBLE',
    pathology: '간열·폐건조, 대사증후군, 과식·폭식, 혈액순환 정체',
    weightLegend: ['발산/배출(++)', '고단백/저탄수(+)', '기름진 음식(--)'],
    keyFoods: ['율무', '콩·두부', '소고기', '미역·김', '무', '도라지', '더덕', '연근', '버섯', '매실', '배'],
    cautionFoods: ['닭고기', '돼지고기(과량)', '달걀노른자', '사과', '밀가루 폭식', '고지방 야식'],
    defaultSubCondition: 'METABOLIC_STASIS',
    weights: {
      thermal: { HOT: -6, WARM: 0, NEUTRAL: 0, COOL: 2, COLD: -4 },
      warmCookedShift: false,
      qiMovingPerPoint: 1,
      enzymeBonus: 3,
      rawFactor: 0.3,
      warmSeasoning: 0,
      deepFriedPenalty: -18,
      tagWeights: { DISCHARGING: 12, LEAN_PROTEIN: 6, FATTY: -15, SUGAR: -8, GLUTINOUS: -4 },
    },
    cafeteria: {
      takeBonus: { WARM_SOUP: 4, TOFU: 6, COOKED_NAMUL: 4, RADISH: 6 },
      hardSkip: ['FRIED'],
      penalty: { FATTY: -12, NOODLE: -6, SWEET_SAUCE: -8, GLUTINOUS: -6, PAN_FRIED: -6 },
      riceGuide: '현미·율무 섞은 잡곡밥 2/3 공기. 밥보다 단백질·채소 먼저',
    },
    nightDrinkId: 'warm_water',
    nightSubstituteIds: ['night_tofu_plain', 'night_seaweed_soup', 'night_egg_steam', 'night_soft_tofu'],
  },
  TAEYANG: {
    id: 'TAEYANG',
    label: '태양인',
    hanja: '太陽人',
    organ: '폐대간소 (肺大肝小)',
    status: 'EXTENSIBLE',
    pathology: '간 기능 약화, 상열감, 구토(열격·반위), 하체 무력',
    weightLegend: ['담백/저지방(++)', '간 보음(+)', '고단백/고지방 육류(--)'],
    keyFoods: ['메밀', '새우', '조개', '굴', '게', '해삼', '푸른 채소', '포도', '키위', '모과차', '솔잎'],
    cautionFoods: ['기름진 육류(소·돼지·닭)', '설탕', '매운 양념', '고열량·고지방 식품'],
    defaultSubCondition: 'HEAT_EXCESS',
    weights: {
      thermal: { HOT: -18, WARM: -8, NEUTRAL: 0, COOL: 8, COLD: 4 },
      warmCookedShift: false,
      qiMovingPerPoint: 1,
      enzymeBonus: 3,
      rawFactor: 0,
      warmSeasoning: -12,
      deepFriedPenalty: -20,
      tagWeights: { NOURISH_YIN: 8, SHELLFISH: 6, FATTY: -20, SUGAR: -15, SPICY: -15 },
    },
    cafeteria: {
      takeBonus: { COOKED_NAMUL: 6, RAW_SALAD: 4, FISH: 4, TOFU: 2 },
      hardSkip: ['FRIED', 'FATTY', 'SPICY_HEAVY'],
      penalty: { PORK: -10, SWEET_SAUCE: -10, PAN_FRIED: -8 },
      riceGuide: '흰밥 반 공기 + 메밀·채소 위주. 육류 반찬은 거르기',
    },
    nightDrinkId: 'warm_water',
    nightSubstituteIds: ['night_buckwheat_jelly', 'night_clam_soup', 'night_soft_tofu', 'night_egg_steam'],
  },
};

/** 병리 상태(subCondition) 레이어. 체질 가중치 위에 덧씌운다. */
export interface SubConditionSpec {
  id: SubCondition;
  label: string;
  description: string;
  /** 이 상태에서 차단(BLOCK)하는 태그 */
  blockTags: FoodTag[];
  multipliers: { qiMoving: number; enzyme: number; thermal: number; raw: number };
  /** 점성 페널티: threshold 이상이면 (viscosity-3) × perPoint 감점 */
  viscosity: { threshold: number; perPoint: number } | null;
  tagWeights: Partial<Record<FoodTag, number>>;
}

export const SUB_CONDITION_SPECS: Record<SubCondition, SubConditionSpec> = {
  QI_STAGNATION: {
    id: 'QI_STAGNATION',
    label: '기체증 (명치 막힘)',
    description: '흉격만·심하비. 미주신경 저하로 위 상부가 굳고 유문이 닫혀 음식과 가스가 정체',
    blockTags: ['GINSENG'],
    multipliers: { qiMoving: 2, enzyme: 1.5, thermal: 1, raw: 1 },
    viscosity: { threshold: 4, perPoint: 8 },
    tagWeights: { SODO: 6, SWEET_CLOYING: -10 },
  },
  COLD_DEFICIENCY: {
    id: 'COLD_DEFICIENCY',
    label: '허한증 (냉·설사)',
    description: '비위가 차고 무력해 설사·복냉이 주증',
    blockTags: [],
    multipliers: { qiMoving: 1, enzyme: 1, thermal: 1.4, raw: 1.3 },
    viscosity: null,
    tagWeights: { WARMING_SEASONING: 4 },
  },
  HEAT_EXCESS: {
    id: 'HEAT_EXCESS',
    label: '열증 (상열·위열)',
    description: '위열·상열감, 갈증, 변비 경향',
    blockTags: [],
    multipliers: { qiMoving: 1, enzyme: 1, thermal: 1.3, raw: 1 },
    viscosity: null,
    tagWeights: { CLEARING_HEAT: 8, SPICY: -10 },
  },
  METABOLIC_STASIS: {
    id: 'METABOLIC_STASIS',
    label: '대사 정체 (습담·과식)',
    description: '과식·폭식, 체중 증가, 순환 정체',
    blockTags: [],
    multipliers: { qiMoving: 1, enzyme: 1, thermal: 1, raw: 1 },
    viscosity: { threshold: 4, perPoint: 4 },
    tagWeights: { DISCHARGING: 8, FATTY: -12, SUGAR: -10, GLUTINOUS: -6 },
  },
};
