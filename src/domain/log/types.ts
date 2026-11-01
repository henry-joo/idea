export type Scale5 = 1 | 2 | 3 | 4 | 5;
export type NightOutcome = 'DEFENDED' | 'SAFE_SUBSTITUTE' | 'HEAVY_SNACK';

/** 명세 §5-3 DailyHealthLog (필드 그대로) + 예시 데이터 표시 확장 */
export interface DailyHealthLog {
  date: string;
  vagalToneRoutine: {
    preMealBreathing478: boolean;
    postMealWalk15Min: boolean;
    warmWaterOnly: boolean;
  };
  cafeteriaFilterLog: {
    morningPortionReduced: boolean;
    avoidedColdSaladAndPork: boolean;
    includedRadishOrWarmSoup: boolean;
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
    cafeteriaFilterLog: { morningPortionReduced: false, avoidedColdSaladAndPork: false, includedRadishOrWarmSoup: false },
    lateNightDefense: { cravingOccurred: false, teaTimer15MinCompleted: false, outcome: 'DEFENDED', fastingHoursToMorning: 12 },
    symptomFeedback: { epigastricStuffiness: 3, autonomicTension: 3 },
  };
}

/** 전날 밤에 무언가를 먹었는가 (대체식 포함) */
export function ateLateNight(log: DailyHealthLog | null | undefined): boolean {
  if (!log) return false;
  const n = log.lateNightDefense;
  return n.cravingOccurred && n.outcome !== 'DEFENDED';
}
