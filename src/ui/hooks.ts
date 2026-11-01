import { useEffect, useState } from 'react';

/** 현재 시각. intervalMs마다 갱신 */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type Route = 'today' | 'tray' | 'night' | 'log' | 'body';
export const ROUTES: readonly Route[] = ['today', 'tray', 'night', 'log', 'body'];

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
