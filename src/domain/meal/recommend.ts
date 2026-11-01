import { CAFETERIA_DISHES } from '../cafeteria/dishes';
import { evaluateDishAt } from '../cafeteria/tray';
import type { UserProfile } from '../profile/types';
import type { Dish } from '../scoring/dish';
import { forwardDiff, fromMinutes, toMinutes, type HHMM } from '../shared/time';

/** 집밥 추천 (H7, F3). 저녁이 기본이고, 주말·쉬는 날에는 아침·점심도 같은 방식으로 쓴다. */
export type HomeMeal = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export const HOME_MEAL_LABEL: Record<HomeMeal, string> = { BREAKFAST: '아침', LUNCH: '점심', DINNER: '저녁' };

/** 저녁 마감: 취침 3시간 전 */
export const DINNER_CUTOFF_BEFORE_BED_MIN = 180;
/** 취침 5시간 이상 전 저녁이면 늦은 허기를 막도록 단백질을 충분히 */
export const EARLY_DINNER_GAP_MIN = 300;

export function mealTimeOf(profile: UserProfile, meal: HomeMeal): HHMM {
  return profile.routine[meal === 'BREAKFAST' ? 'breakfast' : meal === 'LUNCH' ? 'lunch' : 'dinner'];
}

export function dinnerCutoff(profile: UserProfile): HHMM {
  return fromMinutes(toMinutes(profile.routine.bedtime) - DINNER_CUTOFF_BEFORE_BED_MIN);
}

/** 토·일 또는 사용자가 쉬는 날로 표시한 날짜 */
export function isHomeDay(profile: UserProfile, iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 || profile.holidayDates.includes(iso);
}

export interface MealCombo {
  rice: Dish;
  soup: Dish;
  protein: Dish;
  veggie: Dish;
  score: number;
}

export interface MealPlan {
  meal: HomeMeal;
  time: HHMM;
  /** 저녁일 때만 */
  cutoff: HHMM | null;
  combos: MealCombo[];
  advice: string[];
  /** 취침 5시간 이상 전 저녁인가 */
  earlyDinner: boolean;
}

const isProtein = (d: Dish) => d.slot === 'MAIN' || d.tags.includes('EGG') || d.tags.includes('TOFU') || d.tags.includes('FISH');
const isVeggie = (d: Dish) => d.slot === 'SIDE' && d.tags.includes('COOKED_NAMUL');

/**
 * 밥 + 국 + 단백질 + 익힌 채소 조합 3개.
 * 반찬 판정 엔진(H1·H2·H3·H6)을 그대로 거쳐 '담기'로 나온 것만 쓴다.
 */
export function recommendMeal(profile: UserProfile, meal: HomeMeal): MealPlan {
  const time = mealTimeOf(profile, meal);
  const at = toMinutes(time);
  const ranked = (pred: (d: Dish) => boolean) =>
    CAFETERIA_DISHES.filter(pred)
      .map((dish) => ({ dish, ev: evaluateDishAt(dish, profile, at) }))
      .filter((x) => x.ev.final === 'TAKE')
      .sort((a, b) => b.ev.result.score - a.ev.result.score);

  const rices = ranked((d) => d.slot === 'RICE');
  const soups = ranked((d) => d.slot === 'SOUP');
  const proteins = ranked(isProtein);
  const veggies = ranked(isVeggie);

  const combos: MealCombo[] = [];
  if (rices.length && soups.length && proteins.length && veggies.length) {
    for (let k = 0; k < 3; k++) {
      const r = rices[k % rices.length]!;
      const s = soups[k % soups.length]!;
      const p = proteins[k % proteins.length]!;
      const v = veggies[k % veggies.length]!;
      combos.push({
        rice: r.dish,
        soup: s.dish,
        protein: p.dish,
        veggie: v.dish,
        score: Math.round((r.ev.result.score + s.ev.result.score + p.ev.result.score + v.ev.result.score) / 4),
      });
    }
  }

  const advice: string[] = [];
  const bed = toMinutes(profile.routine.bedtime);
  const gap = forwardDiff(at, bed);
  const earlyDinner = meal === 'DINNER' && gap >= EARLY_DINNER_GAP_MIN;
  let cutoff: HHMM | null = null;
  if (meal === 'DINNER') {
    cutoff = dinnerCutoff(profile);
    advice.push(`취침(${profile.routine.bedtime}) 3시간 전인 ${cutoff}까지 마치세요. 그 뒤에 먹으면 자는 동안 위가 쉬지 못합니다`);
    if (forwardDiff(at, toMinutes(cutoff)) > 0 && at > toMinutes(cutoff)) {
      advice.push(`계획한 저녁 시각(${time})이 마감을 넘었습니다. 양을 절반으로 줄이고 국물 위주로 드세요`);
    }
    if (earlyDinner) {
      advice.push('저녁이 이른 편입니다. 양을 줄이지 말고 계란·두부·흰살생선 같은 담백한 단백질을 충분히 넣으세요. 밤 허기를 막는 가장 쉬운 방법입니다');
    }
    if (profile.mealEnvironment.lateNightHabit === 'FREQUENT') {
      advice.push('야식이 잦다면 저녁 밥을 평소 양으로 챙기세요. 저녁을 적게 먹으면 밤 9시 이후 허기가 더 세게 옵니다');
    }
  }
  return { meal, time, cutoff, combos, advice, earlyDinner };
}
