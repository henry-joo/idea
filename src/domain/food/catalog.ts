import type { FoodCategory, FoodTag, SasangFoodItem, Suitability, ThermalNature } from './types';

/**
 * 사상의학 식재료 마스터 DB.
 *
 * 적합도 표기 [소음, 소양, 태음, 태양] = B(BEST) G(GOOD) C(CAUTION) A(AVOID).
 * 사상 식품 분류는 문헌·임상가마다 차이가 있으므로, 이 표는 명세 §4 매트릭스를
 * 우선 기준으로 삼고 빈칸은 통용되는 분류로 채웠다. 근거가 엇갈리는 항목은 note에 남긴다.
 *
 * cookingModifier 기본값: 생식 -25 / 화식+온열양념 +20 (명세 §3-2).
 * 명세 §5-2 스키마 주석의 +15는 '화식 단독' 수준으로 보고, 임상 가드레일 §3-2의 +20을 채택했다.
 * 과일·차·유제품·음료는 조리 보정 대상이 아니므로 0.
 */

type S = 'B' | 'G' | 'C' | 'A';
const SUIT: Record<S, Suitability> = { B: 'BEST', G: 'GOOD', C: 'CAUTION', A: 'AVOID' };

interface Def {
  id: string;
  name: string;
  cat: FoodCategory;
  suit: `${S}${S}${S}${S}`;
  th: ThermalNature;
  qi: number;
  enz?: boolean;
  visc?: number;
  med?: boolean;
  tags?: FoodTag[];
  note?: string;
}

const NO_COOKING_MODIFIER: readonly FoodCategory[] = ['FRUIT', 'TEA_SPICE', 'DAIRY', 'BEVERAGE'];

function make(d: Def): SasangFoodItem {
  const [so, sy, te, ty] = d.suit.split('') as [S, S, S, S];
  const noMod = NO_COOKING_MODIFIER.includes(d.cat);
  return {
    id: d.id,
    name: d.name,
    category: d.cat,
    suitabilityByType: { SOEUM: SUIT[so], SOYANG: SUIT[sy], TAEEUM: SUIT[te], TAEYANG: SUIT[ty] },
    thermalNature: d.th,
    clinicalProperties: {
      qiMovingScore: d.qi,
      digestiveEnzyme: d.enz ?? false,
      viscosity: d.visc ?? 1,
      medInteractionRisk: d.med ?? false,
    },
    cookingModifier: noMod ? { rawPenalty: 0, warmCookedBonus: 0 } : { rawPenalty: -25, warmCookedBonus: 20 },
    tags: d.tags ?? [],
    ...(d.note ? { note: d.note } : {}),
  };
}

