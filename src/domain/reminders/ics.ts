import type { Reminder } from './schedule';

const CRLF = '\r\n';

/** iCalendar TEXT 값 이스케이프 (RFC 5545 §3.3.11) */
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** 한 줄이 75옥텟을 넘으면 CRLF + 공백으로 접는다. UTF-8 글자 중간에서 자르지 않는다. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
      limit = 74; // 이어지는 줄은 앞 공백 1옥텟을 쓴다
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join(CRLF + ' ');
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 기기 로컬 시각 그대로(타임존 없는 floating time)라 어느 시간대에서도 같은 시각에 울린다 */
function dtLocal(dateIso: string, hhmm: string): string {
  return `${dateIso.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;
}
function dtUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** 매일 반복 일정 + 정각 알림이 들어 있는 .ics 텍스트 (D7) */
export function buildIcs(reminders: Reminder[], startDateIso: string, now: Date = new Date(), calName = '순기 식단'): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//sungi-diet//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(calName)}`];
  const stamp = dtUtc(now);
  for (const r of reminders) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.id}@sungi-diet`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtLocal(startDateIso, r.time)}`,
      'DURATION:PT10M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${escapeText(r.title)}`,
      `DESCRIPTION:${escapeText(r.body)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0M',
      `DESCRIPTION:${escapeText(r.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
}
