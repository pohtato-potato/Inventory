import { useState } from 'react';
import { setSetting } from '../db/actions';
import { isUnsorted } from '../domain/fields';
import type { Staple } from '../domain/gaps';
import { Chips } from '../ui/Chips';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { IconChev } from '../ui/icons';
import { useStaples } from './OwnThis';
import type { Trees } from './shared';

const familyText = (f: Staple['family']) => (f === undefined ? 'any colour' : Array.isArray(f) ? f.join(' or ') : f);

/** Settings: the staples behind "You have none of these". Each can be removed; new ones added; dismissed ones brought back. */
export function StaplesSection({ trees }: { trees: Trees }) {
  const { staples, dismissed } = useStaples();
  const [open, setOpen] = useState<Staple | 'new' | null>(null);
  const save = async (next: Staple[], msg: string) => {
    const before = staples;
    await setSetting('staples', next);
    showToast(msg, () => void setSetting('staples', before));
  };
  return (
    <>
      <h2 className="caps m" style={{ padding: '26px 18px 4px' }}>Staples</h2>
      <p className="m" style={{ padding: '0 18px 8px' }}>The basics Wishes mentions when you own none of them.</p>
      {staples.map((s) => (
        <button key={s.id} type="button" className="li" onClick={() => setOpen(s)}>
          <span>{s.label}</span>
          <span className="m sm">{s.kind}, {familyText(s.family)}</span>
          <span className="n"><IconChev /></span>
        </button>
      ))}
      <div style={{ padding: '10px 18px 0', display: 'grid', gap: 8 }}>
        <button type="button" className="ghost wide" onClick={() => setOpen('new')}>Add a staple</button>
        {dismissed.length > 0 && (
          <button type="button" className="ghost wide" onClick={async () => { const before = dismissed; await setSetting('gaps.dismissed', []); showToast('Suggesting them all again', () => void setSetting('gaps.dismissed', before)); }}>
            Suggest the {dismissed.length} you said “not for me” to again
          </button>
        )}
      </div>
      <Sheet open={open !== null} onClose={() => setOpen(null)} label={open === 'new' ? 'Add a staple' : 'Staple'}>
        {open === 'new' && <NewStaple trees={trees} onDone={async (s) => { setOpen(null); await save([...staples, s], `Added ${s.label}`); }} />}
        {open && open !== 'new' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="name" style={{ fontSize: 22 }}>{open.label}</p>
            <p className="m">{open.kind}, {familyText(open.family)}</p>
            <button type="button" className="ghost" onClick={async () => { setOpen(null); await save(staples.filter((x) => x.id !== open.id), `Removed ${open.label}`); }}>Remove from staples</button>
            <button type="button" className="ghost" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        )}
      </Sheet>
      {staples.length === 0 && <p className="m" style={{ padding: '8px 18px' }}>No staples: Wishes won't suggest any.</p>}
    </>
  );
}

function NewStaple({ trees, onDone }: { trees: Trees; onDone: (s: Staple) => void }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<string | undefined>();
  const [family, setFamily] = useState<string | undefined>();
  const kinds = trees.kinds.filter((k) => k.clothing && !isUnsorted(k.id));
  const families = trees.shades.filter((s) => !s.familyId);
  const k = kinds.find((x) => x.id === kind);
  const f = families.find((x) => x.id === family);
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="name" style={{ fontSize: 22 }}>Add a staple</p>
      <div className="q">
        <label className="ql" htmlFor="st-label">Name</label>
        <input id="st-label" className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={k ? `${f ? `${f.name} ` : ''}${k.name.toLowerCase()}` : 'Grey hoodie'} />
      </div>
      <div className="q"><p className="ql">Kind</p><Chips label="Kind" value={kind} onChange={setKind} options={kinds.map((x) => ({ value: x.id, label: x.name }))} /></div>
      <div className="q"><p className="ql">Colour, if it matters</p><Chips label="Colour family" value={family} onChange={(v) => setFamily(v === family ? undefined : v)} options={families.map((x) => ({ value: x.id, label: x.name, dot: x.hex }))} /></div>
      <button type="button" className="acc" disabled={!k} onClick={() => {
        if (!k) return;
        const name = label.trim() || `${f ? `${f.name} ` : ''}${k.name.toLowerCase()}`;
        onDone({ id: `own-${Date.now().toString(36)}`, label: name, kind: k.name, ...(f ? { family: f.name } : {}) });
      }}>Add</button>
    </div>
  );
}
