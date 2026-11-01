import { useMemo, useState } from 'react';
import type { DinnerAmount } from '../../domain/log/types';
import { HOME_MEAL_LABEL, mealTimeOf, recommendMeal, type HomeMeal, type MealCombo } from '../../domain/meal/recommend';
import { isHHMM, toMinutes } from '../../domain/shared/time';
import { Pill, Section, Seg, Toggle } from '../components/bits';
import type { AppStore } from '../store';

const AMOUNT: { value: DinnerAmount; label: string }[] = [
  { value: 'SKIPPED', label: '거름' },
  { value: 'LIGHT', label: '가볍게' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HEAVY', label: '많이' },
];

export function DinnerScreen({ s }: { s: AppStore }) {
  const { profile, today } = s;
  const [meal, setMeal] = useState<HomeMeal>('DINNER');
  const [pick, setPick] = useState(0);
  const [saved, setSaved] = useState(false);
  const plan = useMemo(() => recommendMeal(profile, meal), [profile, meal]);
  const log = s.getLog(today);
  const dayOff = profile.holidayDates.includes(today);
  const canHome = meal === 'DINNER' || s.homeDay;
  const combo: MealCombo | undefined = plan.combos[pick];
  const [amount, setAmount] = useState<DinnerAmount>(log.dinnerLog.amount);
  const [eatenAt, setEatenAt] = useState(log.dinnerLog.eatenAt ?? profile.routine.dinner);

  const toggleDayOff = (v: boolean) =>
    s.setProfile({ ...profile, holidayDates: v ? [...new Set([...profile.holidayDates, today])] : profile.holidayDates.filter((d) => d !== today) });

  const commit = () => {
    const t = isHHMM(eatenAt) ? eatenAt : profile.routine.dinner;
    s.upsertLog(today, (l) => ({
      ...l,
      dinnerLog: { eatenAt: amount === 'SKIPPED' ? null : t, amount, finishedBeforeCutoff: amount === 'SKIPPED' || !plan.cutoff ? true : toMinutes(t) <= toMinutes(plan.cutoff) },
    }));
    setSaved(true);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker">집밥 · 야식 예방</p>
        <h1>{HOME_MEAL_LABEL[meal]} 추천</h1>
      </header>

      <div className="tray-controls">
        <Seg<HomeMeal>
          id="home-meal"
          label="식사"
          value={meal}
          onChange={(m) => {
            setMeal(m);
            setPick(0);
            setSaved(false);
          }}
          options={(['DINNER', 'BREAKFAST', 'LUNCH'] as HomeMeal[]).map((m) => ({ value: m, label: HOME_MEAL_LABEL[m] }))}
        />
        <span className="muted small">
          {HOME_MEAL_LABEL[meal]} 시각 <b className="mono">{mealTimeOf(profile, meal)}</b>
        </span>
      </div>

      {s.homeDay ? (
        <div className="banner banner-info">오늘은 {dayOff ? '쉬는 날로 표시한 날' : '주말'}입니다. 아침·점심도 집밥으로 추천합니다.</div>
      ) : (
        meal !== 'DINNER' && (
          <div className="banner banner-hold">
            평일 {HOME_MEAL_LABEL[meal]}은 구내식당 설정입니다. 집에서 먹는 날이면 아래 ‘오늘은 쉬는 날’을 켜세요.
          </div>
        )
      )}

      {plan.cutoff && (
        <div className="cutoff">
          <div>
            <p className="kicker">저녁 마감</p>
            <p className="cutoff-time mono">{plan.cutoff}</p>
          </div>
          <p className="muted">
            취침 {profile.routine.bedtime}의 3시간 전. 이 시각 안에 마치면 자는 동안 위가 쉽니다.
          </p>
        </div>
      )}

      {canHome && plan.combos.length === 0 && <p className="banner banner-skip">지금 설정에서는 추천할 수 있는 조합이 없습니다. 내 몸 탭의 병리 상태와 복약 시각을 확인하세요.</p>}

      {canHome && combo && (
        <Section kicker="밥 · 국 · 단백질 · 익힌 채소" title="이 중 하나로">
          <div className="seg" role="tablist" aria-label="추천 조합">
            {plan.combos.map((c, i) => (
              <button key={i} type="button" role="tab" aria-selected={pick === i} className={pick === i ? 'is-on' : ''} onClick={() => setPick(i)}>
                조합 {i + 1} · {c.score}
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
              ] as const
            ).map(([label, d]) => (
              <li key={label}>
                <span className="combo-label">{label}</span>
                <span className="combo-name">{d.name}</span>
                {d.note && <span className="muted small combo-note">{d.note}</span>}
              </li>
            ))}
          </ul>
          <p className="muted small">모든 반찬이 식판과 같은 규칙 엔진에서 ‘담기’ 판정을 받은 것입니다. 복약 시간과 겹치는 후식은 자동으로 빠집니다.</p>
        </Section>
      )}

      {plan.advice.length > 0 && (
        <Section title="저녁 안내">
          <ul className="tips">
            {plan.advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {meal === 'DINNER' && (
        <Section kicker="오늘 기록" title="저녁은 어떻게 드셨나요?">
          <Seg<DinnerAmount> id="dinner-amount" label="저녁 양" value={amount} onChange={(v) => { setAmount(v); setSaved(false); }} options={AMOUNT} />
          {amount !== 'SKIPPED' && (
            <label className="field-inline" htmlFor="dinner-time">
              먹은 시각
              <input id="dinner-time" type="time" value={eatenAt} onChange={(e) => { setEatenAt(e.target.value); setSaved(false); }} />
            </label>
          )}
          {(amount === 'SKIPPED' || amount === 'LIGHT') && <p className="banner banner-little">밤 허기가 올 가능성이 큽니다. 야식 방어에서 ‘진짜 허기’로 보고 바로 대체식을 안내해 드립니다.</p>}
          {amount === 'HEAVY' && <p className="banner banner-little">많이 드신 날은 취침 전 걷기 15분과 온수 한 컵으로 마무리하세요.</p>}
          <button type="button" className="btn btn-primary btn-wide" onClick={commit}>
            {saved ? '오늘 기록에 반영했습니다' : '기록에 반영'}
          </button>
          {log.dinnerLog.eatenAt && !saved && (
            <p className="muted small">
              저장된 기록: {log.dinnerLog.eatenAt} · {AMOUNT.find((a) => a.value === log.dinnerLog.amount)?.label}{' '}
              {log.dinnerLog.finishedBeforeCutoff ? <Pill tone="take">마감 안에 마침</Pill> : <Pill tone="little">마감 넘김</Pill>}
            </p>
          )}
        </Section>
      )}

      <Toggle id="day-off" checked={dayOff} onChange={toggleDayOff} label="오늘은 쉬는 날(공휴일)" hint="켜면 오늘 아침·점심도 집밥으로 추천합니다. 토·일은 자동입니다" />
    </div>
  );
}
