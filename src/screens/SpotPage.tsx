import { removePlace, rename, undoLast } from '../db/actions';
import { useItems, useMainPhotos, useTrees } from '../db/hooks';
import { shownItems } from '../domain/search';
import { back, useRoute } from '../router';
import { askConfirm, askText } from '../ui/Ask';
import { showToast } from '../ui/Toast';
import { IconPin } from '../ui/icons';
import { Pieces } from './Browse';
import { SubTop } from './shared';
import { Selection, useSelection } from './Selection';

/** One place, drawn as an open drawer with its things inside. id "none" lists things with no spot yet. */
export function SpotPage() {
  const id = useRoute().params.get('id') ?? 'none';
  const trees = useTrees();
  const thumbs = useMainPhotos();
  const items = useItems();
  const sel = useSelection();
  if (!trees || !thumbs || !items) return <main className="screen" aria-busy="true" />;
  const place = trees.places.find((p) => p.id === id);
  const known = new Set(trees.places.map((p) => p.id));
  const here = shownItems(items).filter((i) => (id === 'none' ? !i.spotId || !known.has(i.spotId) : i.spotId === id));
  const home = place?.homeId ? trees.places.find((p) => p.id === place.homeId) : undefined;
  const title = id === 'none' ? 'No spot yet' : place?.name ?? 'Spot';
  const editable = place?.role === 'spot' || place?.role === 'home';
  const n = here.reduce((s, i) => s + i.count, 0);
  return (
    <main className="screen spot" style={sel.ids.size ? { paddingBottom: 'calc(var(--sheet-h, 0px) + 24px)' } : undefined}>
      {sel.ids.size ? <Selection sel={sel} trees={trees} /> : (
        <SubTop title="" right={editable && (
          <>
            <button type="button" className="link" onClick={async () => { const nn = await askText('Rename this spot', '', place!.name); if (nn) await rename('places', place!.id, nn); }}>Rename</button>
            <button type="button" className="link m" onClick={async () => {
              if (!(await askConfirm(`Remove ${place!.name}? Its ${here.length} pieces move to "No spot".`, 'Remove'))) return;
              await removePlace(place!.id);
              back();
              showToast(`Removed ${place!.name}`, () => void undoLast());
            }}>Remove</button>
          </>
        )} />
      )}
      {!sel.ids.size && <h2 className="title spot-title">{title}</h2>}
      <p className="m spot-where"><IconPin size={16} /> {[home ? `In ${home.name}` : '', `${n} ${n === 1 ? 'thing' : 'things'}`].filter(Boolean).join(' · ')}</p>
      <div className="drawer">
        <div className="drawer-in">
          {here.length ? (
            <Pieces items={here} trees={trees} thumbs={thumbs} sel={sel} />
          ) : (
            <div className="drawer-empty">
              <p className="name" style={{ fontSize: 22 }}>Nothing here yet</p>
              <p className="m">Move things here from their page, or hold one in Everything to move several.</p>
            </div>
          )}
        </div>
        <span className="drawer-front" aria-hidden="true"><span /></span>
      </div>
      {here.length > 0 && <p className="m sm" style={{ padding: '12px 18px 0' }}>Move things here from their page, or hold one in Everything to move several.</p>}
    </main>
  );
}
