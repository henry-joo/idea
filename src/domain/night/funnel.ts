import { CONSTITUTION_MATRIX } from '../constitution/matrix';
import { getFood } from '../food/catalog';
import { medWindowClassOf } from '../food/types';
import type { DinnerAmount, NightOutcome } from '../log/types';
import { checkIntakeAt } from '../medication/safeguard';
import type { UserProfile } from '../profile/types';
import { evaluateDishAt } from '../cafeteria/tray';
import type { Dish } from '../scoring/dish';
import { addDays, forwardDiff, fromMinutes, toMinutes, type HHMM } from '../shared/time';

/**
 * 명세 §3-5 야식 방어 3단계 퍼널.
 *   Step 1  따뜻한 진피차/미온수 + 15분 대기 타이머
 *   Step 2  가짜 배고픔 판별
 *   Step 3  불가피할 때만 초저부담 대체 야식
 * 모든 전이는 순수 함수. UI는 상태를 들고 있다가 이 함수들로만 바꾼다.
 */

export const NIGHT_START_MIN = 21 * 60;
/** 새벽 4시 전까지는 전날 밤으로 본다 */
export const NIGHT_END_MIN = 4 * 60;
export const TEA_WAIT_MIN = 15;
export const FASTING_TARGET_HOURS = 12;
export const FAKE_HUNGER_THRESHOLD = 3;

export function isLateNight(atMin: number): boolean {
  return atMin >= NIGHT_START_MIN || atMin < NIGHT_END_MIN;
}

export type FunnelStep = 'WARM_DRINK' | 'HUNGER_CHECK' | 'SUBSTITUTE' | 'DONE';

export interface WarmDrinkChoice {
  foodId: string;
  label: string;
  /** 체질 기본 음료가 복약 창 때문에 바뀌었으면 그 이유 */
  swappedReason: string | null;
}

export interface FunnelState {
  step: FunnelStep;
  startedAtMin: number;
  drink: WarmDrinkChoice;
  timerEndsAtMs: number | null;
  timerCompleted: boolean;
  answers: Record<string, boolean>;
  hungerVerdict: 'FAKE' | 'REAL' | null;
  /** 저녁을 거르거나 적게 먹어 Step 2를 건너뛰었는가 (H5) */
  skippedHungerCheck?: boolean;
  outcome: NightOutcome | null;
  intakeAtMin: number | null;
  substituteId: string | null;
}

/** Step 1: 체질별 따뜻한 음료. 한방차가 복약 60분 창에 걸리면 미온수로 바꾼다. */
export function chooseWarmDrink(profile: UserProfile, atMin: number): WarmDrinkChoice {
  const preferredId = CONSTITUTION_MATRIX[profile.constitution].nightDrinkId;
  const food = getFood(preferredId);
  const chk = checkIntakeAt(profile, medWindowClassOf(food), atMin);
  if (chk.allowed) return { foodId: food.id, label: `따뜻한 ${food.name}`, swappedReason: null };
  return {
    foodId: 'warm_water',
    label: '미온수 한 컵',
    swappedReason: `${chk.reason}. 오늘은 ${food.name} 대신 미온수`,
  };
}

export function startFunnel(profile: UserProfile, atMin: number, nowMs: number): FunnelState {
  return {
    step: 'WARM_DRINK',
    startedAtMin: atMin,
    drink: chooseWarmDrink(profile, atMin),
    timerEndsAtMs: nowMs + TEA_WAIT_MIN * 60_000,
    timerCompleted: false,
    answers: {},
    hungerVerdict: null,
    outcome: null,
    intakeAtMin: null,
    substituteId: null,
  };
}

export function timerRemainingMs(s: FunnelState, nowMs: number): number {
  return s.timerEndsAtMs === null ? 0 : Math.max(0, s.timerEndsAtMs - nowMs);
}

/** 타이머가 끝났으면 완료로, 아니면 '대기 미완료'로 Step 2에 넘어간다 */
export function finishWaiting(s: FunnelState, nowMs: number, dinner?: DinnerAmount): FunnelState {
  const timerCompleted = timerRemainingMs(s, nowMs) === 0;
  // H5: 저녁을 거르거나 적게 먹은 날의 허기는 진짜일 가능성이 높다 → 판별 없이 대체식으로
  if (dinner === 'SKIPPED' || dinner === 'LIGHT') {
    return { ...s, step: 'SUBSTITUTE', timerCompleted, hungerVerdict: 'REAL', skippedHungerCheck: true };
  }
  return { ...s, step: 'HUNGER_CHECK', timerCompleted };
}

