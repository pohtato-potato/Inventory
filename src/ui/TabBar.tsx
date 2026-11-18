import { useEffect, useState } from 'react';
import { go, useRoute } from '../router';
import { IconPlus } from './icons';
import { AddSheet } from '../screens/AddSheet';

/** Home · Everything · + · Places · Wishes. The + opens the four ways to add; on Wishes it adds a wish. */
export const TABS: { path: string; label: string }[] = [
  { path: '/home', label: 'Home' },
  { path: '/everything', label: 'Everything' },
  { path: '/add', label: 'Add a piece' },
  { path: '/places', label: 'Places' },
  { path: '/wishes', label: 'Wishes' },
];

export function TabBar({ current }: { current: string }) {
  const wishes = current === '/wishes';
  const [adding, setAdding] = useState(false);
  // The sheet belongs to the screen it was opened on: going anywhere closes it.
  const { path, params } = useRoute();
  const where = `${path}?${params.toString()}`;
  useEffect(() => setAdding(false), [where]);
  return (
    <>
      <nav className="nav" aria-label="Tabs">
        {TABS.map((t) =>
          t.path === '/add' ? (
            <button key={t.path} type="button" className="nav-plus" aria-label={wishes ? 'Add a wish' : t.label} onClick={() => (wishes ? go('/wishes', { add: '1' }, { replace: true }) : setAdding(true))}>
              <span className="plus"><IconPlus size={26} /></span>
            </button>
          ) : (
            <button key={t.path} type="button" className={`nav-tab${current === t.path ? ' on' : ''}`} aria-current={current === t.path ? 'page' : undefined} onClick={() => go(t.path, undefined, { replace: true })}>
              {t.label}
            </button>
          ),
        )}
      </nav>
      <AddSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
