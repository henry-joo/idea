import { addDays } from '../shared/time';
import type { DailyHealthLog, NightOutcome, Scale5 } from './types';

/**
 * 첫 화면용 예시 기록 14일. 사용자의 실제 기록이 아님을 isExample로 표시한다.
 * 패턴: 1주차엔 야식이 잦고 명치 답답함이 높다가, 2주차에 방어율이 오르며 내려간다.
 */
export function exampleLogs(today: string): DailyHealthLog[] {
  // 날짜 오름차순 (13일 전 → 오늘)
  const nights: (NightOutcome | null)[] = [
    'HEAVY_SNACK', 'HEAVY_SNACK', 'SAFE_SUBSTITUTE', 'HEAVY_SNACK', null, 'SAFE_SUBSTITUTE', 'HEAVY_SNACK',
    'DEFENDED', 'SAFE_SUBSTITUTE', 'DEFENDED', null, 'DEFENDED', 'SAFE_SUBSTITUTE', 'DEFENDED',
  ];
  const fasting: Record<NightOutcome, number> = { HEAVY_SNACK: 8.5, SAFE_SUBSTITUTE: 10, DEFENDED: 13 };
  const logs: DailyHealthLog[] = [];
  for (let i = 0; i < nights.length; i++) {
    const date = addDays(today, i - (nights.length - 1));
    const prev = i > 0 ? nights[i - 1] : 'HEAVY_SNACK';
    const n = nights[i] ?? null;
    const week2 = i >= 7;
    const base = prev === 'HEAVY_SNACK' ? 4.4 : prev === 'SAFE_SUBSTITUTE' ? 3.3 : 2.4;
    const stuff = Math.max(1, Math.min(5, Math.round(base - (week2 ? 0.5 : 0) + ((i * 7) % 3 === 0 ? 0.4 : 0)))) as Scale5;
    const tension = Math.max(1, Math.min(5, Math.round(stuff - 0.4 + (i % 4 === 1 ? 1 : 0)))) as Scale5;
    logs.push({
      date,
      isExample: true,
      vagalToneRoutine: {
        preMealBreathing478: week2 ? i % 4 !== 2 : i % 3 === 0,
        postMealWalk15Min: week2 ? i % 3 !== 1 : i % 2 === 0,
        warmWaterOnly: week2 || i % 2 === 1,
      },
      cafeteriaFilterLog: {
        morningPortion: prev === 'HEAVY_SNACK' ? 50 : prev === 'SAFE_SUBSTITUTE' ? 75 : 100,
        avoidedColdSaladAndPork: week2 ? i % 5 !== 3 : i % 3 === 1,
        includedRadishOrWarmSoup: week2 || i % 2 === 0,
      },
      dinnerLog: { eatenAt: '19:00', amount: 'NORMAL', finishedBeforeCutoff: true },
      lateNightDefense: {
        cravingOccurred: n !== null,
        teaTimer15MinCompleted: n === 'DEFENDED' || (n === 'SAFE_SUBSTITUTE' && week2),
        outcome: n ?? 'DEFENDED',
        fastingHoursToMorning: n ? fasting[n] : 12.5,
      },
      symptomFeedback: { epigastricStuffiness: stuff, autonomicTension: tension },
    });
  }
  return logs;
}
