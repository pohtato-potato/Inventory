import { Suspense, useEffect } from 'react';
import { seedIfEmpty } from './db/seed';
import { sweepTrash } from './db/actions';
import { useRoute } from './router';
import { TabBar } from './ui/TabBar';
import { ToastHost } from './ui/Toast';
import { AskHost } from './ui/Ask';
import { Wardrobe } from './screens/Wardrobe';
import { Things } from './screens/Things';
import { SpotPage } from './screens/SpotPage';

const SCREENS: Record<string, React.ComponentType> = {
  '/wardrobe': Wardrobe,
  '/things': Things,
  '/spot': SpotPage,
};

/** Screens that show the tab bar. The rest (a piece, the camera, details) use the whole screen. */
const WITH_TABS = new Set(['/wardrobe', '/things', '/spot', '/search']);

export function App() {
  const { path } = useRoute();
  useEffect(() => {
    void seedIfEmpty().then(() => sweepTrash(Date.now()));
  }, []);
  const Screen = SCREENS[path] ?? Wardrobe;
  const tab = path === '/things' ? '/things' : path === '/wardrobe' ? '/wardrobe' : '';
  return (
    <>
      <Suspense fallback={<main className="screen" aria-busy="true" />}>
        <Screen key={path} />
      </Suspense>
      {WITH_TABS.has(path) && <TabBar current={tab} />}
      <ToastHost />
      <AskHost />
    </>
  );
}

