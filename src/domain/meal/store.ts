import { addDays } from '../shared/time';
import { EMPTY_ENTRY, emptyDayMeals, type DayMeals, type MealEntry } from './day';

/** 날짜 → 그날 입력한 아침·점심 */
export type MealsByDate = Record<string, DayMeals>;

const KEEP_DAYS = 60;

const entryOf = (v: unknown): MealEntry => {
  if (typeof v !== 'object' || v === null) return { ...EMPTY_ENTRY };
  const o = v as Record<string, unknown>;
  return { text: typeof o.text === 'string' ? o.text.slice(0, 600) : '', skipped: o.skipped === true };
};

/** 저장소·백업에서 읽은 값을 안전한 형태로 맞춘다. 날짜 형식이 아닌 키는 버린다 */
export function normalizeMeals(raw: unknown): MealsByDate {
  const out: MealsByDate = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [date, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    out[date] = { breakfast: entryOf(o.breakfast), lunch: entryOf(o.lunch) };
  }
  return out;
}

export function putEntry(all: MealsByDate, date: string, slot: 'breakfast' | 'lunch', entry: MealEntry): MealsByDate {
  const day = all[date] ?? emptyDayMeals();
  return { ...all, [date]: { ...day, [slot]: entry } };
}

/** 오래된 날짜를 정리해 저장 용량을 묶어 둔다 */
export function pruneMeals(all: MealsByDate, today: string): MealsByDate {
  const oldest = addDays(today, -KEEP_DAYS);
  return Object.fromEntries(Object.entries(all).filter(([d]) => d >= oldest));
}
