import { useEffect, useRef, useState } from 'react';
import { addWish, NO_SPACE, savePhotos, undoLast, updateWish, type WishDraft } from '../db/actions';
import { useTrees, useWish, useWishPhotos } from '../db/hooks';
import { parseRoughPrice } from '../domain/estimate';
import { isUnsorted } from '../domain/fields';
import type { Id, Tier, Wish } from '../domain/types';
import { dayKey } from '../domain/wearlog';
import { safeLink, TIERS } from '../domain/wish';
import { bitmapFromFile } from '../photo/camera';
import { shrinkToWebp } from '../photo/cutout';
import { back, go, useRoute } from '../router';
import { Chip, Chips } from '../ui/Chips';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { Piece, Window } from '../ui/Window';
import { kindName, SubTop, type Trees } from './shared';

type Shot = { blob: Blob; w: number; h: number };
/** A photo picked from the Wishes "+" sheet, handed to the form that opens next. */
let pending: Shot | null = null;
export function setPendingWishPhoto(s: Shot) {
  pending = s;
}

type WaitMode = 'none' | 'date' | 'note';
interface Draft {
  name: string;
  tier: Tier;
  kindId?: Id;
  shadeId?: Id;
  shop: string;
  url: string;
  price: string;
  forWhom: string;
  wait: WaitMode;
  waitDate: string;
  waitNote: string;
  note: string;
}

function toDraft(w: Wish | null, p: URLSearchParams): Draft {
  if (w) {
    return {
      name: w.name, tier: w.tier, kindId: w.kindId, shadeId: w.shadeId, shop: w.shop ?? '', url: w.url ?? '',
      price: w.price ? `${w.price.estimate ? 'about ' : ''}${w.price.value}` : '', forWhom: w.forWhom ?? '',
      wait: w.waitUntil?.date ? 'date' : w.waitUntil?.note ? 'note' : 'none', waitDate: w.waitUntil?.date ?? '', waitNote: w.waitUntil?.note ?? '',
      note: w.note ?? '',
    };
  }
  return {
    name: p.get('name') ?? '', tier: 'soon', shop: p.get('shop') ?? '', url: p.get('url') ?? '', price: '', forWhom: '',
    wait: 'none', waitDate: '', waitNote: '', note: '',
  };
}

/** A new wish (typed, shared in from a shop app, or from a photo), or changing one (?id=). */
export function WishForm() {
  const { params } = useRoute();
  const id = params.get('id');
  const existing = useWish(id);
  const trees = useTrees();
  if (existing === undefined || !trees) return <main className="screen" aria-busy="true" />;
  return <Form key={id ?? 'new'} wish={existing} params={params} trees={trees} />;
}

