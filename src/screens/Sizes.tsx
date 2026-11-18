import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, newId } from '../db/db';
import { setSetting } from '../db/actions';
import { useItems, useSetting, useTrees } from '../db/hooks';
import type { SizeEntry, SizeRow } from '../domain/types';
import type { CSSProperties } from 'react';
import { KIND_PALETTE } from '../domain/kinds';
import { fitSummary } from '../domain/wears';
import { go } from '../router';
import { askConfirm, askText } from '../ui/Ask';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Sheet } from '../ui/Sheet';
import { SubTop } from './shared';

const MEASURES = ['Chest', 'Waist', 'Hip', 'Shoulder', 'Sleeve', 'Inseam'];

/** My sizes, laid out like a tailor's book: measurements, brand by brand, and how it all fits now. */
export function Sizes() {
  const rows = useLiveQuery(() => db.sizes.filter((r) => !r.deletedAt).toArray(), []);
  const unit = useSetting<'in' | 'cm' | ''>('sizes.unit', '');
  const items = useItems();
  const trees = useTrees();
  const [brand, setBrand] = useState<SizeRow | 'new' | null>(null);
  if (!rows || !items || !trees) return <main className="screen" aria-busy="true" />;
  const measure = (name: string) => rows.find((r) => r.type === 'measure' && r.name === name);
  const brands = rows.filter((r) => r.type === 'brand').sort((a, b) => a.order - b.order);
  const fit = fitSummary(items, trees.kinds);

  const editMeasure = async (name: string) => {
    const cur = measure(name);
    const v = await askText(`${name}, in ${unit === 'cm' ? 'centimetres' : 'inches'}`, unit === 'cm' ? 'For example: 96' : 'For example: 38', cur?.value ?? '');
    if (v === null) return;
    const n = v.replace(/[^\d.]/g, '');
    if (cur) await db.sizes.update(cur.id, { value: n, updatedAt: Date.now() });
    else await db.sizes.add({ id: `m-${name.toLowerCase()}`, type: 'measure', name, value: n, order: MEASURES.indexOf(name), updatedAt: Date.now() });
  };

  return (
    <main className="screen sizes">
      <SubTop title="My sizes" />
      {!unit ? (
        <div style={{ padding: '8px 18px 0', display: 'grid', gap: 10 }}>
          <p>Do you measure in inches or centimetres?</p>
          <Chips label="Measured in" value={undefined} onChange={(v) => void setSetting('sizes.unit', v)} options={[{ value: 'in', label: 'Inches' }, { value: 'cm', label: 'Centimetres' }]} />
        </div>
      ) : (
        <div className="measures">
          {MEASURES.map((name) => {
            const v = measure(name)?.value;
            return (
              <button key={name} type="button" className="measure" onClick={() => editMeasure(name)} aria-label={`${name}: ${v ? `${v} ${unit}` : 'not measured yet'}. Change`}>
                {v ? <Numeral value={Number(v)} roll={false} className="measure-num" /> : <span className="num measure-num m">–</span>}
                <span className="m sm" style={{ paddingBottom: 2 }}>{unit}<br />{name}</span>
              </button>
            );
          })}
        </div>
      )}

      <h2 className="caps m section-cap">Brand by brand</h2>
      <div className="brands">
        {brands.map((b, n) => (
          <button key={b.id} type="button" className="brand rise" style={{ '--d': `${n * 50}ms`, '--k': KIND_PALETTE[n % KIND_PALETTE.length] } as CSSProperties} onClick={() => setBrand(b)}>
            <span className="brand-mark" aria-hidden="true">{b.name.trim().charAt(0).toUpperCase()}</span>
            <span className="brand-text">
              <span className="b">{b.name}</span>
              {(b.entries ?? []).map((e, i) => (
                <span key={i} className="brand-entry">
                  <span className="m sm">{e.covers || 'Size'}{e.note ? `, ${e.note}` : ''}</span>
                  <span className="brand-size">{e.size}</span>
                  {e.tailoring && <span className="tailor sm">Needs tailoring: {e.tailoring}</span>}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="page-acts"><button type="button" className="ghost wide" onClick={() => setBrand('new')}>Add a brand</button></div>

      <h2 className="caps m section-cap">How it all fits now</h2>
      {fit.fits + fit.tight + fit.loose > 0 ? (
        <>
          <div className="fitbar" aria-hidden="true">
            <span style={{ flex: fit.fits, background: 'var(--ok)' }} />
            <span style={{ flex: fit.tight, background: 'var(--warn)' }} />
            <span style={{ flex: fit.loose, background: 'var(--lo)' }} />
          </div>
          <div className="fit-counts">
            <button type="button" className="link" style={{ color: 'var(--t)', fontWeight: 400 }} onClick={() => go('/search', { fit: 'fits' })}><b style={{ color: 'var(--ok)' }}>{fit.fits}</b>&nbsp;fit</button>
            <button type="button" className="link" style={{ color: 'var(--t)', fontWeight: 400 }} onClick={() => go('/search', { fit: 'tight' })}><b style={{ color: 'var(--warn)' }}>{fit.tight}</b>&nbsp;tight</button>
            <button type="button" className="link" style={{ color: 'var(--t)', fontWeight: 400 }} onClick={() => go('/search', { fit: 'loose' })}><b style={{ color: 'var(--lo)' }}>{fit.loose}</b>&nbsp;loose</button>
          </div>
          {fit.unset > 0 && <p className="m sm" style={{ padding: '4px 18px 0' }}>{fit.unset} more with no fit set yet.</p>}
        </>
      ) : <p className="m" style={{ padding: '0 18px' }}>Mark pieces as tight, fitting or loose and they add up here.</p>}
      {unit && (
        <div style={{ padding: '22px 18px 0' }}>
          <Chips label="Measured in" value={unit} onChange={(v) => void setSetting('sizes.unit', v)} options={[{ value: 'in', label: 'Inches' }, { value: 'cm', label: 'Centimetres' }]} />
        </div>
      )}
      <BrandSheet row={brand} onClose={() => setBrand(null)} next={brands.length} />
    </main>
  );
}

const BLANK: SizeEntry = { covers: '', size: '' };

/** A brand and its sizes: what each covers ("Trousers", "Shoes"), the size, a note, and whether it needs tailoring. */
function BrandSheet({ row, onClose, next }: { row: SizeRow | 'new' | null; onClose: () => void; next: number }) {
  const cur = row && row !== 'new' ? row : null;
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<SizeEntry[]>([BLANK]);
  const [key, setKey] = useState<string | null>(null);
  const id = cur?.id ?? (row === 'new' ? 'new' : null);
  if (id !== key) {
    setKey(id);
    setName(cur?.name ?? '');
    setEntries(cur?.entries?.length ? cur.entries : [BLANK]);
  }
  const edit = (i: number, p: Partial<SizeEntry>) => setEntries((es) => es.map((e, n) => (n === i ? { ...e, ...p } : e)));
  const clean = entries
    .map((e) => ({ covers: e.covers.trim(), size: e.size.trim(), ...(e.note?.trim() ? { note: e.note.trim() } : {}), ...(e.tailoring?.trim() ? { tailoring: e.tailoring.trim() } : {}) }))
    .filter((e) => e.size);
  const ok = !!name.trim() && clean.length > 0;
  const save = async () => {
    if (!ok) return;
    if (cur) await db.sizes.update(cur.id, { name: name.trim(), entries: clean, updatedAt: Date.now() });
    else await db.sizes.add({ id: newId(), type: 'brand', name: name.trim(), entries: clean, order: next, updatedAt: Date.now() });
    onClose();
  };
  return (
    <Sheet open={!!row} onClose={onClose} label="A brand's sizes">
      <form className="sheet-body" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="name">{cur ? cur.name : 'A brand'}</p>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand, for example Levi's" aria-label="Brand" />
        {entries.map((e, i) => (
          <fieldset key={i} className="entry">
            <legend className="caps m">Size {entries.length > 1 ? i + 1 : ''}</legend>
            <div className="pair">
              <input className="field" value={e.covers} onChange={(ev) => edit(i, { covers: ev.target.value })} placeholder="For: Trousers" aria-label="What this size is for" />
              <input className="field" value={e.size} onChange={(ev) => edit(i, { size: ev.target.value })} placeholder="32 × 30" aria-label="Size" />
            </div>
            <input className="field" value={e.note ?? ''} onChange={(ev) => edit(i, { note: ev.target.value })} placeholder="Note, e.g. runs small (optional)" aria-label="Note" />
            <input className="field" value={e.tailoring ?? ''} onChange={(ev) => edit(i, { tailoring: ev.target.value })} placeholder="Needs tailoring? e.g. take in waist to 31" aria-label="Needs tailoring" />
            {entries.length > 1 && <button type="button" className="link" onClick={() => setEntries((es) => es.filter((_, n) => n !== i))}>Remove this size</button>}
          </fieldset>
        ))}
        <button type="button" className="ghost" onClick={() => setEntries((es) => [...es, BLANK])}>Add another size</button>
        <div className="pair">
          {cur && <button type="button" className="ghost" onClick={async () => { if (await askConfirm(`Remove ${cur.name}?`, 'Remove')) { await db.sizes.update(cur.id, { deletedAt: Date.now(), updatedAt: Date.now() }); onClose(); } }}>Remove</button>}
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acc" style={{ flex: 1 }} disabled={!ok}>Save</button>
        </div>
      </form>
    </Sheet>
  );
}
