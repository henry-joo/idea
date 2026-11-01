import { useMemo, useState } from 'react';
import { SAMPLE_MENUS } from '../../domain/cafeteria/tray';
import { detectRedFlags } from '../../domain/log/insights';
import type { DinnerAmount } from '../../domain/log/types';
import { buildDinnerContext, evaluateEaten, GRADE_TEXT, type EatenSlot, type MealEvaluation } from '../../domain/meal/day';
import { recommendMeal } from '../../domain/meal/recommend';
import { medAdvisories } from '../../domain/medication/drugs';
import { fromMinutes, isHHMM, toMinutes } from '../../domain/shared/time';
import { EatenPill, Pill, Seg } from '../components/bits';
import type { AppStore } from '../store';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const SLOT_LABEL: Record<EatenSlot, string> = { BREAKFAST: '아침', LUNCH: '점심' };
const AMOUNT: { value: DinnerAmount; label: string }[] = [
  { value: 'SKIPPED', label: '거름' },
  { value: 'LIGHT', label: '가볍게' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HEAVY', label: '많이' },
];

export function TodayScreen({ s }: { s: AppStore }) {
  const { profile, today } = s;
  const d = s.now;
  const day = s.mealsOf(today);
  const evals = useMemo(
    () => [evaluateEaten(day.breakfast, 'BREAKFAST', profile), evaluateEaten(day.lunch, 'LUNCH', profile)],
    [day.breakfast, day.lunch, profile],
  );
  const context = useMemo(() => buildDinnerContext(profile, evals), [profile, evals]);
  const plan = useMemo(() => recommendMeal(profile, 'DINNER', context), [profile, context]);
  const flags = detectRedFlags(s.realLogs, today);
  const advisories = medAdvisories(profile);
  const nothingYet = evals.every((e) => e.empty);

  return (
    <div className="screen">
      <header className="hero">
        <p className="kicker">
          {d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAY[d.getDay()]}요일
        </p>
        <h1>오늘 식단</h1>
        <p className="hero-sub">아침·점심에 드신 걸 적으면, 저녁을 거기에 맞춰 드려요.</p>
      </header>

      {flags.map((f) => (
        <div key={f.id} className={`banner banner-${f.level === 'URGENT' ? 'skip' : 'little'}`} role="alert">
          {f.message}
        </div>
      ))}
      {advisories.length > 0 && (
        <button type="button" className="banner banner-hold banner-btn" onClick={() => s.go('meds')}>
          <span>사전에 없는 약이 있습니다: {advisories.map((a) => a.split(':')[0]).join(', ')}. 약사에게 확인하세요.</span>
          <span aria-hidden="true">→</span>
        </button>
      )}

      <MealStep n={1} slot="BREAKFAST" ev={evals[0]!} s={s} />
      <MealStep n={2} slot="LUNCH" ev={evals[1]!} s={s} />

      {nothingYet && (
        <button
          type="button"
          className="btn btn-ghost sample-fill"
          onClick={() => {
            s.setMealEntry(today, 'breakfast', { text: SAMPLE_MENUS.BREAKFAST, skipped: false });
            s.setMealEntry(today, 'lunch', { text: SAMPLE_MENUS.LUNCH, skipped: false });
          }}
        >
          예시 식단으로 채워 보기
        </button>
      )}

      <DinnerStep s={s} plan={plan} />
    </div>
  );
}

function MealStep({ n, slot, ev, s }: { n: number; slot: EatenSlot; ev: MealEvaluation; s: AppStore }) {
  const key = slot === 'BREAKFAST' ? 'breakfast' : 'lunch';
  const entry = s.mealsOf(s.today)[key];
  const time = slot === 'BREAKFAST' ? s.profile.routine.breakfast : s.profile.routine.lunch;
  const where = (slot === 'BREAKFAST' ? s.profile.mealEnvironment.breakfast : s.profile.mealEnvironment.lunch) === 'CAFETERIA' ? '회사' : '';
  const id = `meal-${key}`;

  return (
    <section className="section step" aria-labelledby={`${id}-h`}>
      <header className="step-head">
        <span className="step-n" aria-hidden="true">
          {n}
        </span>
        <div>
          <h2 id={`${id}-h`}>{SLOT_LABEL[slot]}</h2>
          <p className="muted small">
            {where && `${where} · `}
            <span className="mono">{time}</span>
          </p>
        </div>
        <Seg<'ate' | 'skip'>
          id={`${id}-seg`}
          label={`${SLOT_LABEL[slot]} 먹음 여부`}
          value={entry.skipped ? 'skip' : 'ate'}
          onChange={(v) => s.setMealEntry(s.today, key, { ...entry, skipped: v === 'skip' })}
          options={[
            { value: 'ate', label: '먹었어요' },
            { value: 'skip', label: '안 먹었어요' },
          ]}
        />
      </header>

      {!entry.skipped && (
        <>
          <label className="sr-only" htmlFor={`${id}-text`}>
            {SLOT_LABEL[slot]}에 먹은 반찬
          </label>
          <textarea
            id={`${id}-text`}
            rows={2}
            value={entry.text}
            onChange={(e) => s.setMealEntry(s.today, key, { ...entry, text: e.target.value })}
            placeholder="먹은 반찬을 쉼표로 적어 주세요. 예: 잡곡밥, 소고기무국, 제육볶음, 콩나물무침"
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              s.setTrayMeal(slot);
              s.go('tray');
            }}
          >
            먹기 전에 메뉴판으로 골라 보기 →
          </button>
        </>
      )}

      {ev.skipped && <p className="muted">거르셨어요. 저녁 추천에 반영할게요.</p>}

      {ev.items.length > 0 && (
        <div className="eval">
          <p className="eval-grade">
            <span className={`grade grade-${ev.grade ?? 'none'}`}>{ev.grade ? GRADE_TEXT[ev.grade] : ''}</span>
            <span className="muted">{ev.summary}</span>
          </p>
          <ul className="eaten">
            {ev.items.map((it, i) => (
              <li key={`${it.name}-${i}`} className={it.reason ? '' : 'is-plain'}>
                <span className="eaten-name">
                  {it.name}
                  {it.inferred && <span className="muted small"> (추정)</span>}
                </span>
                <EatenPill v={it.label} />
                {it.reason && <span className="eaten-why muted small">{it.reason}</span>}
              </li>
            ))}
          </ul>
          {ev.unknown.length > 0 && <p className="small muted">알아보지 못한 이름: {ev.unknown.join(', ')}. 주재료를 함께 적어 주세요.</p>}
        </div>
      )}
      {!ev.items.length && ev.unknown.length > 0 && <p className="banner banner-hold">알아보지 못한 이름: {ev.unknown.join(', ')}. 주재료를 함께 적어 주세요 (예: 오늘의특선(돼지고기)).</p>}
    </section>
  );
}

