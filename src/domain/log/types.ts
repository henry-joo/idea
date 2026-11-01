export type Scale5 = 1 | 2 | 3 | 4 | 5;
export type NightOutcome = 'DEFENDED' | 'SAFE_SUBSTITUTE' | 'HEAVY_SNACK';
export type MorningPortion = 100 | 75 | 50;
export type DinnerAmount = 'SKIPPED' | 'LIGHT' | 'NORMAL' | 'HEAVY';

/** 명세 §5-3 DailyHealthLog (필드 그대로) + 예시 데이터 표시 확장 */
export interface DailyHealthLog {
  date: string;
  vagalToneRoutine: {
    preMealBreathing478: boolean;
    postMealWalk15Min: boolean;
    warmWaterOnly: boolean;
  };
  cafeteriaFilterLog: {
    /** [v2] D2: 전날 일반 야식 50 · 대체식 75 · 그 외 100 (v1의 morningPortionReduced 대체) */
    morningPortion: MorningPortion;
    avoidedColdSaladAndPork: boolean;
    includedRadishOrWarmSoup: boolean;
  };
  /** [v2] D6 */
  dinnerLog: {
    eatenAt: string | null;
    amount: DinnerAmount;
    /** 취침 3시간 전까지 마쳤는가 */
    finishedBeforeCutoff: boolean;
  };
  lateNightDefense: {
    cravingOccurred: boolean;
    teaTimer15MinCompleted: boolean;
    outcome: NightOutcome;
    fastingHoursToMorning: number;
  };
  symptomFeedback: {
    epigastricStuffiness: Scale5;
    autonomicTension: Scale5;
  };
  /** [확장] 첫 화면용 예시 기록 표시 */
  isExample?: boolean;
}

export function emptyLog(date: string): DailyHealthLog {
  return {
    date,
    vagalToneRoutine: { preMealBreathing478: false, postMealWalk15Min: false, warmWaterOnly: false },
    cafeteriaFilterLog: { morningPortion: 100, avoidedColdSaladAndPork: false, includedRadishOrWarmSoup: false },
    dinnerLog: { eatenAt: null, amount: 'NORMAL', finishedBeforeCutoff: true },
    lateNightDefense: { cravingOccurred: false, teaTimer15MinCompleted: false, outcome: 'DEFENDED', fastingHoursToMorning: 12 },
    symptomFeedback: { epigastricStuffiness: 3, autonomicTension: 3 },
  };
}

/** 전날 밤 결과 → 다음 날 아침 식사량 (D2) */
export function morningPortionAfter(log: DailyHealthLog | null | undefined): MorningPortion {
  if (!log || !log.lateNightDefense.cravingOccurred) return 100;
  switch (log.lateNightDefense.outcome) {
    case 'HEAVY_SNACK':
      return 50;
    case 'SAFE_SUBSTITUTE':
      return 75;
    default:
      return 100;
  }
}

/** 전날 밤에 무언가를 먹었는가 (대체식 포함) */
export function ateLateNight(log: DailyHealthLog | null | undefined): boolean {
  if (!log) return false;
  const n = log.lateNightDefense;
  return n.cravingOccurred && n.outcome !== 'DEFENDED';
}
