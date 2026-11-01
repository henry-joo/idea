import { medWindows } from '../../domain/medication/safeguard';
import { NIGHT_END_MIN, NIGHT_START_MIN } from '../../domain/night/funnel';
import type { UserProfile } from '../../domain/profile/types';
import { fromMinutes, toMinutes } from '../../domain/shared/time';

const pct = (min: number) => `${(min / 1440) * 100}%`;
/** 띠 양 끝의 라벨이 밖으로 넘치지 않게 정렬을 바꾼다 */
const edge = (min: number) => (min / 1440 < 0.06 ? ' is-start' : min / 1440 > 0.94 ? ' is-end' : '');

/** 24시간 복약·식사 띠. 복약 ±60분 창, 야식 시간대, 현재 시각을 한 줄에 보여 준다. */
export function Timeline24({ profile, nowMin }: { profile: UserProfile; nowMin: number }) {
  const windows = medWindows(profile);
  const segs = windows.flatMap((w) => (w.start <= w.end ? [[w.start, w.end, w.medTime]] : [[w.start, 1440, w.medTime], [0, w.end, w.medTime]])) as [number, number, string][];
  const meals: [string, string][] = [
    ['아침', profile.routine.breakfast],
    ['점심', profile.routine.lunch],
    ['저녁', profile.routine.dinner],
    ['취침', profile.routine.bedtime],
  ];
  return (
    <figure className="tl" aria-label="오늘의 복약·식사 타임라인">
      <div className="tl-row tl-meds">
        {windows.map((w) => (
          <span key={w.medTime} className={`tl-label tl-med${edge(toMinutes(w.medTime))}`} style={{ left: pct(toMinutes(w.medTime)) }}>
            {w.medTime}
          </span>
        ))}
      </div>
      <div className="tl-track">
        <span className="tl-night" style={{ left: pct(NIGHT_START_MIN), width: pct(1440 - NIGHT_START_MIN) }} />
        <span className="tl-night" style={{ left: 0, width: pct(NIGHT_END_MIN) }} />
        {segs.map(([s, e, t], i) => (
          <span key={`${t}-${i}`} className="tl-window" style={{ left: pct(s), width: pct(e - s) }} />
        ))}
        {windows.map((w) => (
          <span key={w.medTime} className="tl-pin" style={{ left: pct(toMinutes(w.medTime)) }} />
        ))}
        {meals.map(([n, t]) => (
          <span key={n} className="tl-meal" style={{ left: pct(toMinutes(t)) }} />
        ))}
        <span className="tl-now" style={{ left: pct(nowMin) }}>
          <span className="sr-only">지금 {fromMinutes(nowMin)}</span>
        </span>
      </div>
      <div className="tl-row tl-meals">
        {meals.map(([n, t]) => (
          <span key={n} className={`tl-label${edge(toMinutes(t))}`} style={{ left: pct(toMinutes(t)) }}>
            {n}
          </span>
        ))}
      </div>
      <div className="tl-row tl-hours" aria-hidden="true">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className={`tl-hour${edge(h * 60)}`} style={{ left: pct(h * 60) }}>
            {h}
          </span>
        ))}
      </div>
      <figcaption className="tl-legend">
        <span><i className="sw sw-window" />복약 ±60분: 한방차·유제품·과일 보류</span>
        <span><i className="sw sw-night" />야식 시간대 21:00–04:00</span>
        <span><i className="sw sw-meal" />식사·취침</span>
      </figcaption>
    </figure>
  );
}
