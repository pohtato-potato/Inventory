import { useSyncExternalStore } from 'react';

/** Routes live in the hash, e.g. #/piece?id=abc, so any static host works. */
export interface Route {
  path: string;
  params: URLSearchParams;
}

export const HOME_PATH = '/wardrobe';

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path && path !== '/' ? path : HOME_PATH, params: new URLSearchParams(query) };
}

const hasWindow = typeof window !== 'undefined';
const listeners = new Set<() => void>();
let snapshot: Route & { key: string } = read();

function read(): Route & { key: string } {
  const hash = hasWindow ? window.location.hash : '';
  return { ...parseHash(hash), key: hash };
}

function notify() {
  const next = read();
  if (next.key === snapshot.key) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

if (hasWindow) {
  window.addEventListener('hashchange', notify);
  window.addEventListener('popstate', notify);
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
  );
}

export function href(path: string, params?: Record<string, string | undefined>): string {
  const p = new URLSearchParams(Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]);
  const q = p.toString();
  return `#${path}${q ? `?${q}` : ''}`;
}

/** Goes to a page. In-app moves are marked so Back knows it can step back. */
export function go(path: string, params?: Record<string, string | undefined>, opts: { replace?: boolean } = {}) {
  const url = href(path, params);
  if (opts.replace) history.replaceState({ inApp: !!history.state?.inApp }, '', url);
  else history.pushState({ inApp: true }, '', url);
  notify();
  window.scrollTo(0, 0);
}

/** Steps back inside the app, or to the wardrobe when the page was opened directly. */
export function back(fallback = HOME_PATH) {
  if (history.state?.inApp) history.back();
  else go(fallback, undefined, { replace: true });
}
