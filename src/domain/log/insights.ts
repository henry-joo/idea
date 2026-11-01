import { FASTING_TARGET_HOURS } from '../night/funnel';
import { addDays } from '../shared/time';
import type { DailyHealthLog, NightOutcome } from './types';

export type NightGroup = NightOutcome | 'NO_CRAVING';

export const NIGHT_GROUP_LABEL: Record<NightGroup, string> = {
  NO_CRAVING: '야식 욕구 없음',
  DEFENDED: '방어 성공',
  SAFE_SUBSTITUTE: '대체식',
  HEAVY_SNACK: '일반 야식',
};

export function nightGroup(log: DailyHealthLog): NightGroup {
  return log.lateNightDefense.cravingOccurred ? log.lateNightDefense.outcome : 'NO_CRAVING';
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export interface Insights {
  days: number;
  stuffiness7: number | null;
  stuffinessPrev7: number | null;
  /** 전날 밤 결과별 다음 날 명치 답답함 평균 */
  nextDayStuffinessByNight: { group: NightGroup; mean: number | null; n: number }[];
  routineRate: { breathing: number; walk: number; warmWater: number };
  fastingGoalRate: number | null;
  defenseRate: number | null;
}

/** logs: 날짜 무관 순서. 내부에서 정렬한다. */
export function computeInsights(logs: DailyHealthLog[], today: string): Insights {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const inRange = (from: number, to: number) => {
    const out: DailyHealthLog[] = [];
    for (let i = from; i <= to; i++) {
      const l = byDate.get(addDays(today, -i));
      if (l) out.push(l);
    }
    return out;
  };
  const last7 = inRange(0, 6);
  const prev7 = inRange(7, 13);

  const groups: NightGroup[] = ['NO_CRAVING', 'DEFENDED', 'SAFE_SUBSTITUTE', 'HEAVY_SNACK'];
  const pairs = sorted
    .map((l) => ({ night: l, next: byDate.get(addDays(l.date, 1)) }))
    .filter((p): p is { night: DailyHealthLog; next: DailyHealthLog } => !!p.next);
  const nextDayStuffinessByNight = groups.map((g) => {
    const xs = pairs.filter((p) => nightGroup(p.night) === g).map((p) => p.next.symptomFeedback.epigastricStuffiness);
    return { group: g, mean: round1(mean(xs)), n: xs.length };
  });

  const n = sorted.length || 1;
  const rate = (f: (l: DailyHealthLog) => boolean) => Math.round((sorted.filter(f).length / n) * 100);
  const cravings = sorted.filter((l) => l.lateNightDefense.cravingOccurred);

  return {
    days: sorted.length,
    stuffiness7: round1(mean(last7.map((l) => l.symptomFeedback.epigastricStuffiness))),
    stuffinessPrev7: round1(mean(prev7.map((l) => l.symptomFeedback.epigastricStuffiness))),
    nextDayStuffinessByNight,
    routineRate: {
      breathing: rate((l) => l.vagalToneRoutine.preMealBreathing478),
      walk: rate((l) => l.vagalToneRoutine.postMealWalk15Min),
      warmWater: rate((l) => l.vagalToneRoutine.warmWaterOnly),
    },
    fastingGoalRate: sorted.length ? rate((l) => l.lateNightDefense.fastingHoursToMorning >= FASTING_TARGET_HOURS) : null,
    defenseRate: cravings.length
      ? Math.round((cravings.filter((l) => l.lateNightDefense.outcome !== 'HEAVY_SNACK').length / cravings.length) * 100)
      : null,
  };
}

// ── 레드 플래그 (진료 권고) ─────────────────────────────

export interface RedFlag {
  id: string;
  level: 'WARN' | 'URGENT';
  message: string;
}

/**
 * 기록만으로 판단할 수 있는 진료 권고.
 * 명치 답답함은 위염·궤양·담낭 질환, 드물게 심장 질환의 신호일 수 있어
 * 식단 앱이 '참고 넘길' 수준을 넘으면 분명하게 말해야 한다.
 */
export function detectRedFlags(logs: DailyHealthLog[], today: string): RedFlag[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const streak = (pred: (l: DailyHealthLog) => boolean) => {
    let k = 0;
    for (let i = 0; i < 30; i++) {
      const l = byDate.get(addDays(today, -i));
      if (!l || !pred(l)) break;
      k++;
    }
    return k;
  };
  const flags: RedFlag[] = [];
  const stuffy = streak((l) => l.symptomFeedback.epigastricStuffiness >= 4);
  if (stuffy >= 7) {
    flags.push({ id: 'stuffy7', level: 'URGENT', message: `명치 답답함 4 이상이 ${stuffy}일째입니다. 식단 조절로 풀릴 단계를 지났을 수 있으니 소화기내과·한의원 진료를 받으세요.` });
  } else if (stuffy >= 3) {
    flags.push({ id: 'stuffy3', level: 'WARN', message: `명치 답답함 4 이상이 ${stuffy}일 연속입니다. 1주를 넘기면 진료를 받으세요.` });
  }
  const tense = streak((l) => l.symptomFeedback.autonomicTension >= 5);
  if (tense >= 3) {
    flags.push({ id: 'tension3', level: 'WARN', message: `긴장·피로 5가 ${tense}일째입니다. 복용 중인 약의 조절이 필요한지 처방의와 상의하세요.` });
  }
  return flags;
}

/** 기록과 무관하게 항상 노출하는 즉시 진료 신호 */
export const ALWAYS_RED_FLAGS: readonly string[] = [
  '가슴을 조이거나 왼팔·턱으로 번지는 통증, 식은땀 (명치 통증이 심장 문제일 수 있음) → 119',
  '검은 변, 피를 토함',
  '삼키기 어려움, 원인 없는 체중 감소',
  '밤에 깰 만큼 심한 명치 통증, 반복되는 구토',
];
