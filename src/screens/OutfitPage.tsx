import { useRef, useState } from 'react';
import { logWear, NO_SPACE, removeOutfit, removePhoto, savePhotos, undoLast } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfit, useSelfies, useTrees, useWears } from '../db/hooks';
import { dayText, plural } from '../domain/format';
import { dayKey, dayStart, outfitCount, wearIsOutfit } from '../domain/wearlog';
import { bitmapFromFile } from '../photo/camera';
import { shrinkToWebp } from '../photo/cutout';
import { back, go, useRoute } from '../router';
import { askConfirm } from '../ui/Ask';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { Bands } from '../ui/Stage';
import { OutfitStage, outfitShots, piecesText } from './Outfits';
import { Mini, openItem, pieceColour, SubTop } from './shared';
import { layout } from '../domain/outfit';

/** Takes a photo from the phone and keeps it as a mirror photo of `ownerId` (an outfit or a wear day). */
export async function addMirrorPhoto(ownerId: string, f: File): Promise<void> {
  try {
    const bmp = await bitmapFromFile(f);
    const shot = await shrinkToWebp(bmp);
    bmp.close();
    await savePhotos(ownerId, [{ role: 'selfie', ...shot }]);
    showToast('Mirror photo added');
  } catch (e) {
    showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't add that photo");
  }
}

/**
 * One saved outfit. With mirror photos, the newest fills the top with the pieces along its bottom edge; older ones
 * are a swipe away, and "Show the pieces" flips to the laid-out stage. Then times worn, wear it today, change or remove.
 */
export function OutfitPage() {
  const { params } = useRoute();
  const outfit = useOutfit(params.get('id'));
  const trees = useTrees();
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const wears = useWears();
  const selfies = useSelfies();
  const [pieces_, setPieces] = useState(false);
  const [at, setAt] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  if (outfit === undefined || !trees || !all || !thumbs || !wears || !selfies) return <main className="screen" aria-busy="true" />;
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
  const shots = outfitShots(outfit, wears, selfies);
  const showPhoto = shots.length > 0 && !pieces_;
  const placed = layout(pieces, trees.kinds, new Map());
  const colours = [...placed].sort((p, q) => p.y - q.y).map((p) => pieceColour(all.find((i) => i.id === p.itemId)!, trees));
  const shown = shots[Math.min(at, shots.length - 1)];

  return (
    <main className="screen outfit-page">
      <div className="outfit-bands"><Bands colours={colours} down /></div>
      <SubTop title="Outfit" />
      <div className="outfit-hero">
        {showPhoto ? (
          <div className="face-hero">
            <div className="face-track" aria-label={`${title}: mirror photos, ${shots.length}`} onScroll={(e) => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}>
              {shots.map((s, i) => (
                <div key={s.photo.id} className="face-slide">
                  <img className="face-img" src={s.url} alt={i === 0 ? `${title}, newest mirror photo` : 'An older mirror photo'} draggable={false} decoding="async" />
                </div>
              ))}
            </div>
            <div className="face-pieces">
              {pieces.map((i) => <Mini key={i.id} item={i} thumb={thumbs.get(i.id)} trees={trees} size={48} onPress={() => openItem(i.id)} />)}
            </div>
            <button type="button" className="face-flip" onClick={() => setPieces(true)}>Show the pieces</button>
            {shots.length > 1 && <p className="face-count sm" aria-live="polite">{at + 1} of {shots.length}</p>}
          </div>
        ) : (
          <div className="face-hero stage-hero">
            <OutfitStage ids={outfit.itemIds} items={all} trees={trees} thumbs={thumbs} height={380} label={`${title}: ${piecesText(outfit.itemIds, all)}`} />
            {shots.length > 0 && <button type="button" className="face-flip" onClick={() => setPieces(false)}>Show the photo</button>}
          </div>
        )}
      </div>
      <div style={{ padding: '14px 18px 0', display: 'grid', gap: 4 }}>
        <h2 className="name outfit-title">{title}</h2>
        <p className="m">{[...outfit.dressCodes, `worn ${plural(n, 'time')}`, last ? `last on ${dayText(dayStart(last.day))}` : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="li" style={{ marginTop: 12 }}>
        <span>{shots.length ? <><b>{shots.length}</b> mirror {shots.length === 1 ? 'photo' : 'photos'}</> : 'No mirror photo yet'}</span>
        <button type="button" className="link n" onClick={() => file.current?.click()}>{shots.length ? 'Add another' : 'Add one'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addMirrorPhoto(outfit.id, f); e.target.value = ''; }} />
      </div>
      {showPhoto && shown && (
        <div style={{ padding: '0 18px' }}>
          <button type="button" className="link" style={{ marginLeft: -12 }} onClick={async () => { await removePhoto(shown.photo.id); setAt(0); showToast('Removed the photo', () => void undoLast()); }}>Remove this photo</button>
        </div>
      )}
      <div className="piece-actions">
        <button type="button" className="acc" style={{ flex: '2 1 0' }} onClick={async () => {
          if (!outfit.itemIds.some((id) => all.some((i) => i.id === id && i.status === 'owned' && i.deletedAt === undefined))) {
            showToast('Every piece in this outfit is gone');
            return;
          }
          await logWear(dayKey(Date.now()), outfit.itemIds, outfit.id);
          showToast(`Logged ${title.toLowerCase() === 'outfit' ? 'this outfit' : title} for today`, () => void undoLast());
          go('/wear');
        }}>Wore this today</button>
        <button type="button" className="ghost" onClick={() => go('/outfits', { edit: outfit.id })}>Change</button>
        <button type="button" className="ghost" style={{ flex: '1 1 100%' }} onClick={async () => {
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
          return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees)} index={k} onPress={() => openItem(i.id)} />;
        })}
      </div>
    </main>
  );
}
