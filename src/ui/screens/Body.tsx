import { useMemo, useState } from 'react';
import { CONSTITUTION_MATRIX, SUB_CONDITION_SPECS } from '../../domain/constitution/matrix';
import { FOODS, getFood } from '../../domain/food/catalog';
import type { CookingContext, CookingMethod, FoodCategory, ServingTemp } from '../../domain/food/types';
import { ALWAYS_RED_FLAGS } from '../../domain/log/insights';
import { withConstitution } from '../../domain/profile/defaults';
import { CONSTITUTIONS, SUB_CONDITIONS, type UserProfile } from '../../domain/profile/types';
import { defaultContext, scoreFood } from '../../domain/scoring/engine';
import { isHHMM, toMinutes } from '../../domain/shared/time';
import { RuleTrace, Section, Seg, Toggle, VerdictPill } from '../components/bits';
import type { AppStore } from '../store';

const CAT_LABEL: Record<FoodCategory, string> = {
  GRAIN: '곡류·두류',
  MEAT_FISH: '육류·어패류',
  VEGGIE: '채소',
  FRUIT: '과일',
  TEA_SPICE: '차·양념',
  DAIRY: '유제품',
  BEVERAGE: '음료',
};

const METHOD_LABEL: Record<CookingMethod, string> = {
  RAW: '생식·샐러드',
  BLANCHED: '데침·나물',
  STEAMED: '찜',
  BOILED: '삶기·죽',
  SOUP: '국·탕',
  STIR_FRIED: '볶음',
  BRAISED: '조림',
  GRILLED: '구이',
  PAN_FRIED: '전·부침',
  DEEP_FRIED: '튀김',
  AS_IS: '그대로',
};

const TEMP_LABEL: Record<ServingTemp, string> = { HOT: '뜨겁게', WARM: '따뜻하게', ROOM: '상온', COLD: '차갑게' };

