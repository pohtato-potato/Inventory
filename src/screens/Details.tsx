import { useEffect, useMemo, useState } from 'react';
import { letGo, setPairs, setSetting, updateItem, undoLast } from '../db/actions';
import { useAllItems, useItem, useItems, useMainPhotos, useOutfits, usePhoto, useSetting, useTrees, type Trees } from '../db/hooks';
import { DRESS_CODES } from '../domain/outfit';
import { parseRoughDate, parseRoughPrice } from '../domain/estimate';
import { FIELD_LABEL, fieldsFor, isUnsorted, kindChoices, nextNeedingDetails, singular, suggestName, UNSORTED } from '../domain/fields';
import { roughDateText, roughPriceText } from '../domain/format';
import type { Condition, Fit, Gone, Id, Item, StartWears, WearRange } from '../domain/types';
import { back, go, useRoute } from '../router';
import { Chip, Chips } from '../ui/Chips';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { Cut, Swatch, pageColours } from '../ui/Swatch';
import { Seg } from '../ui/Seg';
import { NoPhoto } from '../ui/kindIcons';
import { kindGroup } from '../domain/kinds';
import { takePendingReceipt } from './AddSheet';
import { IconPin } from '../ui/icons';
import { CONDITION_LABEL, FIT_LABEL } from './Piece';
import { DayPicker, kindName, pieceColour, SubTop, UncutNote } from './shared';
import { OutfitStage } from './Outfits';
import { Tile } from '../ui/Tile';
import { ReadReceipt } from './ReadReceipt';

const RANGES: { value: WearRange | 'exact'; label: string }[] = [
  { value: 'never', label: 'Never' }, { value: '1-5', label: '1–5' }, { value: '5-20', label: '5–20' },
  { value: '20-50', label: '20–50' }, { value: '50+', label: '50+' }, { value: 'exact', label: 'Exact' },
];

/**
 * Details, one piece at a time. Without an id it walks the "needs details" queue, oldest first.
 * With edit=1 it edits one piece and adds the rest of its fields.
 */
export function Details() {
  const { params } = useRoute();
  const edit = params.get('edit') === '1';
  const all = useItems();
  const queue = useMemo(() => (all ?? []).filter((i) => i.needsDetails && i.status === 'owned').sort((a, b) => a.createdAt - b.createdAt), [all]);
  const [skipped, setSkipped] = useState<Id[]>([]);
  const id = params.get('id') ?? nextNeedingDetails(queue.filter((i) => !skipped.includes(i.id)))?.id ?? null;
  const item = useItem(id);
  const trees = useTrees();

  if (!all || !trees || item === undefined) return <main className="screen" aria-busy="true" />;
  if (!item) {
    return (
      <main className="screen">
        <SubTop title="Needs details" />
        <Swatch className="empty-win wellcard" tone="page" colour="#3D7A22">
          <p className="name">{skipped.length ? 'Nothing left except the ones you skipped' : 'Every piece has its details'}</p>
          {skipped.length > 0 && <button type="button" className="ghost" onClick={() => setSkipped([])}>Go through the skipped ones</button>}
          <button type="button" className="acc" onClick={() => go('/everything', undefined, { replace: true })}>Back to Everything</button>
        </Swatch>
      </main>
    );
  }
  const pos = queue.findIndex((i) => i.id === item.id);
  const next = () => {
    if (params.get('id')) go('/details', {}, { replace: true });
  };
  return (
    <Form
      key={item.id}
      item={item}
      trees={trees}
      edit={edit}
      position={edit ? '' : pos >= 0 ? `${pos + 1} of ${queue.length}` : ''}
      onSkip={() => { setSkipped((s) => [...s, item.id]); next(); }}
      onSaved={() => (edit ? back() : next())}
    />
  );
}

interface Draft {
  name: string;
  kindId: Id;
  shadeMain?: Id;
  shadeSecond?: Id;
  wears?: WearRange | 'exact';
  exact: string;
  when: string;
  price: string;
  fit?: Fit;
  spotId?: Id;
  extra: Record<string, string>;
  size: string;
  brand: string;
  count: string;
  condition?: Condition;
  tags: string;
  fitNote: string;
  shop: string;
  currency: string;
  outfitScale: number;
  dressCodes: string[];
}

