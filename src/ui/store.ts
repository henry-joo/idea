import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MealSlot } from '../domain/cafeteria/tray';
import { exampleLogs } from '../domain/log/examples';
import { emptyLog, type DailyHealthLog } from '../domain/log/types';
import type { FunnelState } from '../domain/night/funnel';
import { DEFAULT_PROFILE } from '../domain/profile/defaults';
import { isHomeDay } from '../domain/meal/recommend';
import { emptyDayMeals, type DayMeals, type MealEntry } from '../domain/meal/day';
import { pruneMeals, putEntry, type MealsByDate } from '../domain/meal/store';
import type { UserProfile } from '../domain/profile/types';
import { addDays, isoDate, nowMinutes } from '../domain/shared/time';
import { localRepository as repo } from '../infra/storage';
import { useHashRoute, useNow, type Route } from './hooks';

export interface AppStore {
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  /** 화면 표시용 전체 기록 (예시 포함) */
  logs: DailyHealthLog[];
  /** 실제 사용자 기록만 */
  realLogs: DailyHealthLog[];
  showingExamples: boolean;
  getLog: (date: string) => DailyHealthLog;
  /** 기록 수정. 첫 실제 기록이 저장되면 예시는 사라진다 */
  upsertLog: (date: string, update: (l: DailyHealthLog) => DailyHealthLog) => void;
  clearExamples: () => void;
  /** 백업 복원: 프로필과 실제 기록을 통째로 바꾼다 */
  replaceData: (profile: UserProfile, logs: DailyHealthLog[], meals?: MealsByDate) => void;
  /** 날짜별로 입력한 아침·점심 */
  meals: MealsByDate;
  mealsOf: (date: string) => DayMeals;
  setMealEntry: (date: string, slot: 'breakfast' | 'lunch', entry: MealEntry) => void;
  /** 오늘이 주말·쉬는 날이라 아침·점심도 집밥인가 */
  homeDay: boolean;
  notifyOn: boolean;
  setNotifyOn: (on: boolean) => void;
  funnel: FunnelState | null;
  setFunnel: (f: FunnelState | null) => void;
  now: Date;
  nowMin: number;
  today: string;
  yesterdayReal: DailyHealthLog | null;
  route: Route;
  go: (r: Route) => void;
  trayMeal: MealSlot;
  setTrayMeal: (m: MealSlot) => void;
}

const FUNNEL_MAX_AGE_MS = 8 * 60 * 60_000;

/** 오래된 야식 퍼널(어제 밤 등)은 이어서 보여 주지 않는다. 타이머는 시작 후 15분 시점(timerEndsAtMs)이 기준 */
function freshFunnel(f: FunnelState | null): FunnelState | null {
  if (!f) return null;
  if (f.timerEndsAtMs === null) return null;
  return Date.now() - f.timerEndsAtMs > FUNNEL_MAX_AGE_MS ? null : f;
}

export function useAppStore(): AppStore {
  const now = useNow();
  const today = isoDate(now);
  const nowMin = nowMinutes(now);
  const [route, go] = useHashRoute();

  const [profile, setProfileState] = useState<UserProfile>(() => repo.loadProfile() ?? DEFAULT_PROFILE);
  const [logs, setLogs] = useState<DailyHealthLog[]>(() => repo.loadLogs() ?? exampleLogs(isoDate()));
  const [funnel, setFunnelState] = useState<FunnelState | null>(() => freshFunnel(repo.loadFunnel()));
  const [meals, setMeals] = useState<MealsByDate>(() => repo.loadMeals() ?? {});
  const [notifyOn, setNotifyOnState] = useState<boolean>(() => repo.loadNotifyOn());
  const [trayMeal, setTrayMeal] = useState<MealSlot>(() => (nowMinutes() < 10 * 60 ? 'BREAKFAST' : 'LUNCH'));

  useEffect(() => repo.saveLogs(logs), [logs]);
  useEffect(() => repo.saveMeals(meals), [meals]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    repo.saveProfile(p);
  }, []);
  const setFunnel = useCallback((f: FunnelState | null) => {
    setFunnelState(f);
    repo.saveFunnel(f);
  }, []);

  const setNotifyOn = useCallback((on: boolean) => {
    setNotifyOnState(on);
    repo.saveNotifyOn(on);
  }, []);

  const replaceData = useCallback(
    (p: UserProfile, l: DailyHealthLog[], m?: MealsByDate) => {
      setProfile(p);
      setLogs(l.length ? l : []);
      if (m) setMeals(m);
    },
    [setProfile],
  );

  const mealsOf = useCallback((date: string) => meals[date] ?? emptyDayMeals(), [meals]);
  const setMealEntry = useCallback(
    (date: string, slot: 'breakfast' | 'lunch', entry: MealEntry) => setMeals((prev) => pruneMeals(putEntry(prev, date, slot, entry), date)),
    [],
  );

  const realLogs = useMemo(() => logs.filter((l) => !l.isExample), [logs]);
  const showingExamples = logs.length > 0 && realLogs.length === 0;

  const getLog = useCallback(
    (date: string) => realLogs.find((l) => l.date === date) ?? emptyLog(date),
    [realLogs],
  );

  const upsertLog = useCallback((date: string, update: (l: DailyHealthLog) => DailyHealthLog) => {
    setLogs((prev) => {
      const real = prev.filter((l) => !l.isExample);
      const base = real.find((l) => l.date === date) ?? emptyLog(date);
      const next = { ...update(base), date };
      delete next.isExample;
      return [...real.filter((l) => l.date !== date), next].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, []);

  const clearExamples = useCallback(() => setLogs((prev) => prev.filter((l) => !l.isExample)), []);

  const yesterdayReal = realLogs.find((l) => l.date === addDays(today, -1)) ?? null;

  return {
    profile,
    setProfile,
    logs,
    realLogs,
    showingExamples,
    getLog,
    upsertLog,
    clearExamples,
    replaceData,
    meals,
    mealsOf,
    setMealEntry,
    homeDay: isHomeDay(profile, today),
    notifyOn,
    setNotifyOn,
    funnel,
    setFunnel,
    now,
    nowMin,
    today,
    yesterdayReal,
    route,
    go,
    trayMeal,
    setTrayMeal,
  };
}
