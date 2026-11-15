import { logWear, removeOutfit, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfit, useTrees, useWears } from '../db/hooks';
import { dayText, plural } from '../domain/format';
import { dayKey, dayStart, outfitCount, wearIsOutfit } from '../domain/wearlog';
import { back, go, useRoute } from '../router';
import { askConfirm } from '../ui/Ask';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { OutfitStage, piecesText } from './Outfits';
import { pieceColour, SubTop } from './shared';

/** One saved outfit: the stage, its pieces, dress codes, times worn; wear it today, change it, or remove it. */
export function OutfitPage() {
  const { params } = useRoute();
  const outfit = useOutfit(params.get('id'));
  const trees = useTrees();
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const wears = useWears();
  if (outfit === undefined || !trees || !all || !thumbs || !wears) return <main className="screen" aria-busy="true" />;
  if (!outfit) {
    return (
      <main className="screen">
        <SubTop title="Outfit" />
        <p style={{ padding: '14px 18px' }}>This outfit was removed.</p>
      </main>
    );
  }
  const n = outfitCount(outfit, wears);
  const last = wears.filter((w) => wearIsOutfit(w, outfit)).at(-1);
  const pieces = outfit.itemIds.map((id) => all.find((i) => i.id === id)).filter((i) => !!i);
  const title = outfit.name ?? 'Outfit';

  return (
    <main className="screen">
      <SubTop title={title} />
      <div className="outfit-hero">
        <OutfitStage ids={outfit.itemIds} items={all} trees={trees} thumbs={thumbs} height={380} label={`${title}: ${piecesText(outfit.itemIds, all)}`} />
      </div>
      <div style={{ padding: '14px 18px 0', display: 'grid', gap: 4 }}>
        <p><b>Worn {plural(n, 'time')}</b>{last ? <span className="m"> · last {dayText(dayStart(last.day))}</span> : null}</p>
        {outfit.dressCodes.length > 0 && <p className="m">{outfit.dressCodes.join(' · ')}</p>}
      </div>
      <div className="piece-actions">
        <button type="button" className="acc" style={{ flex: '1 1 100%' }} onClick={async () => {
          await logWear(dayKey(Date.now()), outfit.itemIds, outfit.id);
          showToast(`Logged ${title.toLowerCase() === 'outfit' ? 'this outfit' : title} for today`, () => void undoLast());
        }}>Wore this today</button>
        <button type="button" className="ghost" onClick={() => go('/outfits', { edit: outfit.id })}>Change</button>
        <button type="button" className="ghost" onClick={async () => {
          if (!(await askConfirm(`Remove ${outfit.name ?? 'this outfit'}? The days you wore it stay logged.`, 'Remove'))) return;
          await removeOutfit(outfit.id);
          showToast('Removed 1 outfit', () => void undoLast());
          back();
        }}>Remove</button>
      </div>
      <h2 className="caps m section-cap">Its pieces</h2>
      <div className="grid">
        {pieces.map((i, k) => {
          const t = thumbs.get(i.id);
          return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={k} onPress={() => go('/piece', { id: i.id })} />;
        })}
      </div>
    </main>
  );
}
