import type { ReactNode } from 'react';
import { CONSTITUTION_MATRIX, SUB_CONDITION_SPECS } from '../domain/constitution/matrix';
import { useMemo } from 'react';
import { dailyReminders } from '../domain/reminders/schedule';
import { useReminderNotifications, type Route } from './hooks';
import { DataScreen } from './screens/Data';
import { DinnerScreen } from './screens/Dinner';
import { MedsScreen } from './screens/Meds';
import { BodyScreen } from './screens/Body';
import { LogScreen } from './screens/Log';
import { NightScreen } from './screens/Night';
import { TodayScreen } from './screens/Today';
import { TrayScreen } from './screens/Tray';
import { useAppStore } from './store';

const TABS: { route: Route; label: string; icon: ReactNode; match?: Route[] }[] = [
  { route: 'today', label: '오늘', icon: <path d="M12 3v2M12 19v2M4.2 7l1.7 1M18.1 16l1.7 1M3 12h2M19 12h2M4.2 17l1.7-1M18.1 8l1.7-1M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8" /> },
  { route: 'tray', label: '식판', icon: <path d="M3 6h18v12H3zM3 11h18M9 6v5M15 6v5M12 11v7" /> },
  { route: 'dinner', label: '저녁', icon: <path d="M4 12h16a8 8 0 0 1-16 0zM8 8c0-1.2 1-1.2 1-2.4M12 8c0-1.2 1-1.2 1-2.4M16 8c0-1.2 1-1.2 1-2.4" /> },
  { route: 'night', label: '야식', icon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /> },
  { route: 'log', label: '기록', icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { route: 'body', match: ['body', 'meds', 'data'], label: '내 몸', icon: <path d="M12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21v-4a6 6 0 0 1 12 0v4" /> },
];

export function App() {
  const s = useAppStore();
  const reminders = useMemo(() => dailyReminders(s.profile), [s.profile]);
  useReminderNotifications(reminders, s.notifyOn);
  const inBody = s.route === 'body' || s.route === 'meds' || s.route === 'data';
  const spec = CONSTITUTION_MATRIX[s.profile.constitution];
  const sub = SUB_CONDITION_SPECS[s.profile.subCondition];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#today" onClick={(e) => { e.preventDefault(); s.go('today'); }}>
            <span className="brand-mark" aria-hidden="true">順</span>
            <span className="brand-name">순기 식단</span>
          </a>
          <button type="button" className="profile-chip" onClick={() => s.go('body')}>
            {spec.label} · {sub.label.split(' ')[0]}
          </button>
        </div>
      </header>

      <main className="app">
        {inBody && (
          <nav className="subnav" aria-label="내 몸 메뉴">
            {([['body', '몸 설정'], ['meds', '약'], ['data', '알림·백업']] as const).map(([r, label]) => (
              <button key={r} type="button" aria-current={s.route === r ? 'page' : undefined} className={s.route === r ? 'is-on' : ''} onClick={() => s.go(r)}>
                {label}
              </button>
            ))}
          </nav>
        )}
        {s.route === 'today' && <TodayScreen s={s} />}
        {s.route === 'tray' && <TrayScreen s={s} />}
        {s.route === 'dinner' && <DinnerScreen s={s} />}
        {s.route === 'night' && <NightScreen s={s} />}
        {s.route === 'log' && <LogScreen s={s} />}
        {s.route === 'body' && <BodyScreen s={s} />}
        {s.route === 'meds' && <MedsScreen s={s} />}
        {s.route === 'data' && <DataScreen s={s} />}
        <footer className="disclaimer">
          진료·처방을 대신하지 않습니다. 약과 음식의 상호작용은 처방의·약사에게 확인하세요.
        </footer>
      </main>

      <nav className="tabbar" aria-label="화면">
        <div className="tabbar-inner">
          {TABS.map((t) => (
            <a
              key={t.route}
              href={`#${t.route}`}
              className={`tab ${(t.match ?? [t.route]).includes(s.route) ? 'is-on' : ''}`}
              aria-current={(t.match ?? [t.route]).includes(s.route) ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                s.go(t.route);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {t.icon}
              </svg>
              <span>{t.label}</span>
              {t.route === 'night' && s.funnel && s.funnel.step !== 'DONE' && <span className="tab-dot" aria-label="진행 중" />}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
