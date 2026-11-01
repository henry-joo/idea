import type { DishTag } from '../constitution/matrix';
import type { CookingMethod, ServingTemp } from '../food/types';
import type { Dish, DishSlot } from '../scoring/dish';

/**
 * 구내식당 반찬 카탈로그. 한국 직장 급식에 자주 오르는 메뉴 위주.
 * 양념(마늘·파·생강·들기름)은 주재료 대신 warmSeasoning 플래그로 표현한다.
 */
function d(
  id: string,
  name: string,
  slot: DishSlot,
  ingredients: [string, number][],
  method: CookingMethod,
  warmSeasoning: boolean,
  servingTemp: ServingTemp,
  tags: DishTag[],
  aliases: string[] = [],
  note?: string,
): Dish {
  return {
    id,
    name,
    slot,
    aliases,
    ingredients: ingredients.map(([foodId, weight]) => ({ foodId, weight })),
    cooking: { method, warmSeasoning, servingTemp },
    tags,
    ...(note ? { note } : {}),
  };
}

export const CAFETERIA_DISHES: readonly Dish[] = [
  // 밥
  d('rice_white', '백미밥', 'RICE', [['rice', 1]], 'STEAMED', false, 'WARM', ['RICE'], ['쌀밥', '흰밥', '백미', '공기밥', '밥']),
  d('rice_multigrain', '잡곡밥', 'RICE', [['rice', 0.5], ['barley', 0.3], ['red_bean', 0.2]], 'STEAMED', false, 'WARM', ['RICE'], ['잡곡', '흑미밥', '현미밥', '오곡밥']),
  d('rice_barley', '보리밥', 'RICE', [['barley', 0.7], ['rice', 0.3]], 'STEAMED', false, 'WARM', ['RICE'], ['보리']),
  d('rice_glutinous', '찰밥', 'RICE', [['glutinous_rice', 1]], 'STEAMED', false, 'WARM', ['RICE', 'GLUTINOUS'], ['약밥', '찹쌀밥']),
  d('one_porridge', '야채죽', 'ONE_DISH', [['rice', 0.7], ['zucchini', 0.15], ['mushroom', 0.15]], 'BOILED', true, 'HOT', ['WARM_SOUP'], ['죽', '전복죽', '소고기죽']),

  // 국·찌개
  d('soup_beef_radish', '소고기무국', 'SOUP', [['radish', 0.5], ['beef_lean', 0.5]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'RADISH'], ['무국', '쇠고기무국', '소고기뭇국', '뭇국']),
  d('soup_hwangtae', '황태국', 'SOUP', [['hwangtae', 0.6], ['radish', 0.2], ['egg', 0.2]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'RADISH'], ['북엇국', '북어국', '황태해장국', '북어해장국']),
  d('soup_doenjang', '된장국', 'SOUP', [['tofu', 0.4], ['zucchini', 0.3], ['spinach', 0.3]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'TOFU'], ['된장찌개', '시금치된장국', '아욱국', '배추된장국']),
  d('soup_bean_sprout', '콩나물국', 'SOUP', [['bean_sprout', 1]], 'SOUP', true, 'HOT', ['WARM_SOUP'], ['콩나물해장국']),
  d('soup_seaweed', '미역국', 'SOUP', [['seaweed', 0.6], ['beef_lean', 0.4]], 'SOUP', true, 'HOT', ['WARM_SOUP'], ['소고기미역국']),
  d('soup_egg', '계란국', 'SOUP', [['egg', 0.8], ['seaweed', 0.2]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'EGG'], ['달걀국', '계란탕']),
  d('soup_fishcake', '어묵국', 'SOUP', [['fish_cake', 0.6], ['radish', 0.4]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'RADISH'], ['오뎅국', '어묵탕']),
  d('soup_chicken', '닭곰탕', 'SOUP', [['chicken', 0.8], ['rice', 0.2]], 'SOUP', true, 'HOT', ['WARM_SOUP'], ['닭개장', '닭칼국수국물']),
  d('soup_samgyetang', '삼계탕', 'SOUP', [['chicken', 0.6], ['glutinous_rice', 0.3], ['ginseng', 0.1]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'GLUTINOUS'], ['한방삼계탕'], '인삼·찹쌀이 들어 기체증엔 차단'),
  d('soup_kimchi_jjigae', '김치찌개', 'SOUP', [['pork', 0.4], ['napa_cabbage', 0.4], ['tofu', 0.2]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'PORK', 'SPICY_HEAVY', 'FERMENTED'], ['돼지김치찌개']),
  d('soup_yukgaejang', '육개장', 'SOUP', [['beef_lean', 0.5], ['bean_sprout', 0.3], ['chili', 0.2]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'SPICY_HEAVY'], ['얼큰국', '얼큰탕']),
  d('soup_budae', '부대찌개', 'SOUP', [['processed_pork', 0.4], ['wheat', 0.3], ['napa_cabbage', 0.3]], 'SOUP', true, 'HOT', ['WARM_SOUP', 'PORK', 'NOODLE', 'SPICY_HEAVY', 'FATTY'], []),

  // 주찬
  d('main_jeyuk', '제육볶음', 'MAIN', [['pork', 1]], 'STIR_FRIED', true, 'HOT', ['PORK', 'SPICY_HEAVY', 'FATTY'], ['제육', '돼지불고기', '돼지고기볶음', '고추장불고기']),
  d('main_suyuk', '돼지수육', 'MAIN', [['pork', 1]], 'BOILED', false, 'WARM', ['PORK', 'FATTY'], ['수육', '보쌈']),
  d('main_donkatsu', '돈가스', 'MAIN', [['pork', 0.7], ['wheat', 0.3]], 'DEEP_FRIED', false, 'HOT', ['PORK', 'FRIED', 'FATTY'], ['돈까스', '돈카츠', '등심까스']),
  d('main_tangsuyuk', '탕수육', 'MAIN', [['pork', 0.6], ['wheat', 0.4]], 'DEEP_FRIED', false, 'HOT', ['PORK', 'FRIED', 'SWEET_SAUCE'], []),
  d('main_fried_chicken', '닭튀김', 'MAIN', [['chicken', 0.8], ['wheat', 0.2]], 'DEEP_FRIED', false, 'HOT', ['FRIED', 'FATTY'], ['치킨', '후라이드', '순살치킨', '치킨까스']),
  d('main_dakgangjeong', '닭강정', 'MAIN', [['chicken', 0.7], ['wheat', 0.3]], 'DEEP_FRIED', false, 'HOT', ['FRIED', 'SWEET_SAUCE'], []),
  d('main_jjimdak', '찜닭', 'MAIN', [['chicken', 0.6], ['potato', 0.25], ['glass_noodle', 0.15]], 'BRAISED', true, 'HOT', ['SWEET_SAUCE'], ['안동찜닭', '간장찜닭']),
  d('main_dakbokkeum', '닭볶음탕', 'MAIN', [['chicken', 0.6], ['potato', 0.3], ['carrot', 0.1]], 'BRAISED', true, 'HOT', ['SPICY_HEAVY'], ['닭도리탕', '닭갈비']),
  d('main_chicken_steam', '닭가슴살찜', 'MAIN', [['chicken', 1]], 'STEAMED', true, 'WARM', [], ['닭가슴살', '닭백숙', '백숙']),
  d('main_bulgogi', '소불고기', 'MAIN', [['beef_lean', 0.7], ['mushroom', 0.15], ['carrot', 0.15]], 'STIR_FRIED', true, 'HOT', ['SWEET_SAUCE'], ['불고기', '소고기볶음']),
  d('main_jangjorim', '장조림', 'MAIN', [['beef_lean', 0.7], ['egg', 0.3]], 'BRAISED', true, 'WARM', ['EGG'], ['메추리알장조림', '계란장조림']),
  d('main_white_fish', '생선구이', 'MAIN', [['white_fish', 1]], 'GRILLED', false, 'HOT', ['FISH'], ['가자미구이', '동태구이', '임연수구이', '갈치구이', '대구구이', '삼치구이']),
  d('main_croaker', '조기구이', 'MAIN', [['croaker', 1]], 'GRILLED', false, 'HOT', ['FISH'], ['굴비구이', '굴비']),
  d('main_mackerel', '고등어구이', 'MAIN', [['mackerel', 1]], 'GRILLED', false, 'HOT', ['FISH', 'FATTY'], ['꽁치구이', '연어구이']),
  d('main_fish_jorim', '코다리조림', 'MAIN', [['white_fish', 0.7], ['radish', 0.3]], 'BRAISED', true, 'HOT', ['FISH', 'RADISH'], ['동태조림', '생선조림', '갈치조림', '고등어무조림']),
  d('main_fish_cutlet', '생선까스', 'MAIN', [['white_fish', 0.7], ['wheat', 0.3]], 'DEEP_FRIED', false, 'HOT', ['FISH', 'FRIED'], ['생선가스', '피쉬까스']),
  d('main_shrimp_fried', '새우튀김', 'MAIN', [['shrimp', 0.7], ['wheat', 0.3]], 'DEEP_FRIED', false, 'HOT', ['FRIED'], ['새우까스']),
  d('main_squid', '오징어볶음', 'MAIN', [['squid', 0.8], ['napa_cabbage', 0.2]], 'STIR_FRIED', true, 'HOT', ['SPICY_HEAVY'], ['낙지볶음', '쭈꾸미볶음', '주꾸미볶음']),
  d('main_duck', '오리주물럭', 'MAIN', [['duck', 1]], 'STIR_FRIED', true, 'HOT', ['SPICY_HEAVY', 'FATTY'], ['오리불고기', '훈제오리']),
  d('main_tofu_jorim', '두부조림', 'MAIN', [['tofu', 1]], 'BRAISED', true, 'WARM', ['TOFU'], []),
  d('main_tofu_pan', '두부부침', 'SIDE', [['tofu', 1]], 'PAN_FRIED', true, 'WARM', ['TOFU', 'PAN_FRIED'], ['두부구이']),
  d('main_egg_roll', '계란말이', 'SIDE', [['egg', 0.9], ['carrot', 0.1]], 'PAN_FRIED', true, 'WARM', ['EGG'], ['달걀말이']),
  d('main_egg_steam', '계란찜', 'SIDE', [['egg', 1]], 'STEAMED', true, 'HOT', ['EGG'], ['달걀찜']),
  d('main_egg_fried', '계란후라이', 'SIDE', [['egg', 1]], 'PAN_FRIED', false, 'WARM', ['EGG'], ['계란프라이', '달걀프라이']),

  // 나물·밑반찬
  d('side_spinach', '시금치나물', 'SIDE', [['spinach', 1]], 'BLANCHED', true, 'ROOM', ['COOKED_NAMUL'], ['시금치무침']),
  d('side_bean_sprout', '콩나물무침', 'SIDE', [['bean_sprout', 1]], 'BLANCHED', true, 'ROOM', ['COOKED_NAMUL'], ['콩나물', '숙주나물', '숙주무침']),
  d('side_minari', '미나리나물', 'SIDE', [['minari', 1]], 'BLANCHED', true, 'ROOM', ['COOKED_NAMUL'], ['미나리무침', '미나리']),
  d('side_radish_namul', '무나물', 'SIDE', [['radish', 1]], 'STIR_FRIED', true, 'WARM', ['COOKED_NAMUL', 'RADISH'], ['무볶음', '무조림']),
  d('side_perilla_steam', '깻잎찜', 'SIDE', [['perilla_leaf', 1]], 'STEAMED', true, 'WARM', ['COOKED_NAMUL'], ['깻잎나물', '깻잎볶음']),
  d('side_broccoli', '브로콜리데침', 'SIDE', [['broccoli', 1]], 'BLANCHED', false, 'ROOM', ['COOKED_NAMUL'], ['브로콜리', '브로콜리숙회']),
  d('side_cabbage_steam', '양배추찜', 'SIDE', [['cabbage', 1]], 'STEAMED', false, 'WARM', ['COOKED_NAMUL'], ['양배추쌈', '양배추숙쌈']),
  d('side_zucchini', '애호박볶음', 'SIDE', [['zucchini', 1]], 'STIR_FRIED', true, 'WARM', ['COOKED_NAMUL'], ['호박볶음', '호박나물', '애호박나물']),
  d('side_mushroom', '버섯볶음', 'SIDE', [['mushroom', 1]], 'STIR_FRIED', true, 'WARM', ['COOKED_NAMUL'], ['느타리볶음', '새송이볶음', '표고볶음']),
  d('side_potato', '감자조림', 'SIDE', [['potato', 1]], 'BRAISED', true, 'ROOM', [], ['감자볶음', '감자채볶음']),
  d('side_lotus', '연근조림', 'SIDE', [['lotus_root', 1]], 'BRAISED', true, 'ROOM', ['SWEET_SAUCE'], []),
  d('side_anchovy', '멸치볶음', 'SIDE', [['anchovy', 1]], 'STIR_FRIED', true, 'ROOM', ['SWEET_SAUCE'], ['잔멸치볶음']),
  d('side_fishcake', '어묵볶음', 'SIDE', [['fish_cake', 1]], 'STIR_FRIED', true, 'ROOM', [], ['오뎅볶음']),
  d('side_sausage', '소시지볶음', 'SIDE', [['processed_pork', 1]], 'STIR_FRIED', true, 'WARM', ['PORK', 'FATTY'], ['비엔나볶음', '햄볶음', '스팸', '햄구이']),
  d('side_chive', '부추무침', 'SIDE', [['chive', 1]], 'RAW', false, 'ROOM', [], ['부추겉절이', '부추'], '부추는 온성이라 생으로도 소량은 괜찮다'),
  d('side_chive_pancake', '부추전', 'SIDE', [['chive', 0.5], ['wheat', 0.5]], 'PAN_FRIED', true, 'WARM', ['PAN_FRIED'], ['김치전', '파전', '해물파전', '호박전', '동그랑땡']),
  d('side_japchae', '잡채', 'SIDE', [['glass_noodle', 0.5], ['beef_lean', 0.2], ['spinach', 0.15], ['carrot', 0.15]], 'STIR_FRIED', true, 'ROOM', ['NOODLE', 'FATTY'], []),
  d('side_tteokbokki', '떡볶이', 'ONE_DISH', [['rice_cake', 0.8], ['fish_cake', 0.2]], 'BRAISED', true, 'HOT', ['SPICY_HEAVY', 'GLUTINOUS', 'SWEET_SAUCE'], ['떡볶음', '궁중떡볶이']),
  d('side_radish_raw', '무생채', 'SIDE', [['radish', 0.85], ['chili', 0.15]], 'RAW', false, 'ROOM', ['RAW_SALAD'], ['무채']),
  d('side_doraji', '도라지무침', 'SIDE', [['doraji', 0.85], ['chili', 0.15]], 'RAW', false, 'ROOM', ['RAW_SALAD'], ['도라지생채', '더덕무침']),
  d('side_cucumber', '오이무침', 'SIDE', [['cucumber', 1]], 'RAW', false, 'COLD', ['RAW_SALAD', 'COLD_DISH'], ['오이생채', '오이소박이', '오이냉국']),
  d('side_cabbage_salad', '양배추샐러드', 'SIDE', [['cabbage', 1]], 'RAW', false, 'COLD', ['RAW_SALAD'], ['코울슬로', '양배추채']),
  d('side_green_salad', '그린샐러드', 'SIDE', [['lettuce', 0.7], ['cucumber', 0.3]], 'RAW', false, 'COLD', ['RAW_SALAD', 'COLD_DISH'], ['샐러드', '야채샐러드', '리코타샐러드', '상추겉절이']),
  d('side_seaweed', '조미김', 'SIDE', [['seaweed', 1]], 'GRILLED', false, 'ROOM', [], ['김', '김구이', '도시락김']),

  // 김치
  d('kimchi_napa', '배추김치', 'KIMCHI', [['napa_cabbage', 0.7], ['chili', 0.15], ['garlic', 0.15]], 'RAW', false, 'ROOM', ['FERMENTED', 'KIMCHI'], ['김치', '포기김치', '겉절이', '열무김치'], '기체증 기간엔 2~3조각만'),
  d('kimchi_radish', '깍두기', 'KIMCHI', [['radish', 0.7], ['chili', 0.15], ['garlic', 0.15]], 'RAW', false, 'ROOM', ['FERMENTED', 'KIMCHI'], ['석박지', '총각김치'], '기체증 기간엔 2~3조각만'),
  d('kimchi_sour', '신김치·묵은지', 'KIMCHI', [['napa_cabbage', 0.7], ['chili', 0.15], ['garlic', 0.15]], 'RAW', false, 'COLD', ['FERMENTED', 'SOUR_KIMCHI', 'COLD_DISH'], ['신김치', '묵은지', '묵은김치', '동치미', '물김치', '나박김치'], '신맛·찬 국물은 기체증 기간엔 거르기'),

  // 면·일품
  d('one_janchi', '잔치국수', 'ONE_DISH', [['wheat', 0.8], ['egg', 0.1], ['zucchini', 0.1]], 'SOUP', true, 'HOT', ['NOODLE', 'WARM_SOUP'], ['국수', '칼국수', '수제비']),
  d('one_udon', '우동', 'ONE_DISH', [['wheat', 0.8], ['fish_cake', 0.2]], 'SOUP', true, 'HOT', ['NOODLE', 'WARM_SOUP'], ['가락국수', '라면', '라멘']),
  d('one_jjajang', '짜장면', 'ONE_DISH', [['wheat', 0.6], ['pork', 0.3], ['potato', 0.1]], 'STIR_FRIED', true, 'HOT', ['NOODLE', 'PORK', 'FATTY'], ['자장면', '짜장', '짜장밥']),
  d('one_jjamppong', '짬뽕', 'ONE_DISH', [['wheat', 0.5], ['squid', 0.2], ['clam', 0.2], ['napa_cabbage', 0.1]], 'SOUP', true, 'HOT', ['NOODLE', 'SPICY_HEAVY', 'WARM_SOUP'], []),
  d('one_naengmyeon', '냉면', 'ONE_DISH', [['buckwheat', 0.7], ['beef_lean', 0.1], ['cucumber', 0.2]], 'BOILED', false, 'COLD', ['NOODLE', 'COLD_DISH'], ['물냉면', '비빔냉면', '메밀소바', '냉모밀', '막국수']),
  d('one_pasta', '파스타', 'ONE_DISH', [['wheat', 0.8], ['processed_pork', 0.2]], 'BOILED', true, 'HOT', ['NOODLE', 'FATTY'], ['스파게티', '크림파스타', '토마토파스타']),
  d('one_bibimbap', '비빔밥', 'ONE_DISH', [['rice', 0.5], ['spinach', 0.1], ['bean_sprout', 0.1], ['carrot', 0.1], ['egg', 0.1], ['mushroom', 0.1]], 'BLANCHED', true, 'WARM', ['COOKED_NAMUL'], ['산채비빔밥', '돌솥비빔밥'], '고추장은 반만'),
  d('one_curry', '카레라이스', 'ONE_DISH', [['rice', 0.5], ['potato', 0.2], ['carrot', 0.1], ['chicken', 0.2]], 'BRAISED', true, 'HOT', [], ['카레', '커리']),
  d('one_bread', '빵·샌드위치', 'ONE_DISH', [['wheat', 0.8], ['egg', 0.2]], 'AS_IS', false, 'ROOM', [], ['토스트', '샌드위치', '모닝빵', '베이글', '빵']),

  // 후식·음료
  d('dessert_yogurt', '요구르트', 'DESSERT', [['yogurt', 1]], 'AS_IS', false, 'COLD', ['DESSERT'], ['요거트', '야쿠르트', '우유', '두유']),
  d('dessert_apple', '사과', 'DESSERT', [['apple', 1]], 'AS_IS', false, 'ROOM', ['DESSERT'], []),
  d('dessert_tangerine', '귤', 'DESSERT', [['tangerine', 1]], 'AS_IS', false, 'ROOM', ['DESSERT'], ['오렌지', '한라봉', '천혜향']),
  d('dessert_banana', '바나나', 'DESSERT', [['banana', 1]], 'AS_IS', false, 'ROOM', ['DESSERT'], []),
  d('dessert_watermelon', '수박', 'DESSERT', [['watermelon', 1]], 'AS_IS', false, 'COLD', ['DESSERT', 'COLD_DISH'], []),
  d('dessert_melon', '참외', 'DESSERT', [['oriental_melon', 1]], 'AS_IS', false, 'COLD', ['DESSERT', 'COLD_DISH'], ['멜론']),
  d('dessert_grape', '포도', 'DESSERT', [['grape', 1]], 'AS_IS', false, 'ROOM', ['DESSERT'], ['샤인머스캣']),
  d('dessert_grapefruit', '자몽', 'DESSERT', [['grapefruit', 1]], 'AS_IS', false, 'COLD', ['DESSERT'], ['자몽에이드', '자몽주스']),
  d('dessert_rice_cake', '떡', 'DESSERT', [['rice_cake', 1]], 'AS_IS', false, 'ROOM', ['DESSERT', 'GLUTINOUS'], ['인절미', '찹쌀떡', '송편', '경단']),
  d('drink_coffee', '커피', 'DRINK', [['coffee', 1]], 'AS_IS', false, 'HOT', [], ['아메리카노', '라떼', '믹스커피', '에스프레소', '카페라떼']),
  d('drink_green_tea', '녹차', 'DRINK', [['green_tea', 1]], 'AS_IS', false, 'HOT', [], ['말차']),
  d('drink_barley_tea', '보리차', 'DRINK', [['barley_tea', 1]], 'AS_IS', false, 'WARM', [], ['옥수수차']),
  d('drink_sungnyung', '숭늉', 'DRINK', [['sungnyung', 1]], 'AS_IS', false, 'HOT', [], ['누룽지차', '누룽지']),
  d('drink_alcohol', '술', 'DRINK', [['alcohol', 1]], 'AS_IS', false, 'ROOM', [], ['소주', '맥주', '막걸리', '와인', '하이볼', '위스키', '회식', '맥주한잔']),
  d('drink_cold_water', '냉수', 'DRINK', [['cold_water', 1]], 'AS_IS', false, 'COLD', ['COLD_DISH'], ['찬물', '얼음물', '아이스']),
];

const BY_ID = new Map(CAFETERIA_DISHES.map((x) => [x.id, x]));
export function getDish(id: string): Dish {
  const x = BY_ID.get(id);
  if (!x) throw new Error(`알 수 없는 반찬 id: ${id}`);
  return x;
}
