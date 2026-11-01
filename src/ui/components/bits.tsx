import type { ReactNode } from 'react';
import type { TrayFinal } from '../../domain/cafeteria/tray';
import { EATEN_LABEL_TEXT, type EatenLabel } from '../../domain/meal/day';
import type { RuleHit, Verdict } from '../../domain/scoring/engine';

type Tone = 'take' | 'little' | 'skip' | 'hold' | 'block' | 'info';

const ICON: Record<Tone, ReactNode> = {
  take: <path d="M3.5 8.5l3 3 6-7" />,
  little: <path d="M3 8h10M8 3a5 5 0 0 1 0 10" />,
  skip: <path d="M4 4l8 8M12 4l-8 8" />,
  hold: <path d="M8 4v4l3 2M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13" />,
  block: <path d="M3 8h10M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13" />,
  info: <path d="M8 7v5M8 4.2v.1" />,
};

export function Glyph({ tone }: { tone: Tone }) {
  return (
    <svg className="glyph" viewBox="0 0 16 16" aria-hidden="true">
      {ICON[tone]}
    </svg>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`pill pill-${tone}`}>
      <Glyph tone={tone} />
      {children}
    </span>
  );
}

export const VERDICT_UI: Record<Verdict, { tone: Tone; label: string }> = {
  BEST: { tone: 'take', label: '최적' },
  GOOD: { tone: 'take', label: '적합' },
  CAUTION: { tone: 'little', label: '주의' },
  AVOID: { tone: 'skip', label: '부적합' },
  BLOCKED: { tone: 'block', label: '차단' },
};

export const TRAY_UI: Record<TrayFinal, { tone: Tone; label: string }> = {
  TAKE: { tone: 'take', label: '담기' },
  LITTLE: { tone: 'little', label: '조금만' },
  SKIP: { tone: 'skip', label: '거르기' },
  HOLD: { tone: 'hold', label: '보류' },
  BLOCKED: { tone: 'block', label: '차단' },
};

const EATEN_TONE: Record<EatenLabel, Tone> = { GOOD: 'take', OK: 'info', PITY: 'little', AVOID: 'block', OVERLAP: 'hold' };
export function EatenPill({ v }: { v: EatenLabel }) {
  return <Pill tone={EATEN_TONE[v]}>{EATEN_LABEL_TEXT[v]}</Pill>;
}

export function VerdictPill({ v }: { v: Verdict }) {
  const u = VERDICT_UI[v];
  return <Pill tone={u.tone}>{u.label}</Pill>;
}

export function TrayPill({ v }: { v: TrayFinal }) {
  const u = TRAY_UI[v];
  return <Pill tone={u.tone}>{u.label}</Pill>;
}

/** 규칙 적중 내역: 어떤 규칙이 몇 점을 움직였는가 */
export function RuleTrace({ hits }: { hits: RuleHit[] }) {
  return (
    <ol className="trace">
      {hits.map((h, i) => (
        <li key={i} className={h.block ? 'is-block' : h.delta > 0 && i > 0 ? 'is-plus' : h.delta < 0 ? 'is-minus' : ''}>
          <span className="trace-id">{h.ruleId}</span>
          <span className="trace-label">{h.label}</span>
          <span className="trace-delta">{h.block ? '차단' : i === 0 ? h.delta : h.delta > 0 ? `+${h.delta}` : h.delta}</span>
        </li>
      ))}
    </ol>
  );
}

export function Section({ title, kicker, children, action }: { title: string; kicker?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <div>
          {kicker && <p className="kicker">{kicker}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden="true" />
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Seg<T extends string>({ id, value, options, onChange, label }: { id: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          id={`${id}-${o.value}`}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
