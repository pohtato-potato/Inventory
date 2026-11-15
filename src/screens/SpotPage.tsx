import { removePlace, rename, undoLast } from '../db/actions';
import { useItems, useMainPhotos, useTrees } from '../db/hooks';
import { back, useRoute } from '../router';
import { askConfirm, askText } from '../ui/Ask';
import { showToast } from '../ui/Toast';
import { Window } from '../ui/Window';
import { Pieces } from './Browse';
import { SubTop } from './shared';
import { useSelection } from './Selection';

/** One spot and everything in it. id "none" lists pieces with no spot yet. */
export function SpotPage() {
  const id = useRoute().params.get('id') ?? 'none';
  const trees = useTrees();
  const thumbs = useMainPhotos();
  const items = useItems();
  const sel = useSelection();
  if (!trees || !thumbs || !items) return <main className="screen" aria-busy="true" />;
  const place = trees.places.find((p) => p.id === id);
  const known = new Set(trees.places.map((p) => p.id));
  const here = items.filter((i) => i.status === 'owned' && (id === 'none' ? !i.spotId || !known.has(i.spotId) : i.spotId === id));
  const home = place?.homeId ? trees.places.find((p) => p.id === place.homeId) : undefined;
  const title = id === 'none' ? 'No spot yet' : place?.name ?? 'Spot';
  const editable = place?.role === 'spot' || place?.role === 'home';
  return (
    <main className="screen">
      <SubTop title={title} right={editable && (
        <>
          <button type="button" className="link" onClick={async () => { const n = await askText('Rename this spot', '', place!.name); if (n) await rename('places', place!.id, n); }}>Rename</button>
          <button type="button" className="link" style={{ color: 'var(--m)' }} onClick={async () => {
            if (!(await askConfirm(`Remove ${place!.name}? Its ${here.length} pieces move to "No spot".`, 'Remove'))) return;
            await removePlace(place!.id);
            back();
            showToast(`Removed ${place!.name}`, () => void undoLast());
          }}>Remove</button>
        </>
      )} />
      {home && <p className="m" style={{ padding: '0 18px' }}>In {home.name}</p>}
      {here.length ? (
        <div style={{ paddingTop: 12 }}><Pieces items={here} trees={trees} thumbs={thumbs} sel={sel} /></div>
      ) : (
        <Window className="empty-win" colour="#4A4C55">
          <p className="name" style={{ fontSize: 22 }}>Nothing here yet</p>
          <p className="m">Move pieces here from a piece's page, or hold a piece in the wardrobe to move several.</p>
        </Window>
      )}
    </main>
  );
}