export interface HungerQuestion {
  id: string;
  text: string;
  /** 예(true)가 가짜 배고픔 쪽 신호인가 */
  fakeIfYes: boolean;
}

/** Step 2: 감정적·습관적 허기(가짜 배고픔) 판별 */
export const HUNGER_QUESTIONS: readonly HungerQuestion[] = [
  { id: 'recent_dinner', text: '저녁을 먹은 지 4시간이 안 됐다', fakeIfYes: true },
  { id: 'sudden', text: '허기가 서서히가 아니라 갑자기 몰려왔다', fakeIfYes: true },
  { id: 'specific', text: '라면·치킨·과자처럼 특정 음식만 당긴다', fakeIfYes: true },
  { id: 'stress', text: '직전에 스트레스·피로·지루함이 있었다 (업무 긴장이 풀린 뒤 포함)', fakeIfYes: true },
  { id: 'drink_helped', text: '따뜻한 차를 마신 뒤 허기가 줄었다', fakeIfYes: true },
  { id: 'body_signal', text: '꼬르륵 소리, 기운 빠짐 같은 몸의 공복 신호가 있다', fakeIfYes: false },
];

export function fakeHungerScore(answers: Record<string, boolean>): number {
  return HUNGER_QUESTIONS.reduce((s, q) => {
    const a = answers[q.id];
    if (a === undefined) return s;
    return s + (a === q.fakeIfYes ? 1 : 0);
  }, 0);
}

export function submitHungerCheck(s: FunnelState, answers: Record<string, boolean>): FunnelState {
  const verdict = fakeHungerScore(answers) >= FAKE_HUNGER_THRESHOLD ? 'FAKE' : 'REAL';
  // 가짜면 Step 3 화면이 '먹지 않고 넘기기'를 먼저, 진짜면 대체식을 먼저 보여 준다
  return { ...s, answers, hungerVerdict: verdict, step: 'SUBSTITUTE' };
}

/** 가짜 배고픔이면 먹지 않고 마무리 → DEFENDED */
export function defend(s: FunnelState): FunnelState {
  return { ...s, step: 'DONE', outcome: 'DEFENDED', intakeAtMin: null, substituteId: null };
}

export function chooseSubstitute(s: FunnelState, dishId: string, atMin: number): FunnelState {
  return { ...s, step: 'DONE', outcome: 'SAFE_SUBSTITUTE', intakeAtMin: atMin, substituteId: dishId };
}

export function recordHeavySnack(s: FunnelState, atMin: number): FunnelState {
  return { ...s, step: 'DONE', outcome: 'HEAVY_SNACK', intakeAtMin: atMin, substituteId: null };
}

/**
 * 마지막 섭취부터 다음 날 아침 식사까지 공복 시간(0.5h 단위).
 * 방어 성공이면 저녁 식사 시각을 마지막 섭취로 본다.
 */
export function fastingHours(profile: UserProfile, s: Pick<FunnelState, 'outcome' | 'intakeAtMin'>): number {
  const last = s.outcome === 'DEFENDED' || s.intakeAtMin === null ? toMinutes(profile.routine.dinner) : s.intakeAtMin;
  const diff = forwardDiff(last, toMinutes(profile.routine.breakfast)) || 1440;
  return Math.round((diff / 60) * 2) / 2;
}

// ── Step 3: 대체 야식 ──────────────────────────────────

export interface NightDish {
  dish: Dish;
  portion: string;
  how: string;
}

function nd(id: string, name: string, ing: [string, number][], method: Dish['cooking']['method'], warm: boolean, temp: Dish['cooking']['servingTemp'], portion: string, how: string): NightDish {
  return {
    dish: {
      id,
      name,
      slot: 'ONE_DISH',
      ingredients: ing.map(([foodId, weight]) => ({ foodId, weight })),
      cooking: { method, warmSeasoning: warm, servingTemp: temp },
      tags: method === 'SOUP' ? ['WARM_SOUP'] : [],
    },
    portion,
    how,
  };
}

