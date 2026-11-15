import { go } from '../router';
import { IconPlus } from './icons';

/** Wardrobe · Things · + · Wishes · Home. On the Wishes tab the + adds a wish instead of a piece. */
export const TABS: { path: string; label: string }[] = [
  { path: '/wardrobe', label: 'Wardrobe' },
  { path: '/things', label: 'Things' },
  { path: '/add', label: 'Add a piece' },
  { path: '/wishes', label: 'Wishes' },
  { path: '/home', label: 'Home' },
];

export function TabBar({ current }: { current: string }) {
  const wishes = current === '/wishes';
  return (
    <nav className="nav" aria-label="Tabs">
      {TABS.map((t) =>
        t.path === '/add' ? (
          <button key={t.path} type="button" className="nav-plus" aria-label={wishes ? 'Add a wish' : t.label} onClick={() => (wishes ? go('/wishes', { add: '1' }, { replace: true }) : go('/add'))}>
            <span className="plus"><IconPlus size={26} /></span>
          </button>
        ) : (
          <button key={t.path} type="button" className={`nav-tab${current === t.path ? ' on' : ''}`} aria-current={current === t.path ? 'page' : undefined} onClick={() => go(t.path, undefined, { replace: true })}>
            {t.label}
          </button>
        ),
      )}
    </nav>
  );
}