function toDraft(i: Item): Draft {
  return {
    name: i.name === 'New piece' ? '' : i.name,
    kindId: i.kindId, shadeMain: i.shadeMain, shadeSecond: i.shadeSecond,
    wears: i.startWears ? ('exact' in i.startWears ? 'exact' : i.startWears.range) : undefined,
    exact: i.startWears && 'exact' in i.startWears ? String(i.startWears.exact) : '',
    when: i.boughtOn ? roughDateText(i.boughtOn) : '',
    price: i.price ? roughPriceText(i.price, i.currency) : '',
    fit: i.fit, spotId: i.spotId, extra: { ...i.extra }, size: i.size ?? '', brand: i.brand ?? '',
    count: String(i.count), condition: i.condition, tags: i.tags.join(', '), fitNote: i.fitNote ?? '',
    shop: i.shop ?? '', currency: i.currency,
    outfitScale: i.outfitScale ?? 1, dressCodes: i.dressCodes ?? [],
  };
}

function Form({ item, trees, edit, position, onSkip, onSaved }: { item: Item; trees: Trees; edit: boolean; position: string; onSkip: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(() => toDraft(item));
  const [changing, setChanging] = useState(false);
  const [letting, setLetting] = useState(false);
  const photo = usePhoto(item.id);
  const original = usePhoto(item.id, 'original');
  const items = useItems();
  const [receipt] = useState(() => takePendingReceipt());
  const set = (p: Partial<Draft>) => setD((o) => ({ ...o, ...p }));
  // A cut-out that lands while the form is open fills the shade the owner has not picked yet.
  useEffect(() => { if (item.shadeMain && !d.shadeMain) set({ shadeMain: item.shadeMain, shadeSecond: item.shadeSecond }); }, [item.shadeMain]); // eslint-disable-line react-hooks/exhaustive-deps

  const shade = trees.shades.find((s) => s.id === d.shadeMain);
  const shade2 = trees.shades.find((s) => s.id === d.shadeSecond);
  const unsorted = isUnsorted(d.kindId);
  const clothing = trees.kinds.find((k) => k.id === d.kindId)?.clothing ?? true;
  const last = useSetting<string>(clothing ? 'add.lastKind' : 'add.lastThingKind', '');
  const kind = unsorted ? 'Piece' : kindName(d.kindId, trees.kinds);
  const fields = fieldsFor(d.kindId, trees.kinds);
  const choices = kindChoices({ items: items ?? [], kinds: trees.kinds, last: last || undefined, clothing, n: 6 });
  const when = d.when.trim() ? parseRoughDate(d.when) : null;
  const price = d.price.trim() ? parseRoughPrice(d.price) : null;
  const whenBad = !!d.when.trim() && !when;
  const priceBad = !!d.price.trim() && !price;
  const exactN = Number(d.exact);
  const exactBad = d.wears === 'exact' && (!d.exact.trim() || !Number.isInteger(exactN) || exactN < 0);
  const spots = trees.places.filter((p) => p.role !== 'home');
  const homeOf = (id?: Id) => trees.places.find((p) => p.id === trees.places.find((s) => s.id === id)?.homeId)?.name;

  const save = async () => {
    if (whenBad || priceBad || exactBad || unsorted) return;
    const startWears: StartWears | undefined = d.wears === 'exact' ? { exact: exactN } : d.wears ? { range: d.wears } : undefined;
    const name = d.name.trim() || suggestName(shade?.name, kind);
    const patch: Partial<Item> = {
      name, kindId: d.kindId, shadeMain: d.shadeMain, shadeSecond: d.shadeSecond, startWears,
      boughtOn: when ?? undefined, price: price ?? undefined, fit: d.fit, spotId: d.spotId, shop: d.shop.trim() || undefined,
      usualSpotIds: d.spotId ? [d.spotId, ...item.usualSpotIds.filter((s) => s !== d.spotId)].slice(0, 3) : item.usualSpotIds,
      size: fields.includes('size') ? d.size.trim() || undefined : item.size,
      extra: Object.fromEntries(Object.entries(d.extra).filter(([k, v]) => k !== 'size' && v.trim())),
      needsDetails: false,
    };
    if (edit) {
      Object.assign(patch, {
        brand: d.brand.trim() || undefined, count: Math.max(1, Math.round(Number(d.count)) || 1), condition: d.condition,
        tags: d.tags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
        fitNote: d.fitNote.trim() || undefined,
        currency: (d.currency.trim() || 'INR').toUpperCase(),
        outfitScale: Math.abs(d.outfitScale - 1) < 0.001 ? undefined : d.outfitScale,
        dressCodes: d.dressCodes.length ? d.dressCodes : undefined,
      });
    }
    await updateItem(item.id, patch);
    const k = trees.kinds.find((x) => x.id === d.kindId);
    await setSetting(k?.clothing ? 'add.lastKind' : 'add.lastThingKind', d.kindId);
    showToast(`Saved ${name}`, () => void undoLast());
    onSaved();
  };

  return (
    <main className={`screen details${shade ? ' on-colour' : ''}`} style={{ ...(shade ? pageColours(shade.hex) : {}), paddingBottom: `calc(${unsorted ? 130 : 96}px + var(--safe-b))` }}>
      {edit ? (
        <div className="top sub edit-top">
          <button type="button" className="link" onClick={() => back()}>Cancel</button>
          <h1 className="top-small">Edit</h1>
          <span className="top-right" />
        </div>
      ) : (
        <div className="top"><h1 className="title">Needs details</h1><span className="top-right m">{position}</span></div>
      )}
      <div className="details-win">
        {photo ? <Cut src={photo.url} cut={photo.photo.role === 'main'} alt={d.name || 'The new piece'} /> : <NoPhoto group={kindGroup(d.kindId, trees.kinds)} size={64} />}
        {item.cutout === 'pending' && <span className="sm details-wait">Cutting out…</span>}
      </div>
      <UncutNote item={item} />
      {edit && original && item.cutout !== 'uncut' && (
        <div className="fix-entry"><button type="button" className="ghost" onClick={() => go('/fix', { id: item.id })}>Fix the cut-out</button></div>
      )}
      <div className="details-body">
        <div className="q">
          <label className="ql" htmlFor="d-name">Name</label>
          <input id="d-name" className="field" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={suggestName(shade?.name, kind)} />
        </div>
        <div className="q">
          <p className="ql">What is it?</p>
          <div className="chips">
            {!unsorted && !choices.includes(d.kindId) && <Chip on>{kind}</Chip>}
            {choices.map((id) => (
              <Chip key={id} on={d.kindId === id} onClick={() => set({ kindId: id })}>
                {id === last ? `Same as last: ${singular(kindName(id, trees.kinds))}` : kindName(id, trees.kinds)}
              </Chip>
            ))}
            <Chip onClick={() => setChanging(true)}>More</Chip>
          </div>
          <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => set({ kindId: clothing ? UNSORTED.things : UNSORTED.clothing })}>{clothing ? 'It is not clothing' : 'It is clothing'}</button>
        </div>
        <div className="q">
          <p className="ql">Colour looks like</p>
          <div className="chips">
            {shade && <Chip on dot={shade.hex} onClick={() => setChanging(true)}>{shade.name}</Chip>}
            {shade2 && <Chip on dot={shade2.hex} onClick={() => setChanging(true)}>{shade2.name}</Chip>}
            {!shade && <span className="m" style={{ alignSelf: 'center' }}>{item.cutout === 'pending' ? 'Guessed once the cut-out is done' : 'Not guessed'}</span>}
            <Chip onClick={() => setChanging(true)}>Change</Chip>
          </div>
        </div>
        <div className="q">
          <p className="ql">How many times have you worn it?</p>
          <Chips label="Times worn" value={d.wears} onChange={(v) => set({ wears: d.wears === v ? undefined : v })} options={RANGES} />
          {d.wears === 'exact' && (
            <input className="field" inputMode="numeric" value={d.exact} onChange={(e) => set({ exact: e.target.value })} placeholder="How many times" aria-label="Exact number of wears" aria-invalid={exactBad} />
          )}
        </div>
        <div className="q">
          <p className="ql">When and for how much? A guess is fine.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="field" value={d.when} onChange={(e) => set({ when: e.target.value })} placeholder="About 2023" aria-label="When you bought it" aria-invalid={whenBad} />
            <DayPicker value={when && /^\d{4}-\d{2}-\d{2}$/.test(when.value) ? when.value : ''} onPick={(day) => set({ when: roughDateText({ value: day, estimate: false }) })} />
            <input className="field" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder="About ₹800" aria-label="How much it cost" aria-invalid={priceBad} inputMode="text" />
          </div>
          {(whenBad || priceBad) && <p className="warn-text">{whenBad ? 'Try a date, a month or a year, like "12 Nov 2026", "Jan 2024" or "about 2023". ' : ''}{priceBad ? 'Try an amount, like "about ₹800".' : ''}</p>}
          <ReadReceipt start={receipt} onUse={(r) => set({
            ...(r.when ? { when: r.when } : {}),
            ...(r.price ? { price: r.price } : {}),
            ...(r.name ? { name: r.name } : {}),
            ...(r.size ? { size: r.size } : {}),
            ...(r.shop ? { shop: r.shop } : {}),
          })} />
        </div>
        <div className="q">
          <p className="ql">How does it fit now?</p>
          <Seg<Fit> label="Fit" value={d.fit} onChange={(v) => set({ fit: d.fit === v ? undefined : v })} options={(['tight', 'fits', 'loose'] as Fit[]).map((f) => ({ value: f, label: FIT_LABEL[f] }))} />
        </div>
        <div className="q">
          <p className="ql">Where does it live?</p>
          {spots.length ? (
            <div className="chips">
              {spots.map((s) => (
                <Chip key={s.id} on={d.spotId === s.id} onClick={() => set({ spotId: d.spotId === s.id ? undefined : s.id })}>
                  <IconPin size={16} />{s.name}{homeOf(s.id) && trees.places.filter((p) => p.role === 'home').length > 1 ? <span className="m sm">· {homeOf(s.id)}</span> : null}
                </Chip>
              ))}
            </div>
          ) : <p className="m sm">No spots yet. Add them in Places.</p>}
        </div>
        {fields.map((f) => (
          <div className="q" key={f}>
            <label className="ql" htmlFor={`d-${f}`}>{FIELD_LABEL[f]}</label>
            <input id={`d-${f}`} className="field" value={f === 'size' ? d.size : d.extra[f] ?? ''} onChange={(e) => (f === 'size' ? set({ size: e.target.value }) : set({ extra: { ...d.extra, [f]: e.target.value } }))} />
          </div>
        ))}
        {edit && <EditMore d={d} set={set} />}
        {edit && clothing && !unsorted && <OutfitBits item={item} trees={trees} d={d} set={set} />}
        {edit && (
          <div style={{ display: 'grid', gap: 8 }}>
            <button type="button" className="ghost" onClick={() => setLetting(true)}>Let it go</button>
          </div>
        )}
      </div>
      <div className="bottom-bar">
        {unsorted && <p className="bar-why">Choose what it is to save it.</p>}
        {!edit && <button type="button" className="ghost" onClick={onSkip}>Skip</button>}
        <button type="button" className="acc" style={{ flex: 1 }} onClick={save} disabled={whenBad || priceBad || exactBad || unsorted}>{edit ? 'Save' : 'Save and next'}</button>
      </div>
      <ChangeSheet open={changing} onClose={() => setChanging(false)} trees={trees} d={d} set={set} />
      <LetGoSheet open={letting} onClose={() => setLetting(false)} count={1} onDone={async (g) => { await letGo(item.id, g); setLetting(false); go('/piece', { id: item.id }, { replace: true }); showToast(`Let go of ${item.name}`, () => void undoLast()); }} />
    </main>
  );
}

