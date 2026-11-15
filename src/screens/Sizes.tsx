import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, newId } from '../db/db';
import { setSetting } from '../db/actions';
import { useItems, useSetting, useTrees } from '../db/hooks';
import type { SizeRow } from '../domain/types';
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
    <main className="screen">
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

      <h2 className="caps m" style={{ padding: '22px 18px 4px' }}>Brand by brand</h2>
      {brands.map((b) => (
        <button key={b.id} type="button" className="li" onClick={() => setBrand(b)}>
          <span>{b.name}</span>
          {b.note && <span className="m sm">{b.note}</span>}
          <span className="n name" style={{ fontSize: 22, color: 'var(--t)' }}>{b.value}</span>
        </button>
      ))}
      <div style={{ padding: '6px 18px 0' }}><button type="button" className="ghost wide" onClick={() => setBrand('new')}>Add a brand</button></div>

      <h2 className="caps m" style={{ padding: '22px 18px 8px' }}>How it all fits now</h2>
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

function BrandSheet({ row, onClose, next }: { row: SizeRow | 'new' | null; onClose: () => void; next: number }) {
  const cur = row && row !== 'new' ? row : null;
  const [name, setName] = useState('');
  const [size, setSize] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const id = cur?.id ?? (row === 'new' ? 'new' : null);
  if (id !== key) {
    setKey(id);
    setName(cur?.name ?? '');
    setSize(cur?.value ?? '');
    setNote(cur?.note ?? '');
  }
  const save = async () => {
    if (!name.trim() || !size.trim()) return;
    if (cur) await db.sizes.update(cur.id, { name: name.trim(), value: size.trim(), note: note.trim() || undefined, updatedAt: Date.now() });
    else await db.sizes.add({ id: newId(), type: 'brand', name: name.trim(), value: size.trim(), note: note.trim() || undefined, order: next, updatedAt: Date.now() });
    onClose();
  };
  return (
    <Sheet open={!!row} onClose={onClose} label="A brand's size">
      <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <p className="name" style={{ fontSize: 22 }}>{cur ? cur.name : 'A brand'}</p>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand, or Shoes" aria-label="Brand" />
        <input className="field" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Your size there, e.g. M or 32 × 30" aria-label="Size" />
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. runs small (optional)" aria-label="Note" />
        <div style={{ display: 'flex', gap: 8 }}>
          {cur && <button type="button" className="ghost" onClick={async () => { if (await askConfirm(`Remove ${cur.name}?`, 'Remove')) { await db.sizes.update(cur.id, { deletedAt: Date.now(), updatedAt: Date.now() }); onClose(); } }}>Remove</button>}
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="acc" style={{ flex: 1 }} disabled={!name.trim() || !size.trim()}>Save</button>
        </div>
      </form>
    </Sheet>
  );
}
