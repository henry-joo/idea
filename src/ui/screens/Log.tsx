import { useState } from 'react';
import { computeInsights, detectRedFlags, NIGHT_GROUP_LABEL } from '../../domain/log/insights';
import type { DailyHealthLog, DinnerAmount, NightOutcome, Scale5 } from '../../domain/log/types';
import { FASTING_TARGET_HOURS } from '../../domain/night/funnel';
import { addDays } from '../../domain/shared/time';
import { Section, Seg, Toggle } from '../components/bits';
import { StuffinessChart } from '../components/StuffinessChart';
import type { AppStore } from '../store';

const SCALE: Scale5[] = [1, 2, 3, 4, 5];

export function LogScreen({ s }: { s: AppStore }) {
  const [date, setDate] = useState(s.today);
  const log = s.getLog(date);
  const ins = computeInsights(s.logs, s.today);
  const flags = detectRedFlags(s.realLogs, s.today);
  const up = (f: (l: DailyHealthLog) => DailyHealthLog) => s.upsertLog(date, f);
  const maxNext = Math.max(...ins.nextDayStuffinessByNight.map((x) => x.mean ?? 0), 1);
  const delta = ins.stuffiness7 !== null && ins.stuffinessPrev7 !== null ? Math.round((ins.stuffiness7 - ins.stuffinessPrev7) * 10) / 10 : null;

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker">자율신경 · 소화 트래킹</p>
        <h1>기록과 패턴</h1>
      </header>

      {s.showingExamples && (
        <div className="banner banner-info">
          <span>
            아래 분석은 <b>예시 기록 14일</b>입니다. 첫 기록을 저장하면 예시는 사라지고 내 기록으로 바뀝니다.
          </span>
          <button type="button" className="btn btn-small" onClick={s.clearExamples}>
            예시 지우기
          </button>
        </div>
      )}
      {flags.map((f) => (
        <div key={f.id} className={`banner banner-${f.level === 'URGENT' ? 'skip' : 'little'}`} role="alert">
          {f.message}
        </div>
      ))}

      <div className="stats">
        <div className="stat">
          <span className="stat-label">명치 7일 평균</span>
          <span className="stat-value mono">{ins.stuffiness7 ?? '–'}</span>
          <span className="stat-sub">{delta === null ? '이전 주 기록 없음' : delta <= 0 ? `전주보다 ${Math.abs(delta)} ↓` : `전주보다 ${delta} ↑`}</span>
        </div>
        <div className="stat">
          <span className="stat-label">일반 야식 회피</span>
          <span className="stat-value mono">{ins.defenseRate === null ? '–' : `${ins.defenseRate}%`}</span>
          <span className="stat-sub">야식 욕구 중 방어·대체식</span>
        </div>
        <div className="stat">
          <span className="stat-label">공복 {FASTING_TARGET_HOURS}시간</span>
          <span className="stat-value mono">{ins.fastingGoalRate === null ? '–' : `${ins.fastingGoalRate}%`}</span>
          <span className="stat-sub">{ins.days}일 중 달성</span>
        </div>
      </div>

      <Section title="최근 14일 명치 답답함" kicker="1 매우 편안 · 5 꽉 막힘">
        <StuffinessChart logs={s.logs} today={s.today} />
      </Section>

      <Section title="전날 밤에 따라 달라지는 다음 날 아침" kicker="다음 날 명치 답답함 평균">
        <ul className="hbars">
          {ins.nextDayStuffinessByNight.map((x) => (
            <li key={x.group}>
              <span className="hbar-label">{NIGHT_GROUP_LABEL[x.group]}</span>
              <span className="hbar-track">
                {x.mean !== null && <span className="hbar-fill" style={{ width: `${(x.mean / Math.max(5, maxNext)) * 100}%` }} />}
              </span>
              <span className="hbar-val mono">{x.mean ?? '–'}</span>
              <span className="hbar-n muted small">{x.n}일</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="루틴 실천율">
        <ul className="meters">
          {(
            [
              ['식전 4-7-8 호흡', ins.routineRate.breathing],
              ['식후 15분 걷기', ins.routineRate.walk],
              ['식중 온수만', ins.routineRate.warmWater],
            ] as const
          ).map(([label, v]) => (
            <li key={label}>
              <span>{label}</span>
              <span className="meter" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
                <span style={{ width: `${v}%` }} />
              </span>
              <span className="mono">{v}%</span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="date-nav">
        <button type="button" className="btn btn-ghost" onClick={() => setDate(addDays(date, -1))} aria-label="전날">
          ‹
        </button>
        <span className="mono date-now">{date === s.today ? `오늘 · ${date}` : date}</span>
        <button type="button" className="btn btn-ghost" disabled={date >= s.today} onClick={() => setDate(addDays(date, 1))} aria-label="다음 날">
          ›
        </button>
      </div>

      <Section title="몸 상태" kicker="하루 한 번, 자기 전">
        <ScaleRow id="stuffy" label="명치 답답함" low="매우 편안" high="꽉 막힘" value={log.symptomFeedback.epigastricStuffiness} onChange={(v) => up((l) => ({ ...l, symptomFeedback: { ...l.symptomFeedback, epigastricStuffiness: v } }))} />
        <ScaleRow id="tension" label="긴장·피로" low="이완" high="극도 긴장" value={log.symptomFeedback.autonomicTension} onChange={(v) => up((l) => ({ ...l, symptomFeedback: { ...l.symptomFeedback, autonomicTension: v } }))} />
      </Section>

      <Section title="미주신경 루틴">
        <div className="stack">
          <Toggle id="lg-breath" checked={log.vagalToneRoutine.preMealBreathing478} onChange={(v) => up((l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, preMealBreathing478: v } }))} label="식전 2분 4-7-8 호흡" />
          <Toggle id="lg-walk" checked={log.vagalToneRoutine.postMealWalk15Min} onChange={(v) => up((l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, postMealWalk15Min: v } }))} label="식후 15분 리듬 워킹" />
          <Toggle id="lg-water" checked={log.vagalToneRoutine.warmWaterOnly} onChange={(v) => up((l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, warmWaterOnly: v } }))} label="식중 냉수 제한·온수만" />
        </div>
      </Section>

      <Section title="구내식당">
        <div className="stack">
          <div className="field">
            <span className="field-label">오늘 아침 식사량 (전날 야식 기준 50·75·100)</span>
            <Seg<'100' | '75' | '50'>
              id="lg-portion"
              label="아침 식사량"
              value={String(log.cafeteriaFilterLog.morningPortion) as '100' | '75' | '50'}
              onChange={(v) => up((l) => ({ ...l, cafeteriaFilterLog: { ...l.cafeteriaFilterLog, morningPortion: Number(v) as 100 | 75 | 50 } }))}
              options={[
                { value: '100', label: '100%' },
                { value: '75', label: '75%' },
                { value: '50', label: '50%' },
              ]}
            />
          </div>
          <Toggle id="lg-avoid" checked={log.cafeteriaFilterLog.avoidedColdSaladAndPork} onChange={(v) => up((l) => ({ ...l, cafeteriaFilterLog: { ...l.cafeteriaFilterLog, avoidedColdSaladAndPork: v } }))} label="찬 샐러드·돼지고기·튀김 거름" />
          <Toggle id="lg-radish" checked={log.cafeteriaFilterLog.includedRadishOrWarmSoup} onChange={(v) => up((l) => ({ ...l, cafeteriaFilterLog: { ...l.cafeteriaFilterLog, includedRadishOrWarmSoup: v } }))} label="익힌 무·따뜻한 국물 먹음" />
        </div>
      </Section>

      <Section title="저녁">
        <div className="stack">
          <Seg<DinnerAmount>
            id="lg-dinner"
            label="저녁 양"
            value={log.dinnerLog.amount}
            onChange={(v) => up((l) => ({ ...l, dinnerLog: { ...l.dinnerLog, amount: v, eatenAt: v === 'SKIPPED' ? null : l.dinnerLog.eatenAt ?? s.profile.routine.dinner } }))}
            options={[
              { value: 'SKIPPED', label: '거름' },
              { value: 'LIGHT', label: '가볍게' },
              { value: 'NORMAL', label: '보통' },
              { value: 'HEAVY', label: '많이' },
            ]}
          />
          <Toggle id="lg-cutoff" checked={log.dinnerLog.finishedBeforeCutoff} onChange={(v) => up((l) => ({ ...l, dinnerLog: { ...l.dinnerLog, finishedBeforeCutoff: v } }))} label="취침 3시간 전까지 마침" />
        </div>
      </Section>

      <Section title="야식 방어">
        <div className="stack">
          <Toggle id="lg-craving" checked={log.lateNightDefense.cravingOccurred} onChange={(v) => up((l) => ({ ...l, lateNightDefense: { ...l.lateNightDefense, cravingOccurred: v } }))} label="21시 이후 야식 욕구가 있었다" />
          {log.lateNightDefense.cravingOccurred && (
            <>
              <Toggle id="lg-timer" checked={log.lateNightDefense.teaTimer15MinCompleted} onChange={(v) => up((l) => ({ ...l, lateNightDefense: { ...l.lateNightDefense, teaTimer15MinCompleted: v } }))} label="차 마시고 15분 대기 성공" />
              <Seg<NightOutcome>
                id="lg-outcome"
                label="결과"
                value={log.lateNightDefense.outcome}
                onChange={(v) => up((l) => ({ ...l, lateNightDefense: { ...l.lateNightDefense, outcome: v } }))}
                options={[
                  { value: 'DEFENDED', label: '방어 성공' },
                  { value: 'SAFE_SUBSTITUTE', label: '대체식' },
                  { value: 'HEAVY_SNACK', label: '일반 야식' },
                ]}
              />
            </>
          )}
          <label className="field-inline" htmlFor="lg-fasting">
            다음 날 아침까지 공복(시간)
            <input
              id="lg-fasting"
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={log.lateNightDefense.fastingHoursToMorning}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) up((l) => ({ ...l, lateNightDefense: { ...l.lateNightDefense, fastingHoursToMorning: Math.max(0, Math.min(24, n)) } }));
              }}
            />
          </label>
        </div>
      </Section>
      <p className="muted small center">기록은 이 기기의 브라우저에만 저장됩니다.</p>
    </div>
  );
}

function ScaleRow({ id, label, low, high, value, onChange }: { id: string; label: string; low: string; high: string; value: Scale5; onChange: (v: Scale5) => void }) {
  return (
    <div className="scale">
      <span className="scale-label" id={`${id}-label`}>
        {label}
      </span>
      <div className="scale-btns" role="radiogroup" aria-labelledby={`${id}-label`}>
        {SCALE.map((v) => (
          <button key={v} id={`${id}-${v}`} type="button" role="radio" aria-checked={value === v} className={`scale-btn lv-${v} ${value === v ? 'is-on' : ''}`} onClick={() => onChange(v)}>
            {v}
          </button>
        ))}
      </div>
      <div className="scale-ends muted small">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}
