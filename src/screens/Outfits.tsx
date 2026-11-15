import { useMemo, useState } from 'react';
import { saveOutfit, setSetting, undoLast, updateOutfit } from '../db/actions';
import { useAllItems, useMainPhotos, useOutfit, useOutfits, useSetting, useTrees, useWears, type Thumb, type Trees } from '../db/hooks';
import { DRESS_CODES, laneOf, layout, lightPiece, pairedFirst, pairScore, placeIn, regulars } from '../domain/outfit';
import { isUnsorted } from '../domain/fields';
import type { Id, Item, Lane } from '../domain/types';
import { outfitCount, wearStats } from '../domain/wearlog';
import { plural } from '../domain/format';
import { go, useRoute } from '../router';
import { askText } from '../ui/Ask';
import { Chips } from '../ui/Chips';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { Stage } from '../ui/Stage';
import { Tile } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { pieceColour } from './shared';

/** The outfit stage for a set of piece ids: lit by its top, gone pieces greyed. */
export function OutfitStage({ ids, items, trees, thumbs, height, label, delay }: { ids: Id[]; items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; height: number; label: string; delay?: number }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const list = ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
  const aspect = new Map(list.map((i) => [i.id, thumbs.get(i.id)?.aspect ?? 1.2]));
  const placed = layout(list, trees.kinds, aspect);
  const lit = lightPiece(placed);
  const light = lit ? pieceColour(byId.get(lit)!, trees.shades) : undefined;
  return <Stage placed={placed} photos={thumbs} height={height} light={light} label={label} delay={delay} />;
}

/** "Navy tee, Blue jeans and 2 more": for screen readers and short lines. */
export function piecesText(ids: Id[], items: Item[]): string {
  const names = ids.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean) as string[];
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** The wardrobe's two halves (my call): pieces, or outfits made from them. */
export function WardrobeSwitch({ on }: { on: 'pieces' | 'outfits' }) {
  return <Seg label="Wardrobe shows" value={on} onChange={(v) => go(v === 'pieces' ? '/wardrobe' : '/outfits', undefined, { replace: true })} options={[{ value: 'pieces', label: 'Pieces' }, { value: 'outfits', label: 'Outfits' }]} />;
}

const GROUPS: { value: 'tops' | 'bottoms' | 'shoes' | 'acc'; label: string; lanes: Lane[] }[] = [
  { value: 'tops', label: 'Tops', lanes: ['top', 'neck'] },
  { value: 'bottoms', label: 'Bottoms', lanes: ['bottom'] },
  { value: 'shoes', label: 'Shoes', lanes: ['feet'] },
  { value: 'acc', label: 'Accessories', lanes: ['head', 'waist', 'wrist', 'hand', 'carry'] },
];

