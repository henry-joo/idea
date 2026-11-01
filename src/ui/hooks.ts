import { useEffect, useState } from 'react';
import { showNotification } from '../infra/device';

/** 현재 시각. intervalMs마다 갱신 */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type Route = 'today' | 'tray' | 'night' | 'log' | 'body' | 'meds' | 'data';
export const ROUTES: readonly Route[] = ['today', 'tray', 'night', 'log', 'body', 'meds', 'data'];

function routeFromHash(): Route {
  const h = window.location.hash.replace('#', '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'today';
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(routeFromHash);
  useEffect(() => {
    const on = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (r: Route) => {
    if (routeFromHash() !== r) window.location.hash = r;
    setRoute(r);
    window.scrollTo({ top: 0 });
  };
  return [route, go];
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return;
    }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * 앱이 열려 있을 때 알림 시각이 되면 브라우저 알림을 띄운다 (D7 2순위).
 * 서버가 없어서 앱이 닫혀 있으면 울릴 수 없다. 그 경우는 캘린더(.ics)가 맡는다.
 */
export function useReminderNotifications(reminders: { id: string; time: string; title: string; body: string }[], enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const fired = new Set<string>();
    const tick = () => {
      const d = new Date();
      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      for (const r of reminders) {
        const key = `${day}|${r.id}`;
        if (r.time === hhmm && !fired.has(key)) {
          fired.add(key);
          void showNotification(r.title, r.body, r.id);
        }
      }
    };
    const id = window.setInterval(tick, 15_000);
    tick();
    return () => window.clearInterval(id);
  }, [reminders, enabled]);
}
