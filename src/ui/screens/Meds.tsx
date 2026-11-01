import { useState } from 'react';
import { consistencyNotes, DRUG_FOOD_RULES, DRUGS, matchDrug, medAdvisories, resolveMedication, rulesFor, searchDrugs, UNKNOWN_DRUG_ADVICE } from '../../domain/medication/drugs';
import { effectiveMedTimes } from '../../domain/medication/safeguard';
import type { DrugRuleKind, MedicationEntry } from '../../domain/medication/types';
import { isHHMM, toMinutes } from '../../domain/shared/time';
import { Pill, Section, Seg, Toggle } from '../components/bits';
import type { AppStore } from '../store';

const RULE_LABEL: Record<DrugRuleKind, { tone: 'block' | 'hold' | 'little' | 'info'; label: string }> = {
  BLOCK: { tone: 'block', label: '금지' },
  SEPARATE: { tone: 'hold', label: '간격' },
  CAUTION: { tone: 'little', label: '주의' },
  CONSISTENT: { tone: 'info', label: '매일 같게' },
};
const TARGET_LABEL: Record<string, string> = { CAFFEINE: '카페인', GRAPEFRUIT: '자몽', ALCOHOL: '술', LICORICE: '감초', HERBAL_TEA: '한방차', MEAL_TIMING: '식전·식후' };
const TIMING: { value: MedicationEntry['timing']; label: string }[] = [
  { value: 'BEFORE_MEAL', label: '식전' },
  { value: 'AFTER_MEAL', label: '식후' },
  { value: 'ANY', label: '상관없음' },
];