export function BodyScreen({ s }: { s: AppStore }) {
  const { profile, setProfile } = s;
  const spec = CONSTITUTION_MATRIX[profile.constitution];
  const set = (p: Partial<UserProfile>) => setProfile({ ...profile, ...p });
  const auto = profile.autonomicStatus;

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker">체질 · 병리 · 복약</p>
        <h1>내 몸 설정</h1>
      </header>

      <Section title="사상체질">
        <div className="types" role="radiogroup" aria-label="사상체질">
          {CONSTITUTIONS.map((c) => {
            const t = CONSTITUTION_MATRIX[c];
            return (
              <button key={c} id={`type-${c}`} type="button" role="radio" aria-checked={profile.constitution === c} className={`type ${profile.constitution === c ? 'is-on' : ''}`} onClick={() => setProfile(withConstitution(profile, c))}>
                <span className="type-name">{t.label}</span>
                <span className="type-hanja">{t.hanja}</span>
                <span className="type-organ">{t.organ}</span>
                {t.status === 'DEFAULT' && <span className="type-badge">기본</span>}
              </button>
            );
          })}
        </div>
        <div className="matrix">
          <p>
            <b>핵심 병리</b> {spec.pathology}
          </p>
          <p className="chips">
            {spec.weightLegend.map((w) => (
              <span key={w} className="chip chip-weight">
                {w}
              </span>
            ))}
          </p>
          <p>
            <b>권장</b> {spec.keyFoods.join(', ')}
          </p>
          <p>
            <b>주의·금기</b> {spec.cautionFoods.join(', ')}
          </p>
        </div>
      </Section>

      <Section title="현재 병리 상태" kicker="같은 체질도 지금 상태에 따라 가중치가 바뀝니다">
        <div className="stack">
          {SUB_CONDITIONS.map((c) => {
            const sc = SUB_CONDITION_SPECS[c];
            return (
              <label key={c} className={`radio-card ${profile.subCondition === c ? 'is-on' : ''}`} htmlFor={`sub-${c}`}>
                <input id={`sub-${c}`} type="radio" name="sub" checked={profile.subCondition === c} onChange={() => set({ subCondition: c })} />
                <span>
                  <b>{sc.label}</b>
                  <small>{sc.description}</small>
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      <Section title="자율신경 · 복약">
        <div className="stack">
          <Toggle id="para" checked={auto.parasympatheticLow} onChange={(v) => set({ autonomicStatus: { ...auto, parasympatheticLow: v } })} label="부교감신경 저하" hint="켜져 있으면 카페인을 전역 차단합니다" />
          <Toggle id="meds" checked={auto.takingWesternMeds} onChange={(v) => set({ autonomicStatus: { ...auto, takingWesternMeds: v } })} label="자율신경 조절 양약 복용 중" hint="복약 ±60분 한방차·유제품·과일 보류, 자몽·고농축 홍삼 차단" />
          {auto.takingWesternMeds && <p className="muted small">약 이름과 약마다 피할 음식은 ‘약’ 화면에서 관리합니다.</p>}
          {auto.takingWesternMeds && <MedTimes profile={profile} onChange={(medSchedules) => set({ autonomicStatus: { ...auto, medSchedules } })} />}
        </div>
      </Section>

      <Section title="식사 환경과 일과">
        <div className="grid2">
          <label className="field" htmlFor="env-b">
            <span className="field-label">아침</span>
            <select id="env-b" value={profile.mealEnvironment.breakfast} onChange={(e) => set({ mealEnvironment: { ...profile.mealEnvironment, breakfast: e.target.value as UserProfile['mealEnvironment']['breakfast'] } })}>
              <option value="CAFETERIA">회사 구내식당</option>
              <option value="HOME">집</option>
              <option value="SKIP">거름</option>
            </select>
          </label>
          <label className="field" htmlFor="env-l">
            <span className="field-label">점심</span>
            <select id="env-l" value={profile.mealEnvironment.lunch} onChange={(e) => set({ mealEnvironment: { ...profile.mealEnvironment, lunch: e.target.value as UserProfile['mealEnvironment']['lunch'] } })}>
              <option value="CAFETERIA">회사 구내식당</option>
              <option value="RESTAURANT">외식</option>
              <option value="HOME">집</option>
            </select>
          </label>
          <label className="field" htmlFor="env-d">
            <span className="field-label">저녁</span>
            <select id="env-d" value={profile.mealEnvironment.dinner} onChange={(e) => set({ mealEnvironment: { ...profile.mealEnvironment, dinner: e.target.value as UserProfile['mealEnvironment']['dinner'] } })}>
              <option value="HOME">집</option>
              <option value="RESTAURANT">외식</option>
              <option value="SKIP">거름</option>
            </select>
          </label>
          <label className="field" htmlFor="env-n">
            <span className="field-label">야식</span>
            <select id="env-n" value={profile.mealEnvironment.lateNightHabit} onChange={(e) => set({ mealEnvironment: { ...profile.mealEnvironment, lateNightHabit: e.target.value as UserProfile['mealEnvironment']['lateNightHabit'] } })}>
              <option value="FREQUENT">잦음</option>
              <option value="OCCASIONAL">가끔</option>
              <option value="NONE">거의 없음</option>
            </select>
          </label>
          {(
            [
              ['breakfast', '아침 시각'],
              ['lunch', '점심 시각'],
              ['dinner', '저녁 시각'],
              ['bedtime', '취침 시각'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="field" htmlFor={`rt-${k}`}>
              <span className="field-label">{label}</span>
              <input id={`rt-${k}`} type="time" value={profile.routine[k]} onChange={(e) => isHHMM(e.target.value) && set({ routine: { ...profile.routine, [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      </Section>

      <FoodLookup profile={profile} />

      <Section title="이럴 땐 앱 대신 병원으로" kicker="명치 증상의 위험 신호">
        <ul className="tips tips-alert">
          {ALWAYS_RED_FLAGS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p className="muted small">
          이 앱은 사상의학 식이 원칙을 생활에 옮기는 도구이며 진료·처방을 대신하지 않습니다. 복용 중인 약과 음식의 상호작용은 반드시 처방의·약사에게 확인하세요.
        </p>
      </Section>
    </div>
  );
}

function MedTimes({ profile, onChange }: { profile: UserProfile; onChange: (t: string[]) => void }) {
  const times = profile.autonomicStatus.medSchedules;
  const [draft, setDraft] = useState('');
  return (
    <div className="medtimes">
      <span className="field-label">복약 시각</span>
      <div className="chips">
        {times.map((t) => (
          <span key={t} className="chip chip-hold">
            <span className="mono">{t}</span>
            <button type="button" className="chip-x" aria-label={`${t} 삭제`} onClick={() => onChange(times.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="row-gap">
        <input id="med-new" type="time" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="추가할 복약 시각" />
        <button
          type="button"
          className="btn btn-small"
          disabled={!isHHMM(draft) || times.includes(draft)}
          onClick={() => {
            onChange([...times, draft].sort((a, b) => toMinutes(a) - toMinutes(b)));
            setDraft('');
          }}
        >
          추가
        </button>
      </div>
    </div>
  );
}

function FoodLookup({ profile }: { profile: UserProfile }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FoodCategory | 'ALL'>('ALL');
  const [picked, setPicked] = useState<string>('cabbage');
  const food = getFood(picked);
  const [ctx, setCtx] = useState<CookingContext>(() => defaultContext(food));
  const result = scoreFood(food, ctx, profile);

  const ranked = useMemo(
    () =>
      FOODS.filter((f) => (cat === 'ALL' || f.category === cat) && (!q || f.name.includes(q.trim())))
        .map((f) => ({ f, r: scoreFood(f, defaultContext(f), profile) }))
        .sort((a, b) => Number(a.r.blocked) - Number(b.r.blocked) || b.r.score - a.r.score),
    [cat, q, profile],
  );

  const pick = (id: string) => {
    setPicked(id);
    setCtx(defaultContext(getFood(id)));
  };

  return (
    <Section title="식재료 판정기" kicker="규칙 엔진이 점수를 매기는 과정">
      <div className="lookup-controls">
        <input id="food-q" type="search" placeholder="식재료 검색 (예: 무, 홍삼)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="식재료 검색" />
        <select id="food-cat" value={cat} onChange={(e) => setCat(e.target.value as FoodCategory | 'ALL')} aria-label="분류">
          <option value="ALL">전체</option>
          {(Object.keys(CAT_LABEL) as FoodCategory[]).map((c) => (
            <option key={c} value={c}>
              {CAT_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <ul className="food-list">
        {ranked.map(({ f, r }) => (
          <li key={f.id}>
            <button type="button" className={`food-row ${picked === f.id ? 'is-on' : ''}`} onClick={() => pick(f.id)}>
              <span className="food-name">{f.name}</span>
              <span className="mono score">{r.blocked ? '–' : r.score}</span>
              <VerdictPill v={r.verdict} />
            </button>
          </li>
        ))}
      </ul>

      <div className="lookup-card">
        <div className="lookup-head">
          <div>
            <p className="kicker">{CAT_LABEL[food.category]}</p>
            <h3>{food.name}</h3>
          </div>
          <div className="lookup-score">
            <span className="mono stat-value">{result.blocked ? '–' : result.score}</span>
            <VerdictPill v={result.verdict} />
          </div>
        </div>
        {food.note && <p className="muted small">{food.note}</p>}
        <div className="lookup-ctx">
          <label className="field" htmlFor="ctx-method">
            <span className="field-label">조리법</span>
            <select id="ctx-method" value={ctx.method} onChange={(e) => setCtx({ ...ctx, method: e.target.value as CookingMethod })}>
              {(Object.keys(METHOD_LABEL) as CookingMethod[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="field-label">제공 온도</span>
            <Seg<ServingTemp> id="ctx-temp" label="제공 온도" value={ctx.servingTemp} onChange={(v) => setCtx({ ...ctx, servingTemp: v })} options={(Object.keys(TEMP_LABEL) as ServingTemp[]).map((t) => ({ value: t, label: TEMP_LABEL[t] }))} />
          </div>
          <Toggle id="ctx-warm" checked={ctx.warmSeasoning} onChange={(v) => setCtx({ ...ctx, warmSeasoning: v })} label="생강·마늘·들기름 등 온열 양념" />
        </div>
        <RuleTrace hits={result.hits} />
      </div>
    </Section>
  );
}
