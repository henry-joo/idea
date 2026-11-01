import type { MedWindowClass } from '../food/types';
import type { UserProfile } from '../profile/types';
import { fromMinutes, inCircularRange, toMinutes, type HHMM } from '../shared/time';

/** 명세 §3-3: 복약 전후 최소 60분 */
export const MED_BUFFER_MIN = 60;

export const MED_CLASS_LABEL: Record<MedWindowClass, string> = {
  HERBAL_TEA: '한방차',
  DAIRY: '유제품',
  FRUIT: '과일',
};

export const RESTRICTED_CLASSES: readonly MedWindowClass[] = ['HERBAL_TEA', 'DAIRY', 'FRUIT'];

export interface MedWindow {
  medTime: HHMM;
  /** 자정 기준 분. start > end면 자정을 넘는 창 */
  start: number;
  end: number;
  label: string;
}

/** 기본 복약 시각 + 약 목록에 적은 시각을 합친 하루 복약 시각 (중복 제거, 정렬) */
export function effectiveMedTimes(profile: UserProfile): HHMM[] {
  if (!profile.autonomicStatus.takingWesternMeds) return [];
  const all = [...profile.autonomicStatus.medSchedules, ...(profile.autonomicStatus.medications ?? []).flatMap((m) => m.times)];
  return [...new Set(all)].sort((a, b) => toMinutes(a) - toMinutes(b));
}

/** 복약 시각마다 [t-60, t+60] 제한 창을 만든다. */
export function medWindows(profile: UserProfile): MedWindow[] {
  return effectiveMedTimes(profile)
    .map((t) => {
      const m = toMinutes(t);
      const start = m - MED_BUFFER_MIN;
      const end = m + MED_BUFFER_MIN;
      return {
        medTime: t,
        start: ((start % 1440) + 1440) % 1440,
        end: end % 1440,
        label: `${fromMinutes(start)}–${fromMinutes(end)}`,
      };
    });
}

export function activeWindow(profile: UserProfile, atMin: number): MedWindow | null {
  return medWindows(profile).find((w) => inCircularRange(atMin, w.start, w.end)) ?? null;
}

export interface IntakeCheck {
  allowed: boolean;
  window: MedWindow | null;
  /** 막혔을 때 다시 허용되는 시각 */
  nextAllowedAt: HHMM | null;
  reason: string | null;
}

/**
 * 시간대 가드: 해당 분류(한방차·유제품·과일)를 atMin 시각에 먹어도 되는가.
 * 창이 겹치면(복약 간격 < 120분) 연쇄된 창의 마지막 끝까지 미룬다.
 */
export function checkIntakeAt(profile: UserProfile, cls: MedWindowClass | null, atMin: number): IntakeCheck {
  if (!cls) return { allowed: true, window: null, nextAllowedAt: null, reason: null };
  const w = activeWindow(profile, atMin);
  if (!w) return { allowed: true, window: null, nextAllowedAt: null, reason: null };

  let cur = w;
  let end = w.end;
  for (let guard = 0; guard < 10; guard++) {
    const next = activeWindow(profile, end + 1);
    if (!next || next.medTime === cur.medTime) break;
    cur = next;
    end = next.end;
  }
  const nextAllowed = fromMinutes(end + 1);
  return {
    allowed: false,
    window: w,
    nextAllowedAt: nextAllowed,
    reason: `${w.medTime} 복약 ±${MED_BUFFER_MIN}분 (${w.label}): ${MED_CLASS_LABEL[cls]} 보류 → ${nextAllowed}부터`,
  };
}

/** 하루 타임라인용: 현재 시각 기준 상태 요약 */
export function medStatusAt(profile: UserProfile, atMin: number) {
  const w = activeWindow(profile, atMin);
  const all = medWindows(profile);
  const upcoming =
    all
      .map((x) => ({ x, d: (((x.start - atMin) % 1440) + 1440) % 1440 }))
      .filter(({ x }) => x !== w)
      .sort((a, b) => a.d - b.d)[0]?.x ?? null;
  return { active: w, upcoming };
}
