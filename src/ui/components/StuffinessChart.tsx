import { useState } from 'react';
import { NIGHT_GROUP_LABEL, nightGroup, type NightGroup } from '../../domain/log/insights';
import type { DailyHealthLog } from '../../domain/log/types';
import { addDays } from '../../domain/shared/time';

const W = 340;
const H = 168;
const PAD = { l: 22, r: 6, t: 10, b: 40 };
const DAYS = 14;

/** 전날 밤 결과 표식: 색이 아니라 모양으로 구분 */
function NightMark({ g, x, y }: { g: NightGroup; x: number; y: number }) {
  switch (g) {
    case 'DEFENDED':
      return <circle cx={x} cy={y} r={4} className="mk mk-fill" />;
    case 'SAFE_SUBSTITUTE':
      return <circle cx={x} cy={y} r={3.5} className="mk mk-ring" />;
    case 'HEAVY_SNACK':
      return <path d={`M${x} ${y - 4.5} L${x + 4.5} ${y + 3.5} L${x - 4.5} ${y + 3.5}Z`} className="mk mk-fill" />;
    default:
      return <line x1={x - 3} x2={x + 3} y1={y} y2={y} className="mk mk-line" />;
  }
}

/**
 * 최근 14일 명치 답답함(1~5) 막대 + 막대 아래에 '그 전날 밤' 야식 결과 표식.
 * 단일 계열이므로 범례 상자 없이 제목이 계열을 말한다.
 */
export function StuffinessChart({ logs, today }: { logs: DailyHealthLog[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i - (DAYS - 1)));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const band = innerW / DAYS;
  const barW = Math.min(14, band * 0.56);
  const y = (v: number) => PAD.t + innerH - (v / 5) * innerH;
  const base = y(0);

  const hv = hover !== null ? days[hover]! : null;
  const hl = hv ? byDate.get(hv) : undefined;
  const hprev = hv ? byDate.get(addDays(hv, -1)) : undefined;

  return (
    <figure className="chart">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="최근 14일 명치 답답함 지수">
          {[1, 2, 3, 4, 5].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="grid" />
              {v % 2 === 1 && (
                <text x={PAD.l - 6} y={y(v) + 3.5} className="axis" textAnchor="end">
                  {v}
                </text>
              )}
            </g>
          ))}
          <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} className="baseline" />
          {days.map((d, i) => {
            const l = byDate.get(d);
            const cx = PAD.l + band * i + band / 2;
            const prev = byDate.get(addDays(d, -1));
            const v = l?.symptomFeedback.epigastricStuffiness;
            const top = v ? y(v) : base;
            const r = Math.min(4, barW / 2);
            return (
              <g key={d}>
                {v && (
                  <path
                    className={`bar ${hover === i ? 'is-hover' : ''} ${v >= 4 ? 'is-high' : ''}`}
                    d={`M${cx - barW / 2} ${base} V${top + r} Q${cx - barW / 2} ${top} ${cx - barW / 2 + r} ${top} H${cx + barW / 2 - r} Q${cx + barW / 2} ${top} ${cx + barW / 2} ${top + r} V${base}Z`}
                  />
                )}
                {prev && <NightMark g={nightGroup(prev)} x={cx} y={base + 12} />}
                {(i % 2 === 1 || i === DAYS - 1) && (
                  <text x={cx} y={H - 6} className="axis" textAnchor="middle">
                    {Number(d.slice(8))}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={PAD.t}
                  width={band}
                  height={H - PAD.t}
                  className="hit"
                  tabIndex={0}
                  aria-label={`${d} 명치 답답함 ${v ?? '기록 없음'}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
        {hv && (
          <div className="tooltip" style={{ left: `clamp(80px, ${((PAD.l + band * hover! + band / 2) / W) * 100}%, calc(100% - 80px))` }}>
            <b>{hv.slice(5).replace('-', '/')}</b>
            {hl ? (
              <>
                <span>
                  명치 답답함 <b className="mono">{hl.symptomFeedback.epigastricStuffiness}</b> · 긴장 <b className="mono">{hl.symptomFeedback.autonomicTension}</b>
                </span>
                <span>전날 밤: {hprev ? NIGHT_GROUP_LABEL[nightGroup(hprev)] : '기록 없음'}</span>
              </>
            ) : (
              <span>기록 없음</span>
            )}
          </div>
        )}
      </div>
      <figcaption className="chart-legend">
        <span>막대 아래 = 전날 밤</span>
        {(['DEFENDED', 'SAFE_SUBSTITUTE', 'HEAVY_SNACK', 'NO_CRAVING'] as NightGroup[]).map((g) => (
          <span key={g} className="lg">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <NightMark g={g} x={6} y={6.5} />
            </svg>
            {NIGHT_GROUP_LABEL[g]}
          </span>
        ))}
      </figcaption>
      <details className="table-view">
        <summary>표로 보기</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>명치</th>
                <th>긴장</th>
                <th>전날 밤</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const l = byDate.get(d);
                const p = byDate.get(addDays(d, -1));
                return (
                  <tr key={d}>
                    <td className="mono">{d.slice(5)}</td>
                    <td className="mono">{l?.symptomFeedback.epigastricStuffiness ?? '–'}</td>
                    <td className="mono">{l?.symptomFeedback.autonomicTension ?? '–'}</td>
                    <td>{p ? NIGHT_GROUP_LABEL[nightGroup(p)] : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