function EditMore({ d, set }: { d: Draft; set: (p: Partial<Draft>) => void }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="q" style={{ flex: 2 }}><label className="ql" htmlFor="d-brand">Brand</label><input id="d-brand" className="field" value={d.brand} onChange={(e) => set({ brand: e.target.value })} /></div>
        <div className="q" style={{ flex: 1 }}><label className="ql" htmlFor="d-count">How many</label><input id="d-count" className="field" inputMode="numeric" value={d.count} onChange={(e) => set({ count: e.target.value })} /></div>
      </div>
      <div className="q">
        <p className="ql">Condition</p>
        <Chips label="Condition" value={d.condition} onChange={(v) => set({ condition: d.condition === v ? undefined : v })} options={(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => ({ value: c, label: CONDITION_LABEL[c] }))} />
      </div>
      <div className="q"><label className="ql" htmlFor="d-fitnote">Fit note</label><input id="d-fitnote" className="field" value={d.fitNote} onChange={(e) => set({ fitNote: e.target.value })} placeholder="For example: runs small in the shoulders" /></div>
      <div className="q"><label className="ql" htmlFor="d-tags">Tags, separated by commas</label><input id="d-tags" className="field" value={d.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="gym, travel" /></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="q" style={{ flex: 2 }}><label className="ql" htmlFor="d-shop">Shop</label><input id="d-shop" className="field" value={d.shop} onChange={(e) => set({ shop: e.target.value })} /></div>
        <div className="q" style={{ flex: 1 }}><label className="ql" htmlFor="d-cur">Currency</label><input id="d-cur" className="field" value={d.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value })} /></div>
      </div>
    </>
  );
}

