import type { DishTag } from '../constitution/matrix';
import { getFood } from '../food/catalog';
import type { CookingMethod, ServingTemp } from '../food/types';
import type { Dish, DishSlot } from '../scoring/dish';
import { CAFETERIA_DISHES } from './dishes';

/**
 * 구내식당 메뉴판 문자열 → 반찬 목록.
 * 1) 카탈로그 정확 일치 → 2) 카탈로그 별칭 부분 일치(가장 긴 것) → 3) 키워드 추론 → 4) 판별 불가
 */

export type MatchSource = 'CATALOG' | 'INFERRED';

export interface ParsedMenuItem {
  raw: string;
  dish: Dish;
  source: MatchSource;
}

export interface ParsedMenu {
  items: ParsedMenuItem[];
  unknown: string[];
}

export function normalize(s: string): string {
  return s
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/[\s·・*#~]/g, '')
    .trim();
}

/** 쉼표·줄바꿈·슬래시·가운뎃점 우선, 구분자가 없으면 공백으로 나눈다 */
export function splitMenu(text: string): string[] {
  const hasDelims = /[,\n/|+、，;]/.test(text);
  const parts = hasDelims ? text.split(/[,\n/|+、，;]+/) : text.split(/\s+/);
  return parts.map((p) => p.trim()).filter((p) => normalize(p).length > 0);
}

const CATALOG_INDEX: { key: string; dish: Dish }[] = CAFETERIA_DISHES.flatMap((dish) =>
  [dish.name, ...(dish.aliases ?? [])].map((n) => ({ key: normalize(n), dish })),
);

export function matchCatalog(token: string): { dish: Dish; exact: boolean } | null {
  const t = normalize(token);
  if (!t) return null;
  const exact = CATALOG_INDEX.find((e) => e.key === t);
  if (exact) return { dish: exact.dish, exact: true };
  // 한국어 합성 메뉴명은 뒤가 음식 종류를 정한다 (돼지고기김치찌개 → 김치찌개).
  // 그래서 부분 일치는 '끝이 같은' 경우만 인정한다 (김치볶음밥 ≠ 김치).
  let best: { key: string; dish: Dish } | null = null;
  for (const e of CATALOG_INDEX) {
    if (e.key.length >= 2 && t.endsWith(e.key) && (!best || e.key.length > best.key.length)) best = e;
  }
  return best ? { dish: best.dish, exact: false } : null;
}

/** 부분 일치가 조리 신호(튀김·생식·면·냉·돼지)를 놓치면 추론 쪽을 믿는다 */
const DECISIVE_TAGS: readonly DishTag[] = ['FRIED', 'RAW_SALAD', 'NOODLE', 'COLD_DISH', 'PORK'];

// ── 키워드 추론 ──────────────────────────────────────────

const ING_RULES: [RegExp, string, number][] = [
  [/돼지|제육|돈가스|돈까스|돈카츠|삼겹|목살|보쌈|수육|족발|항정|탕수/, 'pork', 1],
  [/햄|소시지|베이컨|스팸|비엔나/, 'processed_pork', 1],
  [/닭|치킨/, 'chicken', 1],
  [/소고기|쇠고기|우육|불고기|차돌|양지|사태|소갈비|육개장|장조림/, 'beef_lean', 1],
  [/오리/, 'duck', 1],
  [/황태|북어|코다리/, 'hwangtae', 1],
  [/고등어|꽁치|연어|삼치|참치/, 'mackerel', 1],
  [/조기|굴비/, 'croaker', 1],
  [/생선|가자미|동태|대구|갈치|명태|임연수|우럭|광어|도미|피쉬/, 'white_fish', 1],
  [/멸치/, 'anchovy', 1],
  [/새우/, 'shrimp', 1],
  [/조개|바지락|홍합|전복|굴국|굴전|굴밥/, 'clam', 1],
  [/꽃게|게장|게살|크랩/, 'crab', 1],
  [/오징어|낙지|쭈꾸미|주꾸미|문어/, 'squid', 1],
  [/어묵|오뎅/, 'fish_cake', 0.8],
  [/계란|달걀|에그|메추리알/, 'egg', 1],
  [/연두부|순두부/, 'soft_tofu', 1],
  [/(?<!연|순)두부/, 'tofu', 1],
  [/(?<!단)무(?!침|지|게|말)|단무지/, 'radish', 0.7],
  [/마죽|산약/, 'chinese_yam', 0.8],
  [/부추/, 'chive', 0.7],
  [/미나리/, 'minari', 0.7],
  [/깻잎/, 'perilla_leaf', 0.7],
  [/양배추/, 'cabbage', 0.7],
  [/브로콜리/, 'broccoli', 0.7],
  [/시금치/, 'spinach', 0.7],
  [/콩나물|숙주/, 'bean_sprout', 0.7],
  [/호박/, 'zucchini', 0.7],
  [/버섯|표고|느타리|새송이|팽이/, 'mushroom', 0.7],
  [/당근/, 'carrot', 0.5],
  [/오이/, 'cucumber', 0.7],
  [/상추|양상추|로메인|샐러드|야채|채소/, 'lettuce', 0.7],
  [/(?<!양)배추|김치|겉절이/, 'napa_cabbage', 0.7],
  [/도라지|더덕/, 'doraji', 0.7],
  [/연근/, 'lotus_root', 0.7],
  [/미역|다시마|파래|톳|김구이|조미김/, 'seaweed', 0.7],
  [/감자|고구마/, 'potato', 0.7],
  [/누룽지|숭늉/, 'nurungji', 0.8],
  [/찹쌀|찰밥|약밥|인절미/, 'glutinous_rice', 0.8],
  [/떡/, 'rice_cake', 0.8],
  [/보리/, 'barley', 0.8],
  [/메밀|모밀|소바|막국수|냉면/, 'buckwheat', 0.8],
  [/당면|잡채/, 'glass_noodle', 0.8],
  [/국수|우동|라면|라멘|짜장|짬뽕|파스타|스파게티|칼국수|수제비|빵|토스트|피자|만두|쫄면|튀김|까스|가스|카츠|전$|부침/, 'wheat', 0.5],
  [/밥|라이스|죽$/, 'rice', 0.8],
  [/사과/, 'apple', 1],
  [/귤|오렌지|한라봉|천혜향/, 'tangerine', 1],
  [/바나나/, 'banana', 1],
  [/수박/, 'watermelon', 1],
  [/참외|멜론/, 'oriental_melon', 1],
  [/포도|머스캣/, 'grape', 1],
  [/자몽/, 'grapefruit', 1],
  [/키위/, 'kiwi', 1],
  [/요구르트|요거트|야쿠르트/, 'yogurt', 1],
  [/우유|치즈|라떼/, 'milk', 0.6],
  [/커피|아메리카노|라떼|에스프레소/, 'coffee', 1],
  [/녹차|말차/, 'green_tea', 1],
  [/인삼|홍삼|삼계/, 'ginseng', 0.15],
  [/소주|맥주|막걸리|와인|위스키|하이볼|사케/, 'alcohol', 1],
  [/감초/, 'licorice_tea', 0.5],
  [/고추장|고춧가루|매운|얼큰|불닭|마라/, 'chili', 0.15],
];

const TAG_RULES: [RegExp, DishTag][] = [
  [/튀김|까스|가스|커틀릿|카츠|탕수|강정|후라이드|프라이드|크로켓|고로케|텐동|치킨|너겟|팝콘/, 'FRIED'],
  [/전$|부침|동그랑땡|산적|후라이(?!드)|프라이(?!드)|지짐/, 'PAN_FRIED'],
  [/샐러드|생채|겉절이|(?<!숙|양배추)쌈(?!장)|회$|회무침|사시미|육회|냉채|카프레제/, 'RAW_SALAD'],
  [/면|국수|우동|라면|라멘|짜장|짬뽕|파스타|스파게티|소바|모밀|당면|잡채|쫄면|수제비/, 'NOODLE'],
  [/(국|탕|찌개|전골|스프|수프|죽)$|해장|곰탕|국밥/, 'WARM_SOUP'],
  [/냉(?!이)|아이스|빙수|에이드|스무디|물회/, 'COLD_DISH'],
  [/매운|얼큰|불닭|마라|짬뽕|육개장|떡볶이|제육|고추장|낙지|쭈꾸미|주꾸미|닭볶음|닭도리|닭갈비|김치찌개|부대|오징어볶음/, 'SPICY_HEAVY'],
  [/탕수|강정|맛탕|꿀|조청|데리야끼|양념치킨|달콤|허니|찜닭|불고기|떡볶이/, 'SWEET_SAUCE'],
  [/삼겹|튀김|까스|크림|버터|치즈|베이컨|소시지|햄|곱창|막창|족발|보쌈|훈제|짜장/, 'FATTY'],
  [/찹쌀|찰밥|찰떡|떡|인절미|약밥/, 'GLUTINOUS'],
  [/김치|깍두기|젓갈|장아찌|피클|단무지|석박지|묵은지/, 'FERMENTED'],
  [/나물|숙회|데침/, 'COOKED_NAMUL'],
];

/** 생으로 무치는 경우가 많은 채소 */
const RAW_DRESSED = /오이|부추|상추|도라지|더덕|생채|파무침|달래|겉절이/;

function inferMethod(t: string, tags: Set<DishTag>, allAsIs: boolean): CookingMethod {
  if (tags.has('FRIED')) return 'DEEP_FRIED';
  if (tags.has('PAN_FRIED')) return 'PAN_FRIED';
  if (tags.has('RAW_SALAD')) return 'RAW';
  if (allAsIs) return 'AS_IS';
  if (/찜/.test(t)) return 'STEAMED';
  if (tags.has('WARM_SOUP')) return /죽$/.test(t) ? 'BOILED' : 'SOUP';
  if (/구이|스테이크/.test(t)) return 'GRILLED';
  if (/볶음|주물럭|불고기|덮밥|볶음밥/.test(t)) return 'STIR_FRIED';
  if (/조림/.test(t)) return 'BRAISED';
  if (/무침/.test(t)) return RAW_DRESSED.test(t) ? 'RAW' : 'BLANCHED';
  if (/나물|데침|숙회/.test(t)) return 'BLANCHED';
  if (/수육|삶은|백숙|보쌈|국수|냉면|면$/.test(t)) return 'BOILED';
  return 'BRAISED';
}

const SEASONED_METHODS: readonly CookingMethod[] = ['SOUP', 'STIR_FRIED', 'BRAISED', 'BLANCHED', 'STEAMED', 'PAN_FRIED'];

export function inferDish(token: string): Dish | null {
  const t = normalize(token);
  if (!t) return null;

  const seen = new Set<string>();
  const ingredients: { foodId: string; weight: number }[] = [];
  for (const [re, foodId, weight] of ING_RULES) {
    if (re.test(t) && !seen.has(foodId)) {
      seen.add(foodId);
      ingredients.push({ foodId, weight });
    }
  }
  if (ingredients.length === 0) return null;

  const tags = new Set<DishTag>();
  for (const [re, tag] of TAG_RULES) if (re.test(t)) tags.add(tag);
  if (tags.has('FRIED')) tags.delete('PAN_FRIED');

  const foods = ingredients.map((i) => getFood(i.foodId));
  const allAsIs = foods.every((f) => ['FRUIT', 'DAIRY', 'TEA_SPICE', 'BEVERAGE'].includes(f.category));
  const method = inferMethod(t, tags, allAsIs);
  if (method === 'RAW' && /무침/.test(t)) tags.add('RAW_SALAD');
  if (method === 'BLANCHED' && foods.some((f) => f.category === 'VEGGIE')) tags.add('COOKED_NAMUL');

  if (seen.has('pork') || seen.has('processed_pork')) tags.add('PORK');
  if (seen.has('tofu') || seen.has('soft_tofu')) tags.add('TOFU');
  if (/계란|달걀/.test(t)) tags.add('EGG');
  const fishIds = ['white_fish', 'croaker', 'mackerel', 'hwangtae', 'anchovy'];
  if (fishIds.some((id) => seen.has(id)) && method !== 'DEEP_FRIED') tags.add('FISH');
  if (seen.has('radish') && method !== 'RAW') tags.add('RADISH');
  if (allAsIs && foods.some((f) => f.category === 'FRUIT' || f.category === 'DAIRY')) tags.add('DESSERT');

  let servingTemp: ServingTemp = 'WARM';
  if (tags.has('COLD_DISH')) servingTemp = 'COLD';
  else if (method === 'SOUP' || method === 'BOILED' || method === 'DEEP_FRIED') servingTemp = 'HOT';
  else if (method === 'RAW' || method === 'AS_IS') servingTemp = 'ROOM';
  if (/커피|아메리카노|녹차|말차|숭늉|차$/.test(t) && !tags.has('COLD_DISH')) servingTemp = 'HOT';

  const warmSeasoning = SEASONED_METHODS.includes(method) || /생강|마늘|들기름|들깨/.test(t);

  const slot: DishSlot = tags.has('DESSERT')
    ? 'DESSERT'
    : tags.has('NOODLE')
      ? 'ONE_DISH'
      : tags.has('WARM_SOUP')
        ? 'SOUP'
        : tags.has('FERMENTED')
          ? 'KIMCHI'
          : 'SIDE';

  return {
    id: `inferred:${t}`,
    name: token.trim(),
    slot,
    ingredients,
    cooking: { method, warmSeasoning, servingTemp },
    tags: [...tags],
    note: '메뉴명으로 추정한 재료·조리법입니다',
  };
}

export function parseMenu(text: string): ParsedMenu {
  const items: ParsedMenuItem[] = [];
  const unknown: string[] = [];
  for (const raw of splitMenu(text)) {
    const cat = matchCatalog(raw);
    const inf = inferDish(raw);
    if (cat) {
      const missed = !cat.exact && inf && inf.tags.some((t) => DECISIVE_TAGS.includes(t) && !cat.dish.tags.includes(t));
      if (!missed) {
        items.push({ raw, dish: cat.dish, source: 'CATALOG' });
        continue;
      }
    }
    if (inf) items.push({ raw, dish: inf, source: 'INFERRED' });
    else unknown.push(raw);
  }
  return { items, unknown };
}
