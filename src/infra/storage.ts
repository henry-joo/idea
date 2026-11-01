import type { DailyHealthLog } from '../domain/log/types';
import type { FunnelState } from '../domain/night/funnel';
import type { UserProfile } from '../domain/profile/types';

/**
 * 저장소 포트. 지금은 브라우저 localStorage 어댑터 하나지만,
 * 서버 동기화(예: REST·Supabase)로 바꿀 때 이 인터페이스만 다시 구현하면 된다.
 */
export interface HealthRepository {
  loadProfile(): UserProfile | null;
  saveProfile(p: UserProfile): void;
  loadLogs(): DailyHealthLog[] | null;
  saveLogs(logs: DailyHealthLog[]): void;
  loadFunnel(): FunnelState | null;
  saveFunnel(f: FunnelState | null): void;
}

const PREFIX = 'sungi.v1.';

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 사생활 보호 모드 등에서 저장이 막혀도 화면은 동작한다 */
  }
}

export const localRepository: HealthRepository = {
  loadProfile: () => read<UserProfile>('profile'),
  saveProfile: (p) => write('profile', p),
  loadLogs: () => read<DailyHealthLog[]>('logs'),
  saveLogs: (logs) => write('logs', logs),
  loadFunnel: () => read<FunnelState>('funnel'),
  saveFunnel: (f) => write('funnel', f),
};