/** Pick the kind, the main colour and a second colour. */
function ChangeSheet({ open, onClose, trees, d, set }: { open: boolean; onClose: () => void; trees: Trees; d: Draft; set: (p: Partial<Draft>) => void }) {
  const [fam, setFam] = useState<Id | null>(null);
  const [which, setWhich] = useState<'main' | 'second'>('main');
  const clothing = trees.kinds.find((k) => k.id === d.kindId)?.clothing ?? true;
  const kinds = trees.kinds.filter((k) => k.clothing === clothing && !isUnsorted(k.id));
  const families = trees.shades.filter((s) => !s.familyId);
  const cur = which === 'main' ? d.shadeMain : d.shadeSecond;
  const famId = fam ?? trees.shades.find((s) => s.id === cur)?.familyId ?? null;
  return (
    <Sheet open={open} onClose={onClose} label="Change kind and colour">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="q">
          <p className="ql">Kind</p>
          <Chips label="Kind" value={d.kindId} onChange={(v) => set({ kindId: v })} options={kinds.map((k) => ({ value: k.id, label: k.parentId ? k.name : k.name.toUpperCase() === k.name ? k.name : k.name }))} />
          <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => set({ kindId: clothing ? UNSORTED.things : UNSORTED.clothing })}>{clothing ? 'It is not clothing' : 'It is clothing'}</button>
        </div>
        <Chips label="Which colour" value={which} onChange={setWhich} options={[{ value: 'main', label: 'Main colour' }, { value: 'second', label: 'Second colour' }]} />
        <div className="q">
          <p className="ql">Colour family</p>
          <Chips label="Colour family" value={famId ?? undefined} onChange={(v) => setFam(v)} options={families.map((f) => ({ value: f.id, label: f.name, dot: f.hex }))} />
        </div>
        {famId && (
          <div className="q">
            <p className="ql">Shade</p>
            <Chips label="Shade" value={cur} onChange={(v) => set(which === 'main' ? { shadeMain: v } : { shadeSecond: d.shadeSecond === v ? undefined : v })}
              options={trees.shades.filter((s) => s.familyId === famId).map((s) => ({ value: s.id, label: s.name, dot: s.hex }))} />
          </div>
        )}
        {which === 'second' && d.shadeSecond && <button type="button" className="ghost" onClick={() => set({ shadeSecond: undefined })}>No second colour</button>}
        <button type="button" className="acc" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

/** How a piece left: sold, donated, given or thrown away, with optional who and how much. */
export function LetGoSheet({ open, onClose, count, onDone }: { open: boolean; onClose: () => void; count: number; onDone: (g: Gone) => void }) {
  const [how, setHow] = useState<Gone['how']>('donated');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const a = amount.trim() ? parseRoughPrice(amount) : null;
  return (
    <Sheet open={open} onClose={onClose} label="Let it go">
      <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); onDone({ on: new Date().toISOString().slice(0, 10), how, ...(to.trim() ? { to: to.trim() } : {}), ...(how === 'sold' && a ? { amount: a.value } : {}) }); }}>
        <p className="name" style={{ fontSize: 22 }}>Let {count === 1 ? 'it' : `${count} pieces`} go</p>
        <p className="m">{count === 1 ? 'It' : 'They'} leave the wardrobe but keep their page and story.</p>
        <Chips label="How" value={how} onChange={setHow} options={[{ value: 'sold', label: 'Sold' }, { value: 'donated', label: 'Donated' }, { value: 'given', label: 'Given away' }, { value: 'thrown', label: 'Thrown away' }]} />
        {how !== 'thrown' && <input className="field" value={to} onChange={(e) => setTo(e.target.value)} placeholder={how === 'sold' ? 'Sold to (optional)' : 'To whom (optional)'} aria-label="To whom" />}
        {how === 'sold' && <input className="field" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="For how much (optional)" aria-label="For how much" />}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acc" style={{ flex: 1 }}>Let {count === 1 ? 'it' : 'them'} go</button>
        </div>
      </form>
    </Sheet>
  );
}


