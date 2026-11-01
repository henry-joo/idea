import { migrateLogs, mergeProfile } from '../log/migrate';
import { normalizeMeals, type MealsByDate } from '../meal/store';
import type { DailyHealthLog } from '../log/types';
import { CONSTITUTIONS, SUB_CONDITIONS, type UserProfile } from '../profile/types';
import { isHHMM } from '../shared/time';

export const BACKUP_APP = 'sungi-diet';
export const BACKUP_VERSION = 3;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  profile: UserProfile;
  logs: DailyHealthLog[];
  /** [v3] 날짜별로 입력한 아침·점심 */
  meals?: MealsByDate;
}

/** 예시 기록은 백업에 넣지 않는다 */
export function createBackup(profile: UserProfile, logs: DailyHealthLog[], now: Date = new Date(), meals: MealsByDate = {}): BackupFile {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), profile, logs: logs.filter((l) => !l.isExample), meals };
}

export const serializeBackup = (b: BackupFile): string => JSON.stringify(b, null, 2);

export type ParsedBackup = { ok: true; profile: UserProfile; logs: DailyHealthLog[]; meals: MealsByDate; warnings: string[] } | { ok: false; error: string };

/**
 * 백업 JSON을 읽는다. 버전이 없거나 1인 이전 기록도 받아서 v2로 올린다(AT-29).
 * 잘못된 값은 조용히 넘기지 않고 경고로 알린다.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다. 내보낸 파일 내용을 통째로 붙여 넣었는지 확인하세요.' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: '백업 파일 형식이 아닙니다.' };
  const o = raw as Record<string, unknown>;
  if (o.app !== undefined && o.app !== BACKUP_APP) return { ok: false, error: '순기 식단 백업이 아닙니다.' };
  if (typeof o.version === 'number' && o.version > BACKUP_VERSION) return { ok: false, error: `더 새로운 버전(${o.version})의 백업입니다. 앱을 최신으로 바꾼 뒤 다시 시도하세요.` };
  if (o.profile === undefined && o.logs === undefined) return { ok: false, error: '프로필도 기록도 들어 있지 않습니다.' };

  const warnings: string[] = [];
  const profile = mergeProfile(o.profile);
  if (!CONSTITUTIONS.includes(profile.constitution)) return { ok: false, error: `알 수 없는 체질 값: ${String(profile.constitution)}` };
  if (!SUB_CONDITIONS.includes(profile.subCondition)) return { ok: false, error: `알 수 없는 병리 상태 값: ${String(profile.subCondition)}` };

  const goodTime = (t: string, where: string) => (isHHMM(t) ? true : (warnings.push(`${where}의 시각 "${t}"는 HH:MM 형식이 아니라 건너뛰었습니다.`), false));
  profile.autonomicStatus.medSchedules = profile.autonomicStatus.medSchedules.filter((t) => goodTime(t, '복약 시각'));
  profile.autonomicStatus.medications = profile.autonomicStatus.medications
    .filter((m) => typeof m?.name === 'string' && m.name.trim())
    .map((m) => ({ ...m, times: (m.times ?? []).filter((t) => goodTime(t, `${m.name} 복약`)) }));

  const total = Array.isArray(o.logs) ? o.logs.length : 0;
  const byDate = new Map<string, DailyHealthLog>();
  for (const l of migrateLogs(o.logs)) if (!l.isExample) byDate.set(l.date, l);
  const dropped = total - byDate.size;
  if (dropped > 0) warnings.push(`기록 ${dropped}건은 날짜가 잘못되었거나 중복이라 제외했습니다.`);
  return { ok: true, profile, logs: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), meals: normalizeMeals(o.meals), warnings };
}