const DEFS: Def[] = [
  // ── 곡류·두류 (GRAIN) ────────────────────────────────
  { id: 'rice', name: '멥쌀(백미 진밥)', cat: 'GRAIN', suit: 'BGGG', th: 'NEUTRAL', qi: 2, visc: 2 },
  { id: 'nurungji', name: '누룽지', cat: 'GRAIN', suit: 'BGGG', th: 'WARM', qi: 3, visc: 1, tags: ['SODO'], note: '초미(焦米): 눌린 쌀은 식적을 내리는 소도 식품' },
  { id: 'glutinous_rice', name: '찹쌀(100% 찰밥)', cat: 'GRAIN', suit: 'GCGC', th: 'WARM', qi: 2, visc: 5, tags: ['GLUTINOUS'], note: '평소 소음인 식품이나 기체증에는 점성 때문에 감점' },
  { id: 'rice_cake', name: '떡·찰떡', cat: 'GRAIN', suit: 'GCCC', th: 'WARM', qi: 1, visc: 5, tags: ['GLUTINOUS'] },
  { id: 'millet', name: '차조', cat: 'GRAIN', suit: 'BCGC', th: 'WARM', qi: 2, visc: 3 },
  { id: 'potato', name: '감자', cat: 'GRAIN', suit: 'BGGC', th: 'NEUTRAL', qi: 2, visc: 2 },
  { id: 'wheat', name: '밀가루(면·빵)', cat: 'GRAIN', suit: 'AGGC', th: 'COOL', qi: 1, visc: 4, tags: ['WHEAT'], note: '태음인에겐 맞지만 폭식 주의' },
  { id: 'barley', name: '보리', cat: 'GRAIN', suit: 'ABGG', th: 'COOL', qi: 2, tags: ['CLEARING_HEAT'] },
  { id: 'buckwheat', name: '메밀', cat: 'GRAIN', suit: 'AGCB', th: 'COOL', qi: 3 },
  { id: 'coix', name: '율무', cat: 'GRAIN', suit: 'CGBG', th: 'COOL', qi: 2, tags: ['DISCHARGING'] },
  { id: 'red_bean', name: '팥', cat: 'GRAIN', suit: 'ABGG', th: 'NEUTRAL', qi: 2, tags: ['CLEARING_HEAT', 'DISCHARGING'] },
  { id: 'mung_bean', name: '녹두', cat: 'GRAIN', suit: 'ABGG', th: 'COLD', qi: 2, tags: ['CLEARING_HEAT'] },
  { id: 'tofu', name: '두부', cat: 'GRAIN', suit: 'GGBG', th: 'COOL', qi: 2, visc: 1, tags: ['LEAN_PROTEIN'] },
  { id: 'soft_tofu', name: '연두부', cat: 'GRAIN', suit: 'GGBG', th: 'COOL', qi: 2, visc: 1, tags: ['LEAN_PROTEIN'] },
  { id: 'glass_noodle', name: '당면', cat: 'GRAIN', suit: 'CGCC', th: 'COOL', qi: 1, visc: 3 },

  // ── 육류·어패류·알 (MEAT_FISH) ───────────────────────
  { id: 'chicken', name: '닭고기', cat: 'MEAT_FISH', suit: 'BACA', th: 'WARM', qi: 2 },
  { id: 'pork', name: '돼지고기', cat: 'MEAT_FISH', suit: 'ABCA', th: 'COOL', qi: 1, tags: ['PORK', 'FATTY', 'NOURISH_YIN'] },
  { id: 'processed_pork', name: '햄·소시지(가공육)', cat: 'MEAT_FISH', suit: 'ACCA', th: 'COOL', qi: 1, tags: ['PORK', 'FATTY'] },
  { id: 'beef_lean', name: '소고기(연한 살코기)', cat: 'MEAT_FISH', suit: 'GGBA', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'] },
  { id: 'duck', name: '오리고기', cat: 'MEAT_FISH', suit: 'CBCC', th: 'COOL', qi: 2, tags: ['NOURISH_YIN', 'FATTY'] },
  { id: 'hwangtae', name: '황태·북어', cat: 'MEAT_FISH', suit: 'BGGG', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'] },
  { id: 'white_fish', name: '흰살생선(대구·가자미·동태)', cat: 'MEAT_FISH', suit: 'GBGG', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'] },
  { id: 'croaker', name: '조기', cat: 'MEAT_FISH', suit: 'BGGG', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'] },
  { id: 'anchovy', name: '멸치', cat: 'MEAT_FISH', suit: 'GCGG', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'] },
  { id: 'mackerel', name: '고등어(등푸른생선)', cat: 'MEAT_FISH', suit: 'CGGC', th: 'NEUTRAL', qi: 2, tags: ['FATTY'] },
  { id: 'fish_cake', name: '어묵', cat: 'MEAT_FISH', suit: 'CCCC', th: 'NEUTRAL', qi: 1, visc: 3, tags: ['WHEAT'] },
  { id: 'egg', name: '계란', cat: 'MEAT_FISH', suit: 'GGCC', th: 'NEUTRAL', qi: 2, tags: ['LEAN_PROTEIN'], note: '태음인은 노른자 과다 주의' },
  { id: 'shrimp', name: '새우', cat: 'MEAT_FISH', suit: 'CGCB', th: 'WARM', qi: 2, tags: ['SHELLFISH'] },
  { id: 'clam', name: '조개·굴', cat: 'MEAT_FISH', suit: 'CBCB', th: 'COOL', qi: 2, tags: ['SHELLFISH', 'NOURISH_YIN'] },
  { id: 'crab', name: '게', cat: 'MEAT_FISH', suit: 'ABCB', th: 'COLD', qi: 2, tags: ['SHELLFISH', 'NOURISH_YIN'] },
  { id: 'sea_cucumber', name: '해삼', cat: 'MEAT_FISH', suit: 'CBCB', th: 'COOL', qi: 2, tags: ['NOURISH_YIN'] },
  { id: 'squid', name: '오징어·낙지', cat: 'MEAT_FISH', suit: 'CGCB', th: 'COOL', qi: 1 },

  // ── 채소·해조·버섯 (VEGGIE) ──────────────────────────
  { id: 'radish', name: '무', cat: 'VEGGIE', suit: 'GGBG', th: 'COOL', qi: 5, enz: true, tags: ['SODO', 'DISCHARGING'], note: '래복(萊菔): 기를 내리고 식적을 푼다. 효소 활성은 생무가 높지만 소음인은 익혀 먹는 쪽이 이득' },
  { id: 'chinese_yam', name: '마(산약)', cat: 'VEGGIE', suit: 'GGBG', th: 'NEUTRAL', qi: 2, enz: true, visc: 3, tags: ['SODO'], note: '분류상 태음인 약재지만 평(平)한 성질과 소화효소로 소음인 소도식에 활용' },
  { id: 'chive', name: '부추', cat: 'VEGGIE', suit: 'BACA', th: 'WARM', qi: 5, tags: ['WARMING_SEASONING'] },
  { id: 'minari', name: '미나리', cat: 'VEGGIE', suit: 'GGGB', th: 'COOL', qi: 4 },
  { id: 'perilla_leaf', name: '깻잎', cat: 'VEGGIE', suit: 'BCGC', th: 'WARM', qi: 4, note: '자소엽 계열: 행기관중(行氣寬中)' },
  { id: 'cabbage', name: '양배추', cat: 'VEGGIE', suit: 'GBGG', th: 'NEUTRAL', qi: 2 },
  { id: 'broccoli', name: '브로콜리', cat: 'VEGGIE', suit: 'GGGG', th: 'NEUTRAL', qi: 2 },
  { id: 'spinach', name: '시금치', cat: 'VEGGIE', suit: 'GGCG', th: 'COOL', qi: 2 },
  { id: 'bean_sprout', name: '콩나물·숙주', cat: 'VEGGIE', suit: 'GGBG', th: 'COOL', qi: 2 },
  { id: 'zucchini', name: '애호박·호박', cat: 'VEGGIE', suit: 'GCGC', th: 'WARM', qi: 2 },
  { id: 'mushroom', name: '버섯(표고·느타리)', cat: 'VEGGIE', suit: 'GGBG', th: 'NEUTRAL', qi: 2 },
  { id: 'carrot', name: '당근', cat: 'VEGGIE', suit: 'GCBC', th: 'NEUTRAL', qi: 2 },
  { id: 'cucumber', name: '오이', cat: 'VEGGIE', suit: 'ABCG', th: 'COLD', qi: 1, tags: ['CLEARING_HEAT'] },
  { id: 'lettuce', name: '상추', cat: 'VEGGIE', suit: 'CBGG', th: 'COOL', qi: 2, tags: ['CLEARING_HEAT'] },
  { id: 'napa_cabbage', name: '배추', cat: 'VEGGIE', suit: 'CBGB', th: 'COOL', qi: 2 },
  { id: 'doraji', name: '도라지', cat: 'VEGGIE', suit: 'CCBC', th: 'NEUTRAL', qi: 3, tags: ['DISCHARGING'] },
  { id: 'deodeok', name: '더덕', cat: 'VEGGIE', suit: 'CCBC', th: 'NEUTRAL', qi: 3, tags: ['DISCHARGING'] },
  { id: 'lotus_root', name: '연근', cat: 'VEGGIE', suit: 'GCBC', th: 'COOL', qi: 2, tags: ['DISCHARGING'] },
  { id: 'seaweed', name: '미역·김·다시마', cat: 'VEGGIE', suit: 'CGBG', th: 'COLD', qi: 2, tags: ['DISCHARGING'] },
  { id: 'mugwort', name: '쑥', cat: 'VEGGIE', suit: 'BACA', th: 'WARM', qi: 3 },

  // ── 과일 (FRUIT) ─────────────────────────────────────
  { id: 'apple', name: '사과', cat: 'FRUIT', suit: 'BCAC', th: 'NEUTRAL', qi: 2 },
  { id: 'tangerine', name: '귤', cat: 'FRUIT', suit: 'GCCC', th: 'WARM', qi: 3 },
  { id: 'jujube', name: '대추', cat: 'FRUIT', suit: 'BCCC', th: 'WARM', qi: 1, visc: 3, tags: ['SWEET_CLOYING'], note: '단맛이 중초를 막을 수 있어(甘令人中滿) 기체증엔 소량' },
  { id: 'peach', name: '복숭아', cat: 'FRUIT', suit: 'GCCC', th: 'WARM', qi: 2 },
  { id: 'grapefruit', name: '자몽', cat: 'FRUIT', suit: 'CCCC', th: 'COLD', qi: 2, med: true, tags: ['GRAPEFRUIT'], note: 'CYP3A4 억제: 여러 양약의 혈중농도를 올린다' },
  { id: 'watermelon', name: '수박', cat: 'FRUIT', suit: 'ABCG', th: 'COLD', qi: 1, tags: ['CLEARING_HEAT'] },
  { id: 'oriental_melon', name: '참외', cat: 'FRUIT', suit: 'ABCG', th: 'COLD', qi: 1, tags: ['CLEARING_HEAT'] },
  { id: 'pear', name: '배', cat: 'FRUIT', suit: 'CGBG', th: 'COOL', qi: 2 },
  { id: 'grape', name: '포도', cat: 'FRUIT', suit: 'CGGB', th: 'NEUTRAL', qi: 2 },
  { id: 'kiwi', name: '키위', cat: 'FRUIT', suit: 'CGCB', th: 'COLD', qi: 2, enz: true },
  { id: 'banana', name: '바나나', cat: 'FRUIT', suit: 'CGCC', th: 'COLD', qi: 1, visc: 3 },
  { id: 'persimmon', name: '감', cat: 'FRUIT', suit: 'CGCB', th: 'COLD', qi: 1 },

  // ── 차·향신료 (TEA_SPICE) ────────────────────────────
  { id: 'jinpi_tea', name: '진피차(귤피차)', cat: 'TEA_SPICE', suit: 'BCGC', th: 'WARM', qi: 5, tags: ['HERBAL_TEA'], note: '이기건비(理氣健脾): 소음인 기체증의 1순위 순기차' },
  { id: 'ginger', name: '생강', cat: 'TEA_SPICE', suit: 'BACA', th: 'WARM', qi: 4, tags: ['WARMING_SEASONING'] },
  { id: 'ginger_tea', name: '생강차', cat: 'TEA_SPICE', suit: 'BACA', th: 'WARM', qi: 4, tags: ['HERBAL_TEA', 'WARMING_SEASONING'] },
  { id: 'cinnamon_tea', name: '계피차', cat: 'TEA_SPICE', suit: 'BACA', th: 'HOT', qi: 3, tags: ['HERBAL_TEA'] },
  { id: 'garlic', name: '마늘', cat: 'TEA_SPICE', suit: 'GACA', th: 'HOT', qi: 3, tags: ['WARMING_SEASONING'] },
  { id: 'perilla_oil', name: '들기름', cat: 'TEA_SPICE', suit: 'GCGC', th: 'WARM', qi: 2, tags: ['WARMING_SEASONING'] },
  { id: 'chili', name: '고추·고춧가루', cat: 'TEA_SPICE', suit: 'GACA', th: 'HOT', qi: 2, tags: ['SPICY'], note: '소음인도 과량이면 위점막 자극' },
  { id: 'honey', name: '꿀', cat: 'TEA_SPICE', suit: 'GACA', th: 'WARM', qi: 1, visc: 4, tags: ['SWEET_CLOYING', 'SUGAR'] },
  { id: 'ginseng', name: '인삼', cat: 'TEA_SPICE', suit: 'BACA', th: 'WARM', qi: 1, med: true, tags: ['GINSENG'], note: '기를 끌어올리는 보기약: 명치가 막힌 상태에선 정체를 키운다' },
  { id: 'red_ginseng', name: '홍삼(고농축)', cat: 'TEA_SPICE', suit: 'BACA', th: 'WARM', qi: 1, med: true, tags: ['GINSENG'], note: '와파린·혈당강하제·일부 정신신경계 약과 상호작용 보고' },
  { id: 'goji_tea', name: '구기자차', cat: 'TEA_SPICE', suit: 'CBCG', th: 'NEUTRAL', qi: 1, tags: ['HERBAL_TEA', 'NOURISH_YIN'] },
  { id: 'coix_tea', name: '율무차(무가당)', cat: 'TEA_SPICE', suit: 'CGBG', th: 'COOL', qi: 2, tags: ['HERBAL_TEA', 'DISCHARGING'] },
  { id: 'quince_tea', name: '모과차', cat: 'TEA_SPICE', suit: 'CCCB', th: 'WARM', qi: 3, tags: ['HERBAL_TEA'] },
  { id: 'maesil_tea', name: '매실차', cat: 'TEA_SPICE', suit: 'GGBG', th: 'NEUTRAL', qi: 3, tags: ['HERBAL_TEA', 'SUGAR'] },
  { id: 'licorice_tea', name: '감초차', cat: 'TEA_SPICE', suit: 'GCCC', th: 'NEUTRAL', qi: 2, tags: ['HERBAL_TEA', 'LICORICE'], note: '감초는 장기·다량 복용 시 저칼륨혈증 우려(이뇨제·스테로이드 병용 주의)' },
  { id: 'coffee', name: '커피', cat: 'TEA_SPICE', suit: 'CCCC', th: 'WARM', qi: 2, med: true, tags: ['CAFFEINE'] },
  { id: 'green_tea', name: '녹차', cat: 'TEA_SPICE', suit: 'CCCC', th: 'COOL', qi: 2, med: true, tags: ['CAFFEINE'] },

  // ── 유제품 (DAIRY) ───────────────────────────────────
  { id: 'milk', name: '우유', cat: 'DAIRY', suit: 'CGGC', th: 'COOL', qi: 1, visc: 2 },
  { id: 'yogurt', name: '요구르트·요거트', cat: 'DAIRY', suit: 'CGGC', th: 'COOL', qi: 1, visc: 3, tags: ['SUGAR'] },

  // ── 음료 (BEVERAGE) ──────────────────────────────────
  { id: 'warm_water', name: '미온수', cat: 'BEVERAGE', suit: 'BBBB', th: 'NEUTRAL', qi: 2 },
  { id: 'cold_water', name: '찬물·얼음물', cat: 'BEVERAGE', suit: 'AGCG', th: 'COLD', qi: 1 },
  { id: 'barley_tea', name: '보리차', cat: 'BEVERAGE', suit: 'CBGG', th: 'COOL', qi: 2, note: '곡물차로 한방차 60분 제한 대상은 아님' },
  { id: 'alcohol', name: '술(소주·맥주·와인)', cat: 'BEVERAGE', suit: 'CCCC', th: 'WARM', qi: 1, tags: ['ALCOHOL'], note: '자율신경 실조·수면 질 저하, 다수의 신경계 약과 병용 주의' },
  { id: 'sungnyung', name: '숭늉(누룽지차)', cat: 'BEVERAGE', suit: 'BGGG', th: 'WARM', qi: 3, tags: ['SODO'] },
];

export const FOODS: readonly SasangFoodItem[] = DEFS.map(make);

const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: string): SasangFoodItem {
  const f = BY_ID.get(id);
  if (!f) throw new Error(`알 수 없는 식재료 id: ${id}`);
  return f;
}

export function findFood(id: string): SasangFoodItem | undefined {
  return BY_ID.get(id);
}
