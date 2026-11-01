import { CONSTITUTION_MATRIX } from '../constitution/matrix';
import { getFood } from '../food/catalog';
import { medWindowClassOf, type MedWindowClass } from '../food/types';
import { ateLateNight, type DailyHealthLog } from '../log/types';
import { checkIntakeAt } from '../medication/safeguard';
import type { Constitution, UserProfile } from '../profile/types';
import { scoreDish, type Dish, type DishScore } from '../scoring/dish';
import { toMinutes, type HHMM } from '../shared/time';
import { parseMenu, type MatchSource } from './parser';

export type MealSlot = 'BREAKFAST' | 'LUNCH';
/** 최종 판정: 담기 / 조금만 / 거르기 / 차단 / 복약 보류 */
export type TrayFinal = 'TAKE' | 'LITTLE' | 'SKIP' | 'BLOCKED' | 'HOLD';

export interface TrayItem {
  raw: string;
  dish: Dish;
  source: MatchSource;
  result: DishScore;
  final: TrayFinal;
  holdUntil?: HHMM;
  /** 판정을 가른 가장 큰 이유 한 줄 */
  headline: string;
}

export interface PortionGuide {
  percent: 100 | 50;
  reason: string;
}

export interface TrayPlan {
  meal: MealSlot;
  mealTime: HHMM;
  portion: PortionGuide;
  items: TrayItem[];
  unknown: string[];
  hasWarmSoupOrRadish: boolean;
  eatingOrder: string[];
  tips: string[];
}

/**
 * 명세 §3-4: 전날 야식(대체식 포함)을 먹었다면 다음 날 회사 아침 식사량 50%.
 * 점심은 감량하지 않는다.
 */
export function portionFor(meal: MealSlot, yesterday: DailyHealthLog | null | undefined): PortionGuide {
  if (meal === 'BREAKFAST' && ateLateNight(yesterday)) {
    const h = yesterday!.lateNightDefense.fastingHoursToMorning;
    return {
      percent: 50,
      reason: `어젯밤 야식으로 공복 ${h}시간. 위가 아직 비지 않았으니 아침은 평소의 절반만`,
    };
  }
  return {
    percent: 100,
    reason: meal === 'BREAKFAST' ? '어젯밤 공복을 지켰습니다. 평소 양으로 드세요' : '점심은 평소 양. 대신 천천히',
  };
}

const EATING_ORDER: Record<Constitution, string[]> = {
  SOEUM: [
    '따뜻한 국물 2~3숟가락으로 위를 먼저 데우기',
    '계란·두부·생선 같은 담백한 단백질',
    '익힌 나물',
    '밥은 마지막에, 진밥 위주로',
  ],
  SOYANG: ['나물·채소 먼저', '생선·돼지고기·두부 단백질', '밥(보리·잡곡)', '국물은 미지근하게'],
  TAEEUM: ['채소·해조류 먼저 충분히', '단백질(두부·소고기·생선)', '밥은 2/3 공기만', '국물은 건더기 위주'],
  TAEYANG: ['푸른 채소·해산물 먼저', '두부·생선 약간', '밥 반 공기', '기름진 반찬은 손대지 않기'],
};

const TIPS: Record<Constitution, string[]> = {
  SOEUM: ['한 입에 20~30번 씹기', '식사 중엔 찬물 대신 정수기 온수 반 컵', '식전 2분 4-7-8 호흡', '식후 15분 천천히 걷기'],
  SOYANG: ['급하게 먹지 않기(조급증)', '맵고 뜨거운 국물은 식혀서', '식후 15분 걷기'],
  TAEEUM: ['그릇을 비울 때까지 먹지 않기, 80%에서 멈춤', '튀김·전 손대지 않기', '식후 15분 걷기'],
  TAEYANG: ['담백하게, 양념 적게', '식후 바로 눕지 않기', '식후 15분 걷기'],
};

function dishMedClasses(dish: Dish): MedWindowClass[] {
  const set = new Set<MedWindowClass>();
  for (const i of dish.ingredients) {
    const c = medWindowClassOf(getFood(i.foodId));
    if (c) set.add(c);
  }
  return [...set];
}

function headlineOf(result: DishScore): string {
  const block = result.hits.find((h) => h.block);
  if (block) return block.label;
  const ranked = [...result.hits, ...result.ingredientScores.flatMap((s) => s.hits)]
    .filter((h) => !['R0', 'D0'].includes(h.ruleId) && h.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return ranked[0]?.label ?? '특이 사항 없음';
}

export function evaluateDishAt(
  dish: Dish,
  profile: UserProfile,
  atMin: number,
): Pick<TrayItem, 'result' | 'final' | 'holdUntil' | 'headline'> {
  const result = scoreDish(dish, profile);
  let final: TrayFinal = result.verdict;
  let headline = headlineOf(result);
  let holdUntil: HHMM | undefined;
  if (final === 'TAKE' || final === 'LITTLE') {
    for (const cls of dishMedClasses(dish)) {
      const chk = checkIntakeAt(profile, cls, atMin);
      if (!chk.allowed) {
        final = 'HOLD';
        holdUntil = chk.nextAllowedAt ?? undefined;
        headline = chk.reason ?? headline;
        break;
      }
    }
  }
  return { result, final, ...(holdUntil ? { holdUntil } : {}), headline };
}

export interface TrayInput {
  menuText: string;
  meal: MealSlot;
  profile: UserProfile;
  yesterday?: DailyHealthLog | null;
  /** 생략하면 프로필의 식사 시각 */
  mealTime?: HHMM;
}

export function evaluateTray(input: TrayInput): TrayPlan {
  const { profile, meal } = input;
  const mealTime = input.mealTime ?? (meal === 'BREAKFAST' ? profile.routine.breakfast : profile.routine.lunch);
  const at = toMinutes(mealTime);
  const parsed = parseMenu(input.menuText);

  const items: TrayItem[] = parsed.items.map((p) => ({ raw: p.raw, dish: p.dish, source: p.source, ...evaluateDishAt(p.dish, profile, at) }));

  const hasWarmSoupOrRadish = items.some(
    (i) => (i.final === 'TAKE' || i.final === 'LITTLE') && (i.dish.tags.includes('WARM_SOUP') || i.dish.tags.includes('RADISH')),
  );

  const portion = portionFor(meal, input.yesterday);
  const tips = [...TIPS[profile.constitution]];
  if (!hasWarmSoupOrRadish && profile.constitution === 'SOEUM') {
    tips.unshift('담을 국물·익힌 무가 없습니다. 정수기 온수 반 컵을 먼저 마시세요');
  }
  const rice = CONSTITUTION_MATRIX[profile.constitution].cafeteria.riceGuide;
  const order = EATING_ORDER[profile.constitution].map((s) =>
    s.startsWith('밥') && portion.percent === 50 ? `${s} (평소의 절반)` : s,
  );

  return {
    meal,
    mealTime,
    portion,
    items,
    unknown: parsed.unknown,
    hasWarmSoupOrRadish,
    eatingOrder: order,
    tips: [`밥: ${rice}`, ...tips],
  };
}

export const SAMPLE_MENUS: Record<MealSlot, string> = {
  BREAKFAST: '백미밥, 황태국, 계란말이, 시금치나물, 소시지볶음, 배추김치, 요구르트',
  LUNCH: '잡곡밥, 소고기무국, 제육볶음, 생선까스, 두부조림, 콩나물무침, 양배추샐러드, 깍두기, 사과',
};