/** Edit, for clothing: its size on the outfit stage (with a live preview), what it pairs well with, its dress codes. */
function OutfitBits({ item, trees, d, set }: { item: Item; trees: Trees; d: Draft; set: (p: Partial<Draft>) => void }) {
  const all = useAllItems();
  const thumbs = useMainPhotos();
  const outfits = useOutfits();
  const own = useSetting<string[]>('dressCodes', []);
  const [pairing, setPairing] = useState(false);
  if (!all || !thumbs || !outfits) return null;
  const me = { ...item, outfitScale: d.outfitScale };
  const withMe = [...outfits].sort((a, b) => b.createdAt - a.createdAt).find((o) => o.itemIds.includes(item.id));
  const ids = withMe ? withMe.itemIds : [item.id];
  const items = all.map((i) => (i.id === item.id ? me : i));
  const pairs = (item.pairs ?? []).map((id) => all.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const codes = [...DRESS_CODES, ...own.filter((c) => !DRESS_CODES.includes(c))];
  const clothing = new Set(trees.kinds.filter((k) => k.clothing).map((k) => k.id));
  const others = all.filter((i) => i.id !== item.id && i.status === 'owned' && i.deletedAt === undefined && clothing.has(i.kindId) && !isUnsorted(i.kindId));
  return (
    <>
      <div className="q">
        <label className="ql" htmlFor="d-scale">Size in outfits</label>
        <div className="scale-row">
          <OutfitStage ids={ids} items={items} trees={trees} thumbs={thumbs} height={200} label={`${item.name} in an outfit, at this size`} />
          <div style={{ flex: 1, display: 'grid', gap: 8 }}>
            <input id="d-scale" type="range" min={0.6} max={1.5} step={0.05} value={d.outfitScale} onChange={(e) => set({ outfitScale: Number(e.target.value) })} aria-valuetext={`${Math.round(d.outfitScale * 100)} percent`} />
            <p className="m">{Math.round(d.outfitScale * 100)} %{Math.abs(d.outfitScale - 1) > 0.001 ? '' : ', as it is'}</p>
            {Math.abs(d.outfitScale - 1) > 0.001 && <button type="button" className="link" style={{ justifySelf: 'start' }} onClick={() => set({ outfitScale: 1 })}>Back to 100 %</button>}
          </div>
        </div>
      </div>
      <div className="q">
        <p className="ql">Pairs well with</p>
        <div className="chips">
          {pairs.map((p) => <Chip key={p.id} on onClick={() => setPairing(true)}>{p.name}</Chip>)}
          <Chip onClick={() => setPairing(true)}>{pairs.length ? 'Change' : 'Pick pieces'}</Chip>
        </div>
      </div>
      <div className="q">
        <p className="ql">Dress codes</p>
        <Chips label="Dress codes" value={d.dressCodes} onChange={(v) => set({ dressCodes: d.dressCodes.includes(v) ? d.dressCodes.filter((c) => c !== v) : [...d.dressCodes, v] })} options={codes.map((c) => ({ value: c, label: c }))} />
      </div>
      <Sheet open={pairing} onClose={() => setPairing(false)} label="Pairs well with">
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="name" style={{ fontSize: 22 }}>Pairs well with {item.name}</p>
          <div className="grid" style={{ padding: 0 }}>
            {others.map((o, n) => {
              const t = thumbs.get(o.id);
              const on = !!item.pairs?.includes(o.id);
              return <Tile key={o.id} item={o} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(o, trees)} index={n} selected={on} selecting onPress={() => void setPairs(item.id, o.id, !on)} />;
            })}
          </div>
          <button type="button" className="acc" onClick={() => setPairing(false)}>Done</button>
        </div>
      </Sheet>
    </>
  );
}