function DinnerStep({ s, plan }: { s: AppStore; plan: ReturnType<typeof recommendMeal> }) {
  const { profile, today } = s;
  const ctx = plan.context!;
  const [pick, setPick] = useState(0);
  const combo = plan.combos[Math.min(pick, plan.combos.length - 1)];
  const log = s.getLog(today);
  const [amount, setAmount] = useState<DinnerAmount>(log.dinnerLog.amount);
  const [eatenAt, setEatenAt] = useState(log.dinnerLog.eatenAt ?? profile.routine.dinner);
  const [saved, setSaved] = useState(false);

  const record = () => {
    const t = isHHMM(eatenAt) ? eatenAt : profile.routine.dinner;
    s.upsertLog(today, (l) => ({
      ...l,
      dinnerLog: { eatenAt: amount === 'SKIPPED' ? null : t, amount, finishedBeforeCutoff: amount === 'SKIPPED' || !plan.cutoff ? true : toMinutes(t) <= toMinutes(plan.cutoff) },
    }));
    setSaved(true);
  };

  return (
    <section className="section step step-dinner" aria-labelledby="dinner-h">
      <header className="step-head">
        <span className="step-n step-n-accent" aria-hidden="true">
          3
        </span>
        <div>
          <h2 id="dinner-h">저녁 추천</h2>
          <p className="muted small">
            집 · <span className="mono">{plan.time}</span>
            {plan.cutoff && (
              <>
                {' '}
                · <span className="mono">{plan.cutoff}</span>까지 마치기
              </>
            )}
          </p>
        </div>
      </header>

      <p className={`headline ${ctx.filled ? '' : 'is-pending'}`}>{ctx.headline}</p>

      {ctx.reasons.length > 0 && (
        <ul className="because">
          {ctx.reasons.map((r) => (
            <li key={r.because}>
              <span className="because-a">{r.because}</span>
              <span className="because-b">→ {r.therefore}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="portion-line">
        <Pill tone={ctx.portion.level === 'LIGHT' ? 'little' : ctx.portion.level === 'FULL' ? 'take' : 'info'}>{ctx.portion.level === 'LIGHT' ? '가볍게' : ctx.portion.level === 'FULL' ? '든든하게' : '평소대로'}</Pill>
        <span>{ctx.portion.text}</span>
      </p>

      {combo ? (
        <div className="menu">
          <div className="seg" role="tablist" aria-label="추천 저녁">
            {plan.combos.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={pick === i} className={pick === i ? 'is-on' : ''} onClick={() => setPick(i)}>
                추천 {i + 1}
              </button>
            ))}
          </div>
          <ul className="combo">
            {(
              [
                ['밥', combo.rice],
                ['국', combo.soup],
                ['단백질', combo.protein],
                ['익힌 채소', combo.veggie],
                ...(combo.veggie2 ? ([['익힌 채소', combo.veggie2]] as const) : []),
              ] as const
            ).map(([label, dish], i) => (
              <li key={`${label}-${i}`}>
                <span className="combo-label">{label}</span>
                <span className="combo-name">{dish.name}</span>
                {dish.note && <span className="muted small combo-note">{dish.note}</span>}
              </li>
            ))}
          </ul>
          <ul className="why">
            {combo.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="banner banner-skip">지금 설정으로는 추천할 수 있는 조합이 없어요. 설정에서 체질과 복약 시각을 확인해 주세요.</p>
      )}

      {plan.advice.length > 0 && (
        <details className="advice">
          <summary className="link-summary">저녁 먹을 때 참고</summary>
          <ul className="tips">
            {plan.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="advice" onToggle={() => setSaved(false)}>
        <summary className="link-summary">저녁 먹은 걸 기록하기</summary>
        <div className="stack">
          <Seg<DinnerAmount> id="dinner-amount" label="저녁 양" value={amount} onChange={(v) => { setAmount(v); setSaved(false); }} options={AMOUNT} />
          {amount !== 'SKIPPED' && (
            <label className="field-inline" htmlFor="dinner-time">
              먹은 시각
              <input id="dinner-time" type="time" value={eatenAt} onChange={(e) => { setEatenAt(e.target.value); setSaved(false); }} />
            </label>
          )}
          <button type="button" className="btn btn-primary btn-wide" onClick={record}>
            {saved ? '기록했어요' : '기록'}
          </button>
          <p className="muted small">밤에 배고플 때 ‘야식’ 화면이 이 기록을 보고 안내해 드려요. 지금 시각 {fromMinutes(s.nowMin)}.</p>
        </div>
      </details>

      <button type="button" className="link-btn" onClick={() => s.go('night')}>
        밤에 배고플 땐 →
      </button>
    </section>
  );
}