export function MedsScreen({ s }: { s: AppStore }) {
  const { profile, setProfile } = s;
  const auto = profile.autonomicStatus;
  const [name, setName] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [draftTime, setDraftTime] = useState('');
  const [timing, setTiming] = useState<MedicationEntry['timing']>('ANY');
  const meds = auto.medications;
  const match = name.trim() ? matchDrug(name) : null;
  const suggestions = name.trim() && !match ? searchDrugs(name) : [];
  const advisories = medAdvisories(profile);
  const consist = consistencyNotes(profile);

  const setMeds = (next: MedicationEntry[]) => setProfile({ ...profile, autonomicStatus: { ...auto, medications: next } });
  const add = () => {
    if (!name.trim()) return;
    setMeds([...meds, resolveMedication(name, times, timing)]);
    setName('');
    setTimes([]);
    setTiming('ANY');
  };

  return (
    <div className="screen">
      <Section title="먹는 약" kicker="약 이름을 넣으면 약마다 피할 음식을 골라 드립니다">
        <Toggle id="meds-on" checked={auto.takingWesternMeds} onChange={(v) => setProfile({ ...profile, autonomicStatus: { ...auto, takingWesternMeds: v } })} label="양약 복용 중" hint="끄면 복약 60분 규칙과 약물 규칙이 모두 꺼집니다" />

        {auto.takingWesternMeds && (
          <>
            {meds.length === 0 && <p className="muted">등록한 약이 없습니다. 아래에 약 이름(상품명·성분명)을 적어 주세요. 안 적어도 복약 시각 규칙과 카페인·자몽 금기는 적용됩니다.</p>}
            <ul className="medlist">
              {meds.map((m, i) => {
                const def = m.drugId ? DRUGS.find((d) => d.id === m.drugId) : null;
                const rules = def ? rulesFor(def.id).filter((r) => r.rule !== 'CONSISTENT') : [];
                return (
                  <li key={`${m.name}-${i}`} className="med">
                    <div className="med-head">
                      <div>
                        <b>{m.name}</b>
                        <p className="muted small">
                          {def ? `${def.ingredient} · ${def.classLabel}${def.pathway ? ` · ${def.pathway}` : ''}` : '사전에 없는 약'}
                          {' · '}
                          {m.times.length ? m.times.join(', ') : '복약 시각 미입력'} · {TIMING.find((t) => t.value === m.timing)?.label}
                        </p>
                      </div>
                      <button type="button" className="btn btn-small" onClick={() => setMeds(meds.filter((_, k) => k !== i))} aria-label={`${m.name} 삭제`}>
                        삭제
                      </button>
                    </div>
                    {!def && <p className="banner banner-hold">{UNKNOWN_DRUG_ADVICE}</p>}
                    {def && rules.length === 0 && <p className="muted small">사전에 이 약의 음식 규칙이 없습니다. 일반 규칙만 적용됩니다.</p>}
                    {rules.map((r) => (
                      <div key={`${r.target}-${r.rule}`} className="rule">
                        <div className="rule-head">
                          <Pill tone={RULE_LABEL[r.rule].tone}>{RULE_LABEL[r.rule].label}</Pill>
                          <b>{TARGET_LABEL[r.target] ?? r.target}</b>
                          {!r.verified && <Pill tone="hold">약사 확인 필요</Pill>}
                        </div>
                        <p className="small">{r.reason}</p>
                        <p className="muted small">출처: {r.source}</p>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ul>

            <div className="addmed">
              <label className="field" htmlFor="med-name">
                <span className="field-label">약 이름</span>
                <input id="med-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 렉사프로, 인데놀, 알프라졸람" autoComplete="off" />
              </label>
              {match && (
                <p className="small">
                  <Pill tone="take">사전에 있음</Pill> {match.ingredient} · {match.classLabel}
                </p>
              )}
              {name.trim() && !match && (
                <p className="small">
                  <Pill tone="hold">사전에 없음</Pill> 그래도 등록할 수 있습니다. 일반 규칙만 적용되고 약사 확인 안내가 붙습니다.
                </p>
              )}
              {suggestions.length > 0 && (
                <div className="chips">
                  {suggestions.map((d) => (
                    <button key={d.id} type="button" className="chip" onClick={() => setName(d.names[0]!)}>
                      {d.names[0]}
                    </button>
                  ))}
                </div>
              )}
              <div className="field">
                <span className="field-label">복용 시각</span>
                <div className="chips">
                  {times.map((t) => (
                    <span key={t} className="chip chip-hold">
                      <span className="mono">{t}</span>
                      <button type="button" className="chip-x" aria-label={`${t} 삭제`} onClick={() => setTimes(times.filter((x) => x !== t))}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="row-gap">
                  <input id="med-time" type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} aria-label="추가할 복용 시각" />
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={!isHHMM(draftTime) || times.includes(draftTime)}
                    onClick={() => {
                      setTimes([...times, draftTime].sort((a, b) => toMinutes(a) - toMinutes(b)));
                      setDraftTime('');
                    }}
                  >
                    시각 추가
                  </button>
                </div>
              </div>
              <div className="field">
                <span className="field-label">식전·식후</span>
                <Seg<MedicationEntry['timing']> id="med-timing" label="식전 식후" value={timing} onChange={setTiming} options={TIMING} />
              </div>
              <button type="button" className="btn btn-primary btn-wide" disabled={!name.trim()} onClick={add}>
                약 등록
              </button>
            </div>
          </>
        )}
      </Section>

      {auto.takingWesternMeds && (
        <Section title="적용 중인 시각" kicker="복약 전후 60분">
          <div className="chips">
            {effectiveMedTimes(profile).map((t) => (
              <span key={t} className="chip chip-hold mono">
                {t}
              </span>
            ))}
          </div>
          <p className="muted small">기본 복약 시각(내 몸 탭)과 약마다 적은 시각을 합친 것입니다. 이 시각의 전후 60분에는 한방차·유제품·과일을 보류합니다.</p>
        </Section>
      )}

      {consist.length > 0 && (
        <Section title="매일 같은 방식으로">
          {consist.map((n) => (
            <div key={n.drugName} className="rule">
              <div className="rule-head">
                <Pill tone="info">매일 같게</Pill>
                <b>{n.drugName}</b>
                {!n.verified && <Pill tone="hold">약사 확인 필요</Pill>}
              </div>
              <p className="small">{n.reason}</p>
            </div>
          ))}
        </Section>
      )}

      {advisories.length > 0 && (
        <Section title="약사 확인이 필요한 약">
          <ul className="tips tips-alert">
            {advisories.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="이 사전의 한계" kicker={`약 ${DRUGS.length}종 · 규칙 ${DRUG_FOOD_RULES.length}개`}>
        <p className="small">
          사전의 규칙은 모두 <b>원문 확인 전(미검증)</b> 상태입니다. 일반적인 약리 지식을 옮긴 것이라 실제 허가사항과 다를 수 있어서 ‘약사 확인 필요’를 붙였습니다. 용량 조절이나 복약 중단은 이 앱이 권하지 않습니다. 처방의·약사와 상의하세요.
        </p>
      </Section>
    </div>
  );
}
