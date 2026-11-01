import { dinnerCutoff } from '../meal/recommend';
import { effectiveMedTimes, MED_BUFFER_MIN } from '../medication/safeguard';
import type { UserProfile } from '../profile/types';
import { fromMinutes, toMinutes, type HHMM } from '../shared/time';

export type ReminderKind = 'MED_CUTOFF' | 'MED' | 'NIGHT' | 'DINNER_CUTOFF';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  time: HHMM;
  title: string;
  body: string;
}

/**
 * 하루 알림 목록 (D7). 알림 방식(캘린더 .ics / 앱 열림 알림)과 무관하게 이 목록이 단일 출처다.
 *  - 복약 60분 전: 한방차·과일·유제품 마감
 *  - 복약 시각
 *  - 21:00 야식 퍼널
 *  - 저녁 마감 (취침 3시간 전)
 */
export function dailyReminders(profile: UserProfile): Reminder[] {
  const out: Reminder[] = [];
  for (const t of effectiveMedTimes(profile)) {
    const m = toMinutes(t);
    const cutoff = fromMinutes(m - MED_BUFFER_MIN);
    out.push({
      id: `med-cutoff-${t}`,
      kind: 'MED_CUTOFF',
      time: cutoff,
      title: '한방차·과일·유제품 마감',
      body: `${t} 복약 1시간 전입니다. 지금부터 복약 1시간 뒤까지는 물만 드세요`,
    });
    out.push({
      id: `med-${t}`,
      kind: 'MED',
      time: t,
      title: '복약 시간',
      body: `${t} 복약 시간입니다. 한방차·과일·유제품은 ${fromMinutes(m + MED_BUFFER_MIN + 1)} 이후에 드세요`,
    });
  }
  out.push({
    id: 'night-funnel',
    kind: 'NIGHT',
    time: '21:00',
    title: '야식 시간대 시작',
    body: '배가 고프면 바로 먹지 말고 따뜻한 차 한 잔과 15분 기다리기부터 해 보세요',
  });
  out.push({
    id: 'dinner-cutoff',
    kind: 'DINNER_CUTOFF',
    time: dinnerCutoff(profile),
    title: '저녁 마감',
    body: `취침 3시간 전입니다. 지금부터는 먹지 않고 위를 쉬게 해 주세요`,
  });
  return out.sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || a.id.localeCompare(b.id));
}
