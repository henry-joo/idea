import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks';

const PHASES = [
  { name: '코로 들이쉬기', sec: 4, scale: 1 },
  { name: '숨 멈추기', sec: 7, scale: 1 },
  { name: '입으로 내쉬기', sec: 8, scale: 0.55 },
] as const;
const CYCLE = PHASES.reduce((s, p) => s + p.sec, 0);

/** 4-7-8 호흡: 내쉬는 숨을 길게 해 미주신경(부교감) 톤을 올린다. 4회 = 76초 */
export function Breathing478({ cycles = 4, onDone }: { cycles?: number; onDone?: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : (now - startedAt) / 1000;
  const total = cycles * CYCLE;
  const finished = startedAt !== null && elapsed >= total;

  useEffect(() => {
    if (finished && !doneRef.current) {
      doneRef.current = true;
      setStartedAt(null);
      onDone?.();
    }
  }, [finished, onDone]);

  let phaseIdx = 0;
  let inPhase = elapsed % CYCLE;
  while (phaseIdx < PHASES.length - 1 && inPhase >= PHASES[phaseIdx]!.sec) {
    inPhase -= PHASES[phaseIdx]!.sec;
    phaseIdx++;
  }
  const phase = PHASES[phaseIdx]!;
  const running = startedAt !== null;
  const remain = Math.max(1, Math.ceil(phase.sec - inPhase));
  const cycleNo = Math.min(cycles, Math.floor(elapsed / CYCLE) + 1);

  return (
    <div className="breath">
      <div className="breath-stage" aria-hidden="true">
        <span
          className="breath-orb"
          style={{
            transform: `scale(${running ? phase.scale : 0.55})`,
            transitionDuration: reduced || !running ? '0s' : `${phase.sec}s`,
          }}
        />
        <span className="breath-count">{running ? remain : '4·7·8'}</span>
      </div>
      <div className="breath-side">
        <p className="breath-phase" aria-live="polite">
          {running ? `${phase.name} · ${cycleNo}/${cycles}회` : '식전 2분, 내쉬는 숨을 길게'}
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (running) {
              setStartedAt(null);
            } else {
              doneRef.current = false;
              const t = Date.now();
              setNow(t);
              setStartedAt(t);
            }
          }}
        >
          {running ? '멈추기' : '호흡 시작'}
        </button>
      </div>
    </div>
  );
}
