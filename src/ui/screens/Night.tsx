import { useEffect, useState } from 'react';
import {
  bedtimeAdvice,
  chooseSubstitute,
  DEFEND_ACTIONS,
  defend,
  fakeHungerScore,
  FAKE_HUNGER_THRESHOLD,
  fastingHours,
  FASTING_TARGET_HOURS,
  finishWaiting,
  formatMin,
  HUNGER_QUESTIONS,
  isLateNight,
  NIGHT_DISHES,
  nightLogDate,
  rankSubstitutes,
  recordHeavySnack,
  startFunnel,
  submitHungerCheck,
  TEA_WAIT_MIN,
  timerRemainingMs,
  type FunnelState,
} from '../../domain/night/funnel';
import { Breathing478 } from '../components/Breathing478';
import { Pill, Section } from '../components/bits';
import type { AppStore } from '../store';

const STEPS = ['따뜻한 차 · 15분', '가짜 배고픔 판별', '대체 야식'] as const;

export function NightScreen({ s }: { s: AppStore }) {
  const { funnel, profile, nowMin } = s;
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (funnel?.step !== 'WARM_DRINK') return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [funnel?.step]);

  /** 퍼널이 끝나면 해당 밤의 기록에 반영 */
  const finish = (next: FunnelState) => {
    s.setFunnel(next);
    const date = nightLogDate(s.today, next.startedAtMin);
    s.upsertLog(date, (l) => ({
      ...l,
      lateNightDefense: {
        cravingOccurred: true,
        teaTimer15MinCompleted: next.timerCompleted,
        outcome: next.outcome!,
        fastingHoursToMorning: fastingHours(profile, next),
      },
    }));
  };

  const lateNight = isLateNight(nowMin);

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker">21:00 이후 · 행동 교정</p>
        <h1>야식 방어</h1>
      </header>

      {!funnel && (
        <>
          <Section title="배가 고프다면, 먹기 전에 세 단계">
            <ol className="steps-intro">
              <li>
                <b>따뜻한 차를 마시고 15분 기다립니다.</b> 업무 긴장이 풀린 직후의 허기는 대부분 15분 안에 가라앉습니다.
              </li>
              <li>
                <b>가짜 배고픔인지 6문항으로 판별합니다.</b>
              </li>
              <li>
                <b>정말 필요할 때만 초저부담 대체식</b>을 먹습니다. 자기 전 위가 비어 있어야 밤새 부교감신경이 회복되고, 다음 날 아침 명치가 덜 막힙니다.
              </li>
            </ol>
            {!lateNight && <p className="banner banner-info">지금은 {formatMin(nowMin)}입니다. 야식 시간대(21:00–04:00)가 아니지만 연습 삼아 시작할 수 있습니다.</p>}
            <button type="button" className="btn btn-primary btn-wide" onClick={() => s.setFunnel(startFunnel(profile, nowMin, Date.now()))}>
              지금 배고파요 · 시작
            </button>
          </Section>
          <Section kicker="오늘 밤 쓸 수 있는 대체식" title="불가피할 때의 선택지">
            <SubstituteList s={s} readOnly />
          </Section>
        </>
      )}

      {funnel && funnel.step !== 'DONE' && <Stepper current={funnel.step === 'WARM_DRINK' ? 0 : funnel.step === 'HUNGER_CHECK' ? 1 : 2} />}

      {funnel?.step === 'WARM_DRINK' && <StepDrink f={funnel} now={tick} onNext={() => s.setFunnel(finishWaiting(funnel, Date.now()))} />}

      {funnel?.step === 'HUNGER_CHECK' && <StepHunger f={funnel} onSubmit={(a) => s.setFunnel(submitHungerCheck(funnel, a))} />}

      {funnel?.step === 'SUBSTITUTE' && (
        <StepSubstitute
          s={s}
          f={funnel}
          onDefend={() => finish(defend(funnel))}
          onPick={(id) => finish(chooseSubstitute(funnel, id, s.nowMin))}
          onHeavy={() => finish(recordHeavySnack(funnel, s.nowMin))}
        />
      )}

      {funnel?.step === 'DONE' && <Done s={s} f={funnel} />}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="stepper" aria-label="진행 단계">
      {STEPS.map((t, i) => (
        <li key={t} className={i < current ? 'is-done' : i === current ? 'is-now' : ''} aria-current={i === current ? 'step' : undefined}>
          <span className="stepper-n">{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}

function StepDrink({ f, now, onNext }: { f: FunnelState; now: number; onNext: () => void }) {
  const left = timerRemainingMs(f, now);
  const total = TEA_WAIT_MIN * 60_000;
  const done = left === 0;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <Section kicker="Step 1" title={f.drink.label}>
      {f.drink.swappedReason && <p className="banner banner-hold">{f.drink.swappedReason}</p>}
      <div className="timer">
        <svg viewBox="0 0 120 120" className="timer-ring" role="img" aria-label={`남은 시간 ${mm}분 ${ss}초`}>
          <circle cx="60" cy="60" r={r} className="timer-track" />
          <circle cx="60" cy="60" r={r} className="timer-fill" strokeDasharray={c} strokeDashoffset={c * (left / total)} transform="rotate(-90 60 60)" />
        </svg>
        <div className="timer-text">
          <span className="mono timer-big">{done ? '완료' : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`}</span>
          <span className="muted small">{done ? '허기가 어떤지 확인해 봅시다' : '천천히 마시며 기다리기'}</span>
        </div>
      </div>
      <p className="muted small">기다리는 동안 4-7-8 호흡을 해 두면 판별이 쉬워집니다.</p>
      <Breathing478 />
      <div className="stack">
        <button type="button" className="btn btn-primary btn-wide" disabled={!done} onClick={onNext}>
          15분 기다렸어요 · 다음
        </button>
        {!done && (
          <button type="button" className="btn btn-ghost btn-wide" onClick={onNext}>
            기다리지 않고 넘어가기 (기록에 ‘대기 미완료’)
          </button>
        )}
      </div>
    </Section>
  );
}

function StepHunger({ f, onSubmit }: { f: FunnelState; onSubmit: (a: Record<string, boolean>) => void }) {
  const [ans, setAns] = useState<Record<string, boolean>>(f.answers);
  const answered = HUNGER_QUESTIONS.every((q) => ans[q.id] !== undefined);
  return (
    <Section kicker="Step 2" title="이 허기, 진짜일까요?">
      <ul className="qs">
        {HUNGER_QUESTIONS.map((q) => (
          <li key={q.id} className="q">
            <span>{q.text}</span>
            <span className="yn" role="radiogroup" aria-label={q.text}>
              {[true, false].map((v) => (
                <button key={String(v)} type="button" role="radio" aria-checked={ans[q.id] === v} className={ans[q.id] === v ? 'is-on' : ''} onClick={() => setAns({ ...ans, [q.id]: v })}>
                  {v ? '예' : '아니오'}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        가짜 배고픔 신호 {fakeHungerScore(ans)}개 / 판정 기준 {FAKE_HUNGER_THRESHOLD}개
      </p>
      <button type="button" className="btn btn-primary btn-wide" disabled={!answered} onClick={() => onSubmit(ans)}>
        판별하기
      </button>
    </Section>
  );
}

function StepSubstitute({ s, f, onDefend, onPick, onHeavy }: { s: AppStore; f: FunnelState; onDefend: () => void; onPick: (id: string) => void; onHeavy: () => void }) {
  const fake = f.hungerVerdict === 'FAKE';
  const [showFood, setShowFood] = useState(!fake);
  return (
    <>
      {fake && (
        <Section kicker="Step 3 · 판정" title="가짜 배고픔일 가능성이 높습니다">
          <p>몸이 원하는 건 음식보다 긴장 해소입니다. 아래 중 두 가지를 하고 자리를 정리하세요.</p>
          <ul className="tips">
            {DEFEND_ACTIONS.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-wide" onClick={onDefend}>
              먹지 않고 마무리
            </button>
            {!showFood && (
              <button type="button" className="btn btn-ghost btn-wide" onClick={() => setShowFood(true)}>
                그래도 배가 고파요
              </button>
            )}
          </div>
        </Section>
      )}
      {showFood && (
        <Section kicker={fake ? '불가피할 때' : 'Step 3 · 진짜 허기'} title="초저부담 대체 야식">
          <p className="muted">{bedtimeAdvice(s.profile, s.nowMin)}</p>
          <SubstituteList s={s} onPick={onPick} />
          <button type="button" className="btn btn-ghost btn-wide" onClick={onHeavy}>
            이미 다른 야식을 먹었어요 (솔직하게 기록)
          </button>
        </Section>
      )}
    </>
  );
}

function SubstituteList({ s, onPick, readOnly }: { s: AppStore; onPick?: (id: string) => void; readOnly?: boolean }) {
  const list = rankSubstitutes(s.profile, s.nowMin);
  return (
    <ul className="subs">
      {list.map((x) => (
        <li key={x.dish.id} className={`sub ${x.allowed ? '' : 'is-off'}`}>
          <div className="sub-main">
            <span className="sub-name">{x.dish.name}</span>
            <span className="muted small">
              {x.portion} · {x.how}
            </span>
            {!x.allowed && <span className="small hold-text">{x.note}</span>}
          </div>
          {readOnly ? (
            <span className="mono score">{x.score}</span>
          ) : (
            <button type="button" className="btn btn-small" disabled={!x.allowed} onClick={() => onPick?.(x.dish.id)}>
              이걸로
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Done({ s, f }: { s: AppStore; f: FunnelState }) {
  const hours = fastingHours(s.profile, f);
  const ate = f.outcome !== 'DEFENDED';
  const sub = NIGHT_DISHES.find((n) => n.dish.id === f.substituteId);
  const title = f.outcome === 'DEFENDED' ? '방어 성공' : f.outcome === 'SAFE_SUBSTITUTE' ? `대체식: ${sub?.dish.name ?? ''}` : '일반 야식 기록';
  return (
    <Section kicker="오늘 밤 결과" title={title}>
      <dl className="kv">
        <div>
          <dt>15분 대기</dt>
          <dd>{f.timerCompleted ? '완료' : '미완료'}</dd>
        </div>
        <div>
          <dt>내일 아침까지 공복</dt>
          <dd>
            <span className="mono">{hours}</span>시간 {hours >= FASTING_TARGET_HOURS ? <Pill tone="take">목표 달성</Pill> : <Pill tone="little">목표 {FASTING_TARGET_HOURS}시간 미만</Pill>}
          </dd>
        </div>
        <div>
          <dt>내일 아침 식사량</dt>
          <dd>{ate ? '50%로 줄이기' : '평소 양'}</dd>
        </div>
      </dl>
      {f.outcome === 'HEAVY_SNACK' && <p>괜찮습니다. 기록이 남아야 패턴이 보입니다. 지금은 바로 눕지 말고 30분 정도 앉아 있다가 주무세요.</p>}
      <p className="muted small">기록 탭의 {nightLogDate(s.today, f.startedAtMin)} 기록에 반영했습니다.</p>
      <button type="button" className="btn btn-ghost btn-wide" onClick={() => s.setFunnel(null)}>
        처음으로
      </button>
    </Section>
  );
}
