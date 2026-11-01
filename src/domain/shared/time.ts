/** "HH:MM" 24시간제 문자열 */
export type HHMM = string;

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isHHMM(v: string): v is HHMM {
  return HHMM_RE.test(v);
}

/** "08:30" → 510 (자정 기준 분) */
export function toMinutes(t: HHMM): number {
  const m = HHMM_RE.exec(t);
  if (!m) throw new Error(`잘못된 시각 형식: ${t}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 510 → "08:30". 음수·1440 이상은 하루 단위로 접는다. */
export function fromMinutes(min: number): HHMM {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * 자정을 넘는 구간도 다루는 원형(circular) 포함 판정.
 * [start, end] 양 끝 포함. start > end면 자정을 넘는 구간.
 */
export function inCircularRange(min: number, start: number, end: number): boolean {
  const x = ((min % 1440) + 1440) % 1440;
  const s = ((start % 1440) + 1440) % 1440;
  const e = ((end % 1440) + 1440) % 1440;
  return s <= e ? x >= s && x <= e : x >= s || x <= e;
}

/** from → to 까지 앞으로 흐르는 분 (to가 from보다 이르면 다음 날로 본다) */
export function forwardDiff(from: number, to: number): number {
  return (((to - from) % 1440) + 1440) % 1440;
}

/** 로컬 날짜 "YYYY-MM-DD" */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoDate(dt);
}