/** Outfits: the regulars, then building one from pieces. `?edit=<id>` changes a saved outfit. */
export function Outfits() {
  const { params } = useRoute();
  const editId = params.get('edit');
  const editing = useOutfit(editId);
  const trees = useTrees();
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const outfits = useOutfits();
  const wears = useWears();
  const [chosen, setChosen] = useState<Id[] | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]['value'] | 'all'>('all');
  const [saving, setSaving] = useState(false);
  const together = useMemo(() => wearStats(wears ?? []).together, [wears]);

  if (!trees || !all || !thumbs || !outfits || !wears || editing === undefined) return <main className="screen" aria-busy="true" />;
  const picked = chosen ?? editing?.itemIds ?? [];
  const clothing = new Set(trees.kinds.filter((k) => k.clothing).map((k) => k.id));
  const owned = all.filter((i) => i.status === 'owned' && i.deletedAt === undefined && clothing.has(i.kindId) && !isUnsorted(i.kindId));
  const lanes = GROUPS.find((g) => g.value === group)?.lanes;
  const shown = pairedFirst(lanes ? owned.filter((i) => lanes.includes(laneOf(i.kindId, trees.kinds).lane)) : owned, picked, together);
  const regs = regulars(outfits, wears);
  const building = picked.length > 0;

  return (
    <main className="screen outfits">
      <div className="top">
        <h1 className="caps">{editing ? 'Change outfit' : 'Outfits'}</h1>
      </div>
      {!editing && <WardrobeSwitch on="outfits" />}

      {owned.length === 0 ? (
        <p style={{ padding: '20px 18px' }}>Add a few pieces first, then put them together here.</p>
      ) : (
        <>
          {building && (
            <div className="builder" aria-label="The outfit you are putting together">
              <OutfitStage ids={picked} items={all} trees={trees} thumbs={thumbs} height={220} label={`Your outfit: ${piecesText(picked, all)}`} />
              <div className="builder-side">
                <p className="m">{plural(picked.length, 'piece')}</p>
                <button type="button" className="acc" onClick={() => setSaving(true)}>{editing ? 'Save changes' : 'Save'}</button>
                <button type="button" className="ghost" onClick={() => setChosen([])}>Start again</button>
              </div>
            </div>
          )}

          {!building && regs.length > 0 && (
            <>
              <h2 className="caps m section-cap">Your regulars</h2>
              <div className="regulars">
                {regs.map((o, i) => (
                  <button key={o.id} type="button" className="regular" onClick={() => go('/outfit', { id: o.id })}>
                    <OutfitStage ids={o.itemIds} items={all} trees={trees} thumbs={thumbs} height={240} label={o.name ?? piecesText(o.itemIds, all)} delay={i * 100} />
                    <span className="sm m">{o.name ? `${o.name} · ` : ''}Worn {plural(outfitCount(o, wears), 'time')}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <h2 className="caps m section-cap">{building ? 'Add pieces' : regs.length ? 'Or start from a piece' : 'Start from a piece'}</h2>
          <div style={{ padding: '0 14px 10px' }}>
            <Chips scroll label="Show" value={group} onChange={(v) => setGroup(v === group ? 'all' : v)} options={[{ value: 'all' as const, label: 'All' }, ...GROUPS.map((g) => ({ value: g.value, label: g.label }))]} />
          </div>
          <div className="grid">
            {shown.map((i, n) => {
              const t = thumbs.get(i.id);
              const pairs = picked.length > 0 && !picked.includes(i.id) && pairScore(i, picked, together) > 0;
              return (
                <div key={i.id} className="tile-cell">
                  <Tile item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={n} selected={picked.includes(i.id)}
                    onPress={() => setChosen(placeIn(picked, i, all, trees.kinds))} />
                  {pairs && <p className="sm pairs-well">pairs well</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
      <SaveSheet open={saving} onClose={() => setSaving(false)} initial={editing ?? undefined} onSave={async (name, codes) => {
        if (editing) {
          await updateOutfit(editing.id, { itemIds: picked, name: name || undefined, dressCodes: codes });
          showToast('Outfit changed', () => void undoLast());
          go('/outfit', { id: editing.id }, { replace: true });
        } else {
          const id = await saveOutfit(picked, name, codes);
          showToast('Outfit saved', () => void undoLast());
          setChosen([]);
          go('/outfit', { id });
        }
        setSaving(false);
      }} />
    </main>
  );
}

/** Name (optional) and dress codes for an outfit. */
function SaveSheet({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial?: { name?: string; dressCodes: string[] }; onSave: (name: string, codes: string[]) => void }) {
  const own = useSetting<string[]>('dressCodes', []);
  const [name, setName] = useState(initial?.name ?? '');
  const [codes, setCodes] = useState<string[]>(initial?.dressCodes ?? []);
  const all = [...DRESS_CODES, ...own.filter((c) => !DRESS_CODES.includes(c))];
  return (
    <Sheet open={open} onClose={onClose} label="Save the outfit">
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="name" style={{ fontSize: 22 }}>Save the outfit</p>
        <div className="q">
          <label className="ql" htmlFor="o-name">Name, if you like</label>
          <input id="o-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="For example: Office" />
        </div>
        <div className="q">
          <p className="ql">Dress codes</p>
          <Chips label="Dress codes" value={codes} onChange={(v) => setCodes(codes.includes(v) ? codes.filter((c) => c !== v) : [...codes, v])} options={all.map((c) => ({ value: c, label: c }))} />
          <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={async () => {
            const c = (await askText('A dress code of your own', 'For example: Wedding'))?.trim();
            if (c && !all.includes(c)) { await setSetting('dressCodes', [...own, c]); setCodes([...codes, c]); }
          }}>Add your own</button>
        </div>
        <button type="button" className="acc" onClick={() => onSave(name.trim(), codes)}>Save</button>
      </div>
    </Sheet>
  );
}