function Form({ wish, params, trees }: { wish: Wish | null; params: URLSearchParams; trees: Trees }) {
  const [d, setD] = useState<Draft>(() => toDraft(wish, params));
  const [shot, setShot] = useState<Shot | null>(() => { const s = pending; pending = null; return s; });
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const thumbs = useWishPhotos();
  const set = (p: Partial<Draft>) => setD((o) => ({ ...o, ...p }));
  const source = (params.get('source') as Wish['source'] | null) ?? 'hand';

  useEffect(() => {
    if (!shot) { setShotUrl(null); return; }
    const u = URL.createObjectURL(shot.blob);
    setShotUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [shot]);

  const price = d.price.trim() ? parseRoughPrice(d.price) : null;
  const priceBad = !!d.price.trim() && !price;
  const link = safeLink(d.url);
  const linkBad = !!d.url.trim() && !link;
  const today = dayKey(Date.now());
  const shade = trees.shades.find((s) => s.id === d.shadeId);
  const photoUrl = shotUrl ?? (wish ? thumbs?.get(wish.id)?.url : undefined);

  const pick = async (f: File) => {
    try {
      const bmp = await bitmapFromFile(f);
      setShot(await shrinkToWebp(bmp));
      bmp.close();
    } catch {
      showToast("Couldn't open that photo");
    }
  };

  const save = async () => {
    const name = d.name.trim();
    if (!name || priceBad || linkBad || saving) return;
    const waitUntil = d.wait === 'date' && d.waitDate ? { date: d.waitDate } : d.wait === 'note' && d.waitNote.trim() ? { note: d.waitNote.trim() } : undefined;
    const fields: WishDraft = {
      name, tier: d.tier, kindId: d.kindId, shadeId: d.shadeId, shop: d.shop.trim() || undefined, url: link,
      price: price ?? undefined, forWhom: d.forWhom.trim() || undefined, waitUntil, note: d.note.trim() || undefined,
    };
    setSaving(true);
    try {
      if (wish) {
        await updateWish(wish.id, fields);
        if (shot) await savePhotos(wish.id, [{ role: 'wish', ...shot, replace: true }]);
        showToast(`Saved ${name}`, () => void undoLast());
        back('/wishes');
      } else {
        await addWish({ ...fields, source }, shot ?? undefined);
        showToast(`Added ${name} to your wishes`, () => void undoLast());
        go('/wishes', d.tier === 'now' ? {} : { tier: d.tier }, { replace: true });
      }
    } catch (e) {
      showToast(e instanceof Error && e.message === NO_SPACE ? NO_SPACE : "Couldn't save the wish");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="screen details" style={{ paddingBottom: 'calc(96px + var(--safe-b))' }}>
      <SubTop title={wish ? 'Change the wish' : 'New wish'} />
      <Window className="wish-hero form" colour={shade?.hex} lit={!!photoUrl}>
        {photoUrl ? <Piece src={photoUrl} cut={false} alt={d.name || 'The wish'} /> : <span className="wish-word big" aria-hidden="true">{d.name || 'No photo'}</span>}
      </Window>
      <div className="fix-entry">
        <button type="button" className="ghost" onClick={() => file.current?.click()}>{photoUrl ? 'Change the photo' : 'Add a photo'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
      </div>
      <div className="details-body">
        <div className="q">
          <label className="ql" htmlFor="w-name">Name</label>
          <input id="w-name" className="field" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Linen shirt" />
        </div>
        <div className="q">
          <p className="ql">How soon?</p>
          <Seg label="How soon" value={d.tier} onChange={(t) => set({ tier: t })} options={TIERS} />
        </div>
        <div className="q">
          <p className="ql">Kind and colour, if you like</p>
          <div className="chips">
            {d.kindId && <Chip on onClick={() => setChoosing(true)}>{kindName(d.kindId, trees.kinds)}</Chip>}
            {shade && <Chip on dot={shade.hex} onClick={() => setChoosing(true)}>{shade.name}</Chip>}
            <Chip onClick={() => setChoosing(true)}>{d.kindId || shade ? 'Change' : 'Choose'}</Chip>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="q" style={{ flex: 1 }}><label className="ql" htmlFor="w-shop">Shop</label><input id="w-shop" className="field" value={d.shop} onChange={(e) => set({ shop: e.target.value })} /></div>
          <div className="q" style={{ flex: 1 }}><label className="ql" htmlFor="w-price">Price</label><input id="w-price" className="field" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="₹1,999" aria-invalid={priceBad} /></div>
        </div>
        {priceBad && <p className="warn-text">Try an amount, like "₹1,999" or "about 2000".</p>}
        <div className="q">
          <label className="ql" htmlFor="w-url">Link</label>
          <input id="w-url" className="field" type="url" inputMode="url" value={d.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" aria-invalid={linkBad} />
          {linkBad && <p className="warn-text">That doesn't look like a web link.</p>}
        </div>
        <div className="q">
          <label className="ql" htmlFor="w-for">Is it for someone? Their name</label>
          <input id="w-for" className="field" value={d.forWhom} onChange={(e) => set({ forWhom: e.target.value })} placeholder="Leave empty if it's for you" />
        </div>
        <div className="q">
          <p className="ql">Wait to buy until</p>
          <Seg label="Wait to buy until" value={d.wait} onChange={(v) => set({ wait: v })} options={[{ value: 'none', label: 'No wait' }, { value: 'date', label: 'A date' }, { value: 'note', label: 'Something' }]} />
          {d.wait === 'date' && <input className="field" type="date" min={today} value={d.waitDate} onChange={(e) => set({ waitDate: e.target.value })} aria-label="Wait until this date" />}
          {d.wait === 'note' && <input className="field" value={d.waitNote} onChange={(e) => set({ waitNote: e.target.value })} placeholder="When my waist is under 32" aria-label="Wait until" />}
        </div>
        <div className="q">
          <label className="ql" htmlFor="w-note">Note</label>
          <input id="w-note" className="field" value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </div>
      </div>
      <div className="bottom-bar">
        <button type="button" className="acc" style={{ flex: 1 }} disabled={!d.name.trim() || priceBad || linkBad || saving} onClick={() => void save()}>Save</button>
      </div>
      <KindShadeSheet open={choosing} onClose={() => setChoosing(false)} trees={trees} d={d} set={set} />
    </main>
  );
}

function KindShadeSheet({ open, onClose, trees, d, set }: { open: boolean; onClose: () => void; trees: Trees; d: Draft; set: (p: Partial<Draft>) => void }) {
  const [clothing, setClothing] = useState(() => trees.kinds.find((k) => k.id === d.kindId)?.clothing ?? true);
  const [fam, setFam] = useState<Id | undefined>(() => trees.shades.find((s) => s.id === d.shadeId)?.familyId ?? undefined);
  const kinds = trees.kinds.filter((k) => k.clothing === clothing && !isUnsorted(k.id));
  const families = trees.shades.filter((s) => !s.familyId);
  return (
    <Sheet open={open} onClose={onClose} label="Kind and colour">
      <div style={{ display: 'grid', gap: 14 }}>
        <Seg label="Clothing or things" value={clothing ? 'c' : 't'} onChange={(v) => setClothing(v === 'c')} options={[{ value: 'c', label: 'Clothing' }, { value: 't', label: 'Things' }]} />
        <div className="q">
          <p className="ql">Kind</p>
          <Chips label="Kind" value={d.kindId} onChange={(v) => set({ kindId: d.kindId === v ? undefined : v })} options={kinds.map((k) => ({ value: k.id, label: k.name }))} />
        </div>
        <div className="q">
          <p className="ql">Colour family</p>
          <Chips label="Colour family" value={fam} onChange={(v) => setFam(v)} options={families.map((f) => ({ value: f.id, label: f.name, dot: f.hex }))} />
        </div>
        {fam && (
          <div className="q">
            <p className="ql">Shade</p>
            <Chips label="Shade" value={d.shadeId} onChange={(v) => set({ shadeId: d.shadeId === v ? undefined : v })} options={trees.shades.filter((s) => s.familyId === fam).map((s) => ({ value: s.id, label: s.name, dot: s.hex }))} />
          </div>
        )}
        {(d.kindId || d.shadeId) && <button type="button" className="ghost" onClick={() => set({ kindId: undefined, shadeId: undefined })}>Clear kind and colour</button>}
        <button type="button" className="acc" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
