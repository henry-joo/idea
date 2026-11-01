import { portionFor } from '../../domain/cafeteria/tray';
import { CONSTITUTION_MATRIX, SUB_CONDITION_SPECS } from '../../domain/constitution/matrix';
import { detectRedFlags } from '../../domain/log/insights';
import { checkIntakeAt, medStatusAt, MED_CLASS_LABEL, RESTRICTED_CLASSES } from '../../domain/medication/safeguard';
import { isLateNight } from '../../domain/night/funnel';
import { fromMinutes, toMinutes } from '../../domain/shared/time';
import { Breathing478 } from '../components/Breathing478';
import { Pill, Section, Toggle } from '../components/bits';
import { Timeline24 } from '../components/Timeline24';
import type { AppStore } from '../store';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export function TodayScreen({ s }: { s: AppStore }) {
  const { profile, nowMin, today } = s;
  const spec = CONSTITUTION_MATRIX[profile.constitution];
  const sub = SUB_CONDITION_SPECS[profile.subCondition];
  const meds = profile.autonomicStatus.takingWesternMeds;
  const status = medStatusAt(profile, nowMin);
  const check = checkIntakeAt(profile, 'HERBAL_TEA', nowMin);
  const portion = portionFor('BREAKFAST', s.yesterdayReal);
  const log = s.getLog(today);
  const flags = detectRedFlags(s.realLogs, today);
  const d = s.now;

  const next = nextAction(s);

  return (
    <div className="screen">
      <header className="hero">
        <p className="kicker">
          {d.getMonth() + 1}월 {d.getDate()}일 {WEEKDAY[d.getDay()]}요일 · {fromMinutes(nowMin)}
        </p>
        <h1>
          {spec.label} <span className="hanja">{spec.hanja}</span>
        </h1>
        <p className="hero-sub">
          {sub.label} · {profile.autonomicStatus.parasympatheticLow ? '부교감 저하' : '자율신경 안정'} · {meds ? '양약 복용 중' : '양약 없음'}
        </p>
      </header>

      {flags.map((f) => (
        <div key={f.id} className={`banner banner-${f.level === 'URGENT' ? 'skip' : 'little'}`} role="alert">
          {f.message}
        </div>
      ))}

      <section className={`now-card ${check.allowed ? '' : 'is-hold'}`}>
        <div className="now-head">
          <p className="kicker">지금 먹어도 되나</p>
          {check.allowed ? <Pill tone="take">제한 없음</Pill> : <Pill tone="hold">복약 창</Pill>}
        </div>
        {check.allowed ? (
          <p className="now-main">
            한방차·유제품·과일 모두 괜찮습니다.
            {status.upcoming && meds && (
              <>
                {' '}
                다음 제한은 <b className="mono">{fromMinutes(status.upcoming.start)}</b>부터 ({status.upcoming.medTime} 복약).
              </>
            )}
          </p>
        ) : (
          <p className="now-main">
            <b className="mono">{check.window!.medTime}</b> 복약 전후 60분입니다.{' '}
            {RESTRICTED_CLASSES.map((c) => MED_CLASS_LABEL[c]).join('·')}은 <b className="mono">{check.nextAllowedAt}</b>부터 드세요. 물은 미온수로.
          </p>
        )}
        <p className="now-foot">
          <Pill tone="block">전역 금기</Pill> 커피·녹차 등 카페인, 자몽류
        </p>
      </section>

      <Timeline24 profile={profile} nowMin={nowMin} />

      {next && (
        <button type="button" className="next-card" onClick={next.go}>
          <span className="kicker">{next.kicker}</span>
          <span className="next-title">{next.title}</span>
          <span className="next-sub">{next.sub}</span>
          <span className="next-arrow" aria-hidden="true">→</span>
        </button>
      )}

      {profile.mealEnvironment.breakfast !== 'SKIP' && (
        <Section kicker="동적 가이드" title={`오늘 아침 ${portion.percent}%`}>
          <div className="portion">
            <PortionBowl percent={portion.percent} />
            <p>{portion.reason}</p>
          </div>
          {!s.yesterdayReal && <p className="muted small">어젯밤 기록이 없어 평소 양으로 계산했습니다. 야식 탭에서 기록하면 반영됩니다.</p>}
        </Section>
      )}

      <Section kicker="미주신경 루틴" title="오늘의 세 가지">
        <div className="stack">
          <Toggle
            id="today-breath"
            checked={log.vagalToneRoutine.preMealBreathing478}
            onChange={(v) => s.upsertLog(today, (l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, preMealBreathing478: v } }))}
            label="식전 2분 4-7-8 호흡"
            hint="숨을 길게 내쉬면 미주신경이 켜지고 위 상부가 풀립니다"
          />
          <Toggle
            id="today-walk"
            checked={log.vagalToneRoutine.postMealWalk15Min}
            onChange={(v) => s.upsertLog(today, (l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, postMealWalk15Min: v } }))}
            label="식후 15분 리듬 워킹"
            hint="빠르지 않게, 대화 가능한 속도로"
          />
          <Toggle
            id="today-water"
            checked={log.vagalToneRoutine.warmWaterOnly}
            onChange={(v) => s.upsertLog(today, (l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, warmWaterOnly: v } }))}
            label="식사 중 찬물 대신 온수"
            hint="정수기 온수 반 컵. 찬물은 위 평활근을 다시 굳힙니다"
          />
        </div>
        <Breathing478 onDone={() => s.upsertLog(today, (l) => ({ ...l, vagalToneRoutine: { ...l.vagalToneRoutine, preMealBreathing478: true } }))} />
      </Section>
    </div>
  );
}

function PortionBowl({ percent }: { percent: number }) {
  return (
    <svg className="bowl" viewBox="0 0 64 44" role="img" aria-label={`밥 ${percent}%`}>
      <path className="bowl-rice" d={percent === 50 ? 'M10 24 Q32 16 54 24 L54 26 L10 26Z' : 'M8 22 Q32 2 56 22 L56 26 L8 26Z'} />
      <path className="bowl-body" d="M4 24 H60 Q58 42 32 42 Q6 42 4 24Z" />
    </svg>
  );
}

function nextAction(s: AppStore): { kicker: string; title: string; sub: string; go: () => void } | null {
  const { profile, nowMin } = s;
  const b = toMinutes(profile.routine.breakfast);
  const l = toMinutes(profile.routine.lunch);
  if (isLateNight(nowMin)) {
    return { kicker: '야식 시간대', title: '배고프면 바로 먹지 말고 퍼널부터', sub: '따뜻한 차 → 15분 → 가짜 배고픔 판별', go: () => s.go('night') };
  }
  if (profile.mealEnvironment.breakfast === 'CAFETERIA' && nowMin < b + 60) {
    return { kicker: `아침 ${profile.routine.breakfast} · 구내식당`, title: '아침 식판 거르기', sub: '메뉴판을 붙여 넣으면 담을 것과 거를 것을 나눠 드립니다', go: () => { s.setTrayMeal('BREAKFAST'); s.go('tray'); } };
  }
  if (profile.mealEnvironment.lunch === 'CAFETERIA' && nowMin < l + 60) {
    return { kicker: `점심 ${profile.routine.lunch} · 구내식당`, title: '점심 식판 거르기', sub: '후식 과일·요구르트는 복약 창을 같이 확인합니다', go: () => { s.setTrayMeal('LUNCH'); s.go('tray'); } };
  }
  return { kicker: '하루 마무리', title: '오늘 명치 상태 기록하기', sub: '내일 아침 식사량과 주간 분석에 쓰입니다', go: () => s.go('log') };
}
