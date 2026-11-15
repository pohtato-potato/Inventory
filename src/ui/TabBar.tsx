import { go } from '../router';
import { IconPlus } from './icons';

/**
 * Build 1 tabs: Wardrobe · + · Things. Wishes and Home arrive in Build 2 (spec 6.10 says they are
 * absent until then); add them to TABS when they exist.
 */
export const TABS: { path: string; label: string }[] = [
  { path: '/wardrobe', label: 'Wardrobe' },
  { path: '/add', label: 'Add a piece' },
  { path: '/things', label: 'Things' },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Tabs">
      {TABS.map((t) =>
        t.path === '/add' ? (
          <button key={t.path} type="button" className="nav-plus" aria-label={t.label} onClick={() => go('/add')}>
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