export const NIGHT_DISHES: readonly NightDish[] = [
  nd('night_nurungji', '따뜻한 누룽지', [['nurungji', 1]], 'BOILED', false, 'HOT', '반 공기 (약 120kcal)', '물을 넉넉히 붓고 푹 끓여 숭늉째 천천히'),
  nd('night_egg_steam', '계란찜', [['egg', 1]], 'STEAMED', true, 'HOT', '계란 1개 (약 90kcal)', '물 2배로 부드럽게, 파 약간'),
  nd('night_soft_tofu', '데운 연두부', [['soft_tofu', 1]], 'STEAMED', true, 'WARM', '반 팩 (약 60kcal)', '전자레인지 40초, 간장 반 숟가락과 들기름 몇 방울'),
  nd('night_ma_juk', '마죽', [['chinese_yam', 0.6], ['rice', 0.4]], 'BOILED', false, 'HOT', '종이컵 1컵 (약 130kcal)', '마를 갈아 쌀죽에 풀어 한소끔'),
  nd('night_mung_bean_juk', '녹두죽', [['mung_bean', 0.5], ['rice', 0.5]], 'BOILED', false, 'WARM', '종이컵 1컵 (약 140kcal)', '미지근하게 식혀서'),
  nd('night_tofu_plain', '데친 두부', [['tofu', 1]], 'BOILED', false, 'WARM', '1/4모 (약 80kcal)', '끓는 물에 1분, 간장 살짝'),
  nd('night_seaweed_soup', '맑은 미역국', [['seaweed', 0.8], ['clam', 0.2]], 'SOUP', true, 'HOT', '반 그릇 (약 50kcal)', '건더기 위주, 밥은 말지 않기'),
  nd('night_buckwheat_jelly', '메밀묵', [['buckwheat', 1]], 'BOILED', false, 'ROOM', '1/4모 (약 60kcal)', '양념장 없이 간장 살짝'),
  nd('night_clam_soup', '조개 맑은국', [['clam', 0.7], ['radish', 0.3]], 'SOUP', false, 'HOT', '반 그릇 (약 60kcal)', '맵지 않게, 건더기 위주'),
];

export interface RankedSubstitute extends NightDish {
  score: number;
  allowed: boolean;
  note: string;
}

/** 체질 후보 → 점수 + 복약 창 판정. 차단·보류는 뒤로 보낸다. */
export function rankSubstitutes(profile: UserProfile, atMin: number): RankedSubstitute[] {
  const ids = CONSTITUTION_MATRIX[profile.constitution].nightSubstituteIds;
  return ids
    .map((id) => NIGHT_DISHES.find((n) => n.dish.id === id)!)
    .map((n) => {
      const ev = evaluateDishAt(n.dish, profile, atMin);
      const allowed = ev.final === 'TAKE' || ev.final === 'LITTLE';
      return { ...n, score: ev.result.score, allowed, note: allowed ? '' : ev.headline };
    })
    .sort((a, b) => Number(b.allowed) - Number(a.allowed) || b.score - a.score);
}

/** 취침까지 남은 시간 안내 */
export function bedtimeAdvice(profile: UserProfile, atMin: number): string {
  const left = forwardDiff(atMin, toMinutes(profile.routine.bedtime));
  if (left >= 120) return `취침(${profile.routine.bedtime})까지 ${Math.floor(left / 60)}시간 남았습니다. 지금 먹고 2시간 비우면 됩니다`;
  return `취침(${profile.routine.bedtime})까지 ${left}분. 대체식도 절반만, 먹고 바로 눕지 마세요`;
}

/** 방어 성공 시 권하는 부교감 회복 행동 */
export const DEFEND_ACTIONS: readonly string[] = [
  '양치를 먼저 해서 "식사 끝" 신호 주기',
  '4-7-8 호흡 4회',
  '배꼽 위(중완)에 따뜻한 찜질 10분',
  '화면 밝기를 낮추고 30분 안에 눕기',
];

/** 야식 시각이 자정을 넘었으면 전날 기록에 귀속 */
export function nightLogDate(todayIso: string, atMin: number): string {
  return atMin < NIGHT_END_MIN ? addDays(todayIso, -1) : todayIso;
}

export function formatMin(min: number): HHMM {
  return fromMinutes(min);
}
