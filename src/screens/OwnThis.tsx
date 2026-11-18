import { useEffect, useState } from 'react';
import { addWish, getSetting, setSetting, undoLast } from '../db/actions';
import { useItems, useMainPhotos, useSetting, useTrees, useWearLog, useWishes } from '../db/hooks';
import { isUnsorted } from '../domain/fields';
import { gaps, likeWords, ownedLike, ownLine, STARTER_STAPLES, type Staple } from '../domain/gaps';
import type { Id, Item, Wish } from '../domain/types';
import { go, useRoute } from '../router';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Seg } from '../ui/Seg';
import { Cut, Swatch } from '../ui/Swatch';
import { showToast } from '../ui/Toast';
import { pieceColour, SubTop, type Trees } from './shared';

/** "Do I already own this?": pick a kind and a colour family; what you own like it shows at once. */
export function OwnThis() {
  const { params } = useRoute();
  const trees = useTrees();
  const items = useItems();
  const thumbs = useMainPhotos();
  const wear = useWearLog();
  const wishes = useWishes();
  const kindId = params.get('kind') ?? undefined;
  const shadeId = params.get('shade') ?? undefined;
  const [clothing, setClothing] = useState(() => (kindId ? trees?.kinds.find((k) => k.id === kindId)?.clothing : undefined) ?? true);
  const ready = !!(trees && items && thumbs && wear);
  // A prefilled kind or colour may sit off the end of its row: bring it into view once.
  useEffect(() => {
    if (ready) document.querySelectorAll('.own .chip.on').forEach((c) => c.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }, [ready]);
  if (!trees || !items || !thumbs || !wear) return <main className="screen" aria-busy="true" />;

  const set = (p: { kind?: Id; shade?: Id }) => go('/own', { kind: kindId, shade: shadeId, ...p }, { replace: true });
  const kinds = trees.kinds.filter((k) => k.clothing === clothing && !isUnsorted(k.id));
  const families = trees.shades.filter((s) => !s.familyId);
  // A shade from a wish is widened to its family: "a blue tee", not only that exact blue.
  const family = trees.shades.find((s) => s.id === shadeId)?.familyId ?? shadeId;
  const like = ownedLike(items, { kindId, shadeId: family }, trees);
  const asked = !!(kindId || family);
  const kindName_ = trees.kinds.find((k) => k.id === kindId)?.name;
  const familyName = trees.shades.find((s) => s.id === family)?.name;

  return (
    <main className="screen own">
      <SubTop title="Do I already own this?" />
      <div className="details-body">
        <Seg label="Clothing or things" value={clothing ? 'c' : 't'} onChange={(v) => { setClothing(v === 'c'); set({ kind: undefined }); }} options={[{ value: 'c', label: 'Clothing' }, { value: 't', label: 'Things' }]} />
        <div className="q">
          <p className="ql">What kind?</p>
          <Chips scroll label="Kind" value={kindId} onChange={(v) => set({ kind: v === kindId ? undefined : v })} options={kinds.map((k) => ({ value: k.id, label: k.name }))} />
        </div>
        <div className="q">
          <p className="ql">What colour?</p>
          <Chips scroll label="Colour family" value={family ?? undefined} onChange={(v) => set({ shade: v === family ? undefined : v })} options={families.map((f) => ({ value: f.id, label: f.name, dot: f.hex }))} />
        </div>
      </div>
      {asked && (
        <Swatch as="section" className="own-answer" colour={like[0] ? pieceColour(like[0], trees) : undefined} aria-live="polite">
          <div className="own-count">
            <Numeral value={like.length} className="own-num" />
            <p className="caps">{like.length ? likeWords(kindName_, familyName, like.length) : 'Nothing like this yet'}</p>
          </div>
          {like.length > 0 && (
            <div className="own-pieces">
              {like.map((i) => (
                <button key={i.id} type="button" className="own-piece" onClick={() => go('/piece', { id: i.id })} aria-label={`${i.name}, ${ownLine(i, wear.count.get(i.id) ?? 0)}`}>
                  <span className="own-pc"><Cut src={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut ?? true} /></span>
                  <span className="lbl" aria-hidden="true">{i.name}</span>
                  <span className="sm m" aria-hidden="true">{ownLine(i, wear.count.get(i.id) ?? 0)}</span>
                </button>
              ))}
            </div>
          )}
        </Swatch>
      )}
      {wishes && <GapHints items={items} wishes={wishes} trees={trees} />}
    </main>
  );
}

/** The staples list (editable in Settings) and the ones the owner said "not for me" to. */
export function useStaples(): { staples: Staple[]; dismissed: string[] } {
  return { staples: useSetting<Staple[]>('staples', STARTER_STAPLES), dismissed: useSetting<string[]>('gaps.dismissed', []) };
}

/** "You have none of these": staples the owner owns none of, at the foot of the Wishes screen. */
export function GapHints({ items, wishes, trees }: { items: Item[]; wishes: Wish[]; trees: Trees }) {
  const { staples, dismissed } = useStaples();
  const clothes = new Set(trees.kinds.filter((k) => k.clothing).map((k) => k.id));
  // Hints wait until the wardrobe has something in it: an empty wardrobe lacks everything.
  if (!items.some((i) => i.status === 'owned' && clothes.has(i.kindId))) return null;
  const wished = new Set(wishes.filter((w) => w.status === 'open').map((w) => w.name.toLocaleLowerCase()));
  const list = gaps(items, staples, dismissed, trees).filter((s) => !wished.has(s.label.toLocaleLowerCase()));
  if (!list.length) return null;
  const notForMe = async (s: Staple) => {
    const before = await getSetting<string[]>('gaps.dismissed', []);
    await setSetting('gaps.dismissed', [...before, s.id]);
    showToast(`${s.label} won't be suggested`, () => void setSetting('gaps.dismissed', before));
  };
  const add = async (s: Staple) => {
    const kindId = trees.kinds.find((k) => k.name.toLocaleLowerCase() === s.kind.toLocaleLowerCase())?.id;
    await addWish({ name: s.label, tier: 'someday', source: 'gap', ...(kindId ? { kindId } : {}) });
    showToast(`Added ${s.label} to Someday`, () => void undoLast());
  };
  return (
    <section className="gaps" aria-label="You have none of these">
      <h2 className="caps m section-cap">You have none of these</h2>
      {list.map((s) => (
        <div key={s.id} className="gap-row">
          <span className="gap-label">{s.label}</span>
          <span className="gap-acts">
            <button type="button" className="link" onClick={() => void add(s)}>Add to wishes</button>
            <button type="button" className="link" onClick={() => void notForMe(s)}>Not for me</button>
          </span>
        </div>
      ))}
    </section>
  );
}
