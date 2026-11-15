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
import { Search } from './screens/Search';
import { Piece } from './screens/Piece';
import { Camera } from './screens/Camera';
import { Details } from './screens/Details';
import { Settings } from './screens/Settings';
import { Sizes } from './screens/Sizes';
import { Fix } from './screens/Fix';
import { Outfits } from './screens/Outfits';
import { OutfitPage } from './screens/OutfitPage';
import { WearLog } from './screens/WearLog';
import { WishPage, Wishes } from './screens/Wishes';
import { WishForm } from './screens/WishForm';
import { Home } from './screens/Home';
import { OwnThis } from './screens/OwnThis';
import { Numbers } from './screens/Numbers';
import { startConveyor } from './photo/conveyor';

const SCREENS: Record<string, React.ComponentType> = {
  '/wardrobe': Wardrobe,
  '/things': Things,
  '/spot': SpotPage,
  '/search': Search,
  '/piece': Piece,
  '/add': Camera,
  '/details': Details,
  '/sizes': Sizes,
  '/settings': Settings,
  '/fix': Fix,
  '/outfits': Outfits,
  '/outfit': OutfitPage,
  '/wear': WearLog,
  '/wishes': Wishes,
  '/wish': WishPage,
  '/wish-new': WishForm,
  '/home': Home,
  '/own': OwnThis,
  '/numbers': Numbers,
};

/** Screens that show the tab bar. The rest (a piece, the camera, details) use the whole screen. */
const WITH_TABS = new Set(['/wardrobe', '/things', '/spot', '/search', '/outfits', '/wishes', '/home']);

export function App() {
  const { path } = useRoute();
  useEffect(() => {
    void seedIfEmpty().then(() => sweepTrash(Date.now())).then(() => startConveyor());
  }, []);
  const Screen = SCREENS[path] ?? Wardrobe;
  const tab = path === '/outfits' ? '/wardrobe' : ['/things', '/wardrobe', '/wishes', '/home'].includes(path) ? path : '';
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

