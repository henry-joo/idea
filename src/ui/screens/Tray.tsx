import { useMemo, useState } from 'react';
import { evaluateTray, SAMPLE_MENUS, type MealSlot, type TrayFinal, type TrayItem } from '../../domain/cafeteria/tray';
import { getFood } from '../../domain/food/catalog';
import { isHHMM } from '../../domain/shared/time';
import { Pill, RuleTrace, Section, Seg, TrayPill } from '../components/bits';
import type { AppStore } from '../store';

const GROUPS: { key: TrayFinal[]; title: string; empty: string }[] = [
  { key: ['TAKE'], title: '담기', empty: '담을 반찬이 없습니다' },
  { key: ['LITTLE'], title: '조금만', empty: '' },
  { key: ['HOLD'], title: '복약 때문에 보류', empty: '' },
  { key: ['SKIP', 'BLOCKED'], title: '거르기', empty: '거를 반찬이 없습니다' },
];

export function TrayScreen({ s }: { s: AppStore }) {
  const meal = s.trayMeal;
  const { profile } = s;
  const defaultTime = meal === 'BREAKFAST' ? profile.routine.breakfast : profile.routine.lunch;
  const [menus, setMenus] = useState<Record<MealSlot, string>>({ ...SAMPLE_MENUS });
  const [times, setTimes] = useState<Record<MealSlot, string>>({ BREAKFAST: profile.routine.breakfast, LUNCH: profile.routine.lunch });
  const [saved, setSaved] = useState(false);
  const menu = menus[meal];
  const time = isHHMM(times[meal]) ? times[meal] : defaultTime;
  const isSample = menu === SAMPLE_MENUS[meal];

  const plan = useMemo(
    () => evaluateTray({ menuText: menu, meal, profile, yesterday: s.yesterdayReal, mealTime: time }),
    [menu, meal, profile, s.yesterdayReal, time],
  );

  // "이대로 담았다" = 거르기 판정(찬 샐러드·돼지고기·튀김 포함)을 따랐다는 뜻
  const commit = () => {
    s.upsertLog(s.today, (l) => ({
      ...l,
      cafeteriaFilterLog: {
        morningPortion: meal === 'BREAKFAST' ? plan.portion.percent : l.cafeteriaFilterLog.morningPortion,
        avoidedColdSaladAndPork: true,
        includedRadishOrWarmSoup: l.cafeteriaFilterLog.includedRadishOrWarmSoup || plan.hasWarmSoupOrRadish,
      },
    }));
    setSaved(true);
  };

  return (
    <div className="screen">
      <header className="screen-head">
        <p className="kicker">구내식당 · 뺄셈 배식</p>
        <h1>식판 시뮬레이터</h1>
      </header>

      <div className="tray-controls">
        <Seg
          id="meal"
          label="식사"
          value={meal}
          onChange={(m) => {
            s.setTrayMeal(m);
            setSaved(false);
          }}
          options={[
            { value: 'BREAKFAST', label: '아침' },
            { value: 'LUNCH', label: '점심' },
          ]}
        />
        <label className="field-inline" htmlFor="meal-time">
          식사 시각
          <input id="meal-time" type="time" value={times[meal]} onChange={(e) => setTimes({ ...times, [meal]: e.target.value })} />
        </label>
      </div>

      <div className="field">
        <label htmlFor="menu-text" className="field-label">
          오늘 메뉴판 {isSample && <span className="tag-example">예시 메뉴</span>}
        </label>
        <textarea
          id="menu-text"
          rows={3}
          value={menu}
          onChange={(e) => {
            setMenus({ ...menus, [meal]: e.target.value });
            setSaved(false);
          }}
          placeholder="예: 백미밥, 소고기무국, 제육볶음, 계란말이, 콩나물무침"
        />
        <div className="row-gap">
          <button type="button" className="btn btn-ghost" onClick={() => setMenus({ ...menus, [meal]: '' })}>
            지우기
          </button>
          {!isSample && (
            <button type="button" className="btn btn-ghost" onClick={() => setMenus({ ...menus, [meal]: SAMPLE_MENUS[meal] })}>
              예시 메뉴 불러오기
            </button>
          )}
        </div>
        <p className="muted small">쉼표나 줄바꿈으로 구분합니다. 카탈로그에 없는 메뉴는 이름으로 재료·조리법을 추정합니다.</p>
      </div>

      {meal === 'BREAKFAST' && (
        <div className={`banner ${plan.portion.percent === 100 ? 'banner-take' : 'banner-little'}`}>
          <span>
            <b>아침 {plan.portion.percent}%</b> · {plan.portion.reason}
          </span>
        </div>
      )}

      <TrayBoard items={plan.items} ricePercent={plan.portion.percent} />

      {plan.unknown.length > 0 && (
        <p className="banner banner-info">판별하지 못한 메뉴: {plan.unknown.join(', ')}. 주재료를 함께 적어 주세요 (예: “오늘의특선(돼지고기)”).</p>
      )}

      {s.homeDay && (
        <p className="banner banner-info">
          오늘은 {s.profile.holidayDates.includes(s.today) ? '쉬는 날로 표시한 날' : '주말'}입니다. 집밥 추천은 ‘저녁’ 탭에서 아침·점심도 볼 수 있습니다.
        </p>
      )}

      {GROUPS.map((g) => {
        const list = plan.items.filter((i) => g.key.includes(i.final));
        if (list.length === 0 && !g.empty) return null;
        return (
          <Section key={g.title} title={`${g.title} ${list.length}`}>
            {list.length === 0 ? <p className="muted">{g.empty}</p> : <ul className="dish-list">{list.map((i) => <DishRow key={i.raw} item={i} />)}</ul>}
          </Section>
        );
      })}

      <Section kicker="먹는 순서" title="위에 부담을 덜 주는 순서">
        <ol className="order">
          {plan.eatingOrder.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ol>
        <ul className="tips">
          {plan.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </Section>

      <div className="sticky-cta">
        <button type="button" className="btn btn-primary" onClick={commit} disabled={plan.items.length === 0}>
          {saved ? '오늘 기록에 반영했습니다' : '이대로 담았어요 · 기록에 반영'}
        </button>
      </div>
    </div>
  );
}

function DishRow({ item }: { item: TrayItem }) {
  const ings = item.dish.ingredients.map((i) => getFood(i.foodId).name).join(', ');
  return (
    <li className="dish">
      <details>
        <summary>
          <span className="dish-name">{item.dish.name}</span>
          <TrayPill v={item.final} />
          {item.result.needsVerification && <span className="dish-verify">약사 확인 필요</span>}
          <span className="dish-why">{item.final === 'HOLD' && item.holdUntil ? `${item.holdUntil}부터 · ` : ''}{item.headline}</span>
        </summary>
        <div className="dish-detail">
          <p className="muted small">
            {item.source === 'INFERRED' ? '추정 재료' : '주재료'}: {ings} · 점수 <span className="mono">{item.result.score}</span>
            {item.dish.note && <> · {item.dish.note}</>}
          </p>
          <RuleTrace hits={item.result.hits} />
          {item.result.drugNotes.map((n) => (
            <p key={`${n.drugName}-${n.reason}`} className="small drug-note">
              <b>{n.drugName}</b> · {n.reason} <span className="muted">(출처: {n.source})</span> {!n.verified && <Pill tone="hold">약사 확인 필요</Pill>}
            </p>
          ))}
          {item.result.ingredientScores.length > 1 &&
            item.result.ingredientScores.map((sc) => (
              <details key={sc.foodId} className="sub-trace">
                <summary>
                  {getFood(sc.foodId).name} <span className="mono">{sc.score}</span>
                </summary>
                <RuleTrace hits={sc.hits} />
              </details>
            ))}
          {item.result.ingredientScores.length === 1 && <RuleTrace hits={item.result.ingredientScores[0]!.hits} />}
        </div>
      </details>
    </li>
  );
}

/** 담기·조금만 판정 반찬을 실제 식판 칸에 배치해 보여 준다 */
function TrayBoard({ items, ricePercent }: { items: TrayItem[]; ricePercent: number }) {
  const ok = items.filter((i) => i.final === 'TAKE' || i.final === 'LITTLE');
  const take = (pred: (i: TrayItem) => boolean) => {
    const idx = ok.findIndex(pred);
    return idx >= 0 ? ok.splice(idx, 1)[0]! : null;
  };
  const rice = take((i) => i.dish.slot === 'RICE') ?? take((i) => i.dish.slot === 'ONE_DISH');
  const soup = take((i) => i.dish.slot === 'SOUP');
  const main = take((i) => i.dish.slot === 'MAIN');
  const drinks = ok.filter((i) => i.dish.slot === 'DESSERT' || i.dish.slot === 'DRINK');
  const sides = ok.filter((i) => !drinks.includes(i)).slice(0, 4);
  const held = items.filter((i) => i.final === 'HOLD');

  const Cell = ({ item, area, fallback }: { item: TrayItem | null; area: string; fallback: string }) => (
    <div className={`tray-cell ${item ? (item.final === 'LITTLE' ? 'is-little' : 'is-take') : 'is-empty'}`} style={{ gridArea: area }}>
      <span className="tray-name">{item ? item.dish.name : fallback}</span>
      {item?.final === 'LITTLE' && <span className="tray-mark">조금</span>}
      {area === 'rice' && item && ricePercent !== 100 && <span className="tray-mark">{ricePercent === 50 ? '반 공기' : '3/4 공기'}</span>}
    </div>
  );

  return (
    <figure className="tray" aria-label="담을 반찬 배치">
      <div className="tray-board">
        {[0, 1, 2, 3].map((k) => (
          <Cell key={k} item={sides[k] ?? null} area={`s${k + 1}`} fallback="비움" />
        ))}
        <Cell item={rice} area="rice" fallback="밥 없음" />
        <Cell item={soup} area="soup" fallback="국 없음" />
        <Cell item={main} area="main" fallback="주찬 비움" />
      </div>
      {(drinks.length > 0 || held.length > 0) && (
        <figcaption className="tray-side">
          {drinks.map((d) => (
            <span key={d.raw} className="chip">
              후식 · {d.dish.name}
            </span>
          ))}
          {held.map((d) => (
            <span key={d.raw} className="chip chip-hold">
              {d.dish.name} {d.holdUntil}부터
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}
