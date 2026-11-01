import { DEFAULT_PROFILE } from '../profile/defaults';
import type { UserProfile } from '../profile/types';
import { emptyLog, type DailyHealthLog, type MorningPortion } from './types';

type Loose = Record<string, any>;
const isObj = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v1 기록 → v2 기록 (AT-29).
 *  - cafeteriaFilterLog.morningPortionReduced(boolean) → morningPortion(50|100)
 *  - dinnerLog 없으면 기본값 채움
 * 알 수 없는 필드는 버리고, 빠진 필드는 빈 기록 값으로 채운다.
 */
export function migrateLog(input: unknown): DailyHealthLog | null {
  if (!isObj(input) || typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  const base = emptyLog(input.date);
  const cf: Loose = isObj(input.cafeteriaFilterLog) ? input.cafeteriaFilterLog : {};
  let portion: MorningPortion = base.cafeteriaFilterLog.morningPortion;
  if (cf.morningPortion === 100 || cf.morningPortion === 75 || cf.morningPortion === 50) portion = cf.morningPortion;
  else if (cf.morningPortionReduced === true) portion = 50;
  const obj = (k: string): Loose => (isObj(input[k]) ? (input[k] as Loose) : {});
  const log: DailyHealthLog = {
    date: input.date,
    vagalToneRoutine: { ...base.vagalToneRoutine, ...pick(obj('vagalToneRoutine'), base.vagalToneRoutine) },
    cafeteriaFilterLog: {
      morningPortion: portion,
      avoidedColdSaladAndPork: cf.avoidedColdSaladAndPork === true,
      includedRadishOrWarmSoup: cf.includedRadishOrWarmSoup === true,
    },
    dinnerLog: { ...base.dinnerLog, ...pick(obj('dinnerLog'), base.dinnerLog) },
    lateNightDefense: { ...base.lateNightDefense, ...pick(obj('lateNightDefense'), base.lateNightDefense) },
    symptomFeedback: { ...base.symptomFeedback, ...pick(obj('symptomFeedback'), base.symptomFeedback) },
  };
  if (input.isExample === true) log.isExample = true;
  return log;
}

/** base에 있는 키 중 같은 타입의 값만 가져온다 */
function pick<T extends Loose>(src: Loose, base: T): Partial<T> {
  const out: Loose = {};
  for (const k of Object.keys(base)) {
    const v = src[k];
    const b = base[k];
    if (v === undefined) continue;
    if (b === null ? typeof v === 'string' || v === null : typeof v === typeof b) out[k] = v;
  }
  return out as Partial<T>;
}

export function migrateLogs(input: unknown): DailyHealthLog[] {
  if (!Array.isArray(input)) return [];
  return input.map(migrateLog).filter((l): l is DailyHealthLog => l !== null);
}

/** 저장된(또는 가져온) 프로필에 v2 필드를 채운다 */
export function mergeProfile(saved: unknown): UserProfile {
  if (!isObj(saved)) return DEFAULT_PROFILE;
  const s = saved as Partial<UserProfile>;
  return {
    ...DEFAULT_PROFILE,
    ...s,
    autonomicStatus: {
      ...DEFAULT_PROFILE.autonomicStatus,
      ...(s.autonomicStatus ?? {}),
      medications: Array.isArray(s.autonomicStatus?.medications) ? s.autonomicStatus!.medications : [],
    },
    mealEnvironment: { ...DEFAULT_PROFILE.mealEnvironment, ...(s.mealEnvironment ?? {}) },
    routine: { ...DEFAULT_PROFILE.routine, ...(s.routine ?? {}) },
    holidayDates: Array.isArray(s.holidayDates) ? s.holidayDates : [],
  };
}
