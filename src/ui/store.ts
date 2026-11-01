import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MealSlot } from '../domain/cafeteria/tray';
import { exampleLogs } from '../domain/log/examples';
import { emptyLog, type DailyHealthLog } from '../domain/log/types';
import type { FunnelState } from '../domain/night/funnel';
import { DEFAULT_PROFILE } from '../domain/profile/defaults';
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

function mergeProfile(saved: UserProfile | null): UserProfile {
  if (!saved) return DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...saved,
    autonomicStatus: { ...DEFAULT_PROFILE.autonomicStatus, ...saved.autonomicStatus },
    mealEnvironment: { ...DEFAULT_PROFILE.mealEnvironment, ...saved.mealEnvironment },
    routine: { ...DEFAULT_PROFILE.routine, ...(saved.routine ?? {}) },
  };
}

export function useAppStore(): AppStore {
  const now = useNow();
  const today = isoDate(now);
  const nowMin = nowMinutes(now);
  const [route, go] = useHashRoute();

  const [profile, setProfileState] = useState<UserProfile>(() => mergeProfile(repo.loadProfile()));
  const [logs, setLogs] = useState<DailyHealthLog[]>(() => repo.loadLogs() ?? exampleLogs(isoDate()));
  const [funnel, setFunnelState] = useState<FunnelState | null>(() => repo.loadFunnel());
  const [trayMeal, setTrayMeal] = useState<MealSlot>(() => (nowMinutes() < 10 * 60 ? 'BREAKFAST' : 'LUNCH'));

  useEffect(() => repo.saveLogs(logs), [logs]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    repo.saveProfile(p);
  }, []);
  const setFunnel = useCallback((f: FunnelState | null) => {
    setFunnelState(f);
    repo.saveFunnel(f);
  }, []);

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
