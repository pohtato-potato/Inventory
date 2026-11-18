import { useCallback, useState } from 'react';
import { editMany, letGoMany, moveItems, trash, undoLast } from '../db/actions';
import type { Trees } from '../db/hooks';
import type { Fit, Id, Item } from '../domain/types';
import { Chip, Chips } from '../ui/Chips';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { FIT_LABEL, FIT_TONE } from './Piece';
import { LetGoSheet } from './Details';
import { pieces } from '../db/actions';
import { Tick } from '../ui/Tick';
import { IconPin } from '../ui/icons';

export interface SelectionState {
  ids: Set<Id>;
  toggle: (id: Id) => void;
  clear: () => void;
}

export function useSelection(): SelectionState {
  const [ids, setIds] = useState<Set<Id>>(new Set());
  const toggle = useCallback((id: Id) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const clear = useCallback(() => setIds(new Set()), []);
  return { ids, toggle, clear };
}

/**
 * Select many: the top bar says how many, and a sheet at the bottom moves, edits or lets them go.
 * The sheet publishes its height so the grid above gets that much room and the last row stays visible.
 */
export function Selection({ sel, trees }: { sel: SelectionState; trees: Trees }) {
  const [spot, setSpot] = useState<Id | 'none' | undefined>();
  const [editing, setEditing] = useState(false);
  const [letting, setLetting] = useState(false);
  const ids = [...sel.ids];
  const n = ids.length;
  const spots = trees.places.filter((p) => p.role !== 'home');
  const done = (label: string) => { sel.clear(); showToast(label, () => void undoLast()); };
  return (
    <>
      <div className="top">
        <h1 className="title"><Tick value={n} /> selected</h1>
        <span className="top-right"><button type="button" className="link" onClick={sel.clear}>Cancel</button></span>
      </div>
      <Sheet open={!editing && !letting} modal={false} onClose={sel.clear} label={`Move ${pieces(n)}`}>
        <p className="name">Move {pieces(n)} to</p>
        <div className="chips" style={{ paddingTop: 12 }}>
          {spots.map((s) => <Chip key={s.id} on={spot === s.id} onClick={() => setSpot(spot === s.id ? undefined : s.id)}><IconPin size={16} />{s.name}</Chip>)}
          <Chip on={spot === 'none'} onClick={() => setSpot(spot === 'none' ? undefined : 'none')}>No spot</Chip>
        </div>
        <div className="sel-acts">
          <button type="button" className="ghost" onClick={() => setEditing(true)}>Edit</button>
          <button type="button" className="ghost" onClick={() => setLetting(true)}>Let go</button>
          <button type="button" className="acc" disabled={!spot} onClick={async () => { await moveItems(ids, spot === 'none' ? undefined : spot); setSpot(undefined); done(`Moved ${pieces(n)}`); }}>Move</button>
        </div>
      </Sheet>
      <BatchEdit open={editing} onClose={() => setEditing(false)} trees={trees} n={n} onSave={async (patch, tags) => { await editMany(ids, patch, tags); setEditing(false); done(`Edited ${pieces(n)}`); }} onDelete={async () => { await trash(ids); setEditing(false); done(`Deleted ${pieces(n)}`); }} />
      <LetGoSheet open={letting} onClose={() => setLetting(false)} count={n} onDone={async (g) => { await letGoMany(ids, g); setLetting(false); done(`Let go of ${pieces(n)}`); }} />
    </>
  );
}

function BatchEdit({ open, onClose, trees, n, onSave, onDelete }: { open: boolean; onClose: () => void; trees: Trees; n: number; onSave: (p: Partial<Item>, tags: string[]) => void; onDelete: () => void }) {
  const [kindId, setKind] = useState<Id | undefined>();
  const [fit, setFit] = useState<Fit | undefined>();
  const [tag, setTag] = useState('');
  const [spot, setSpot] = useState<Id | undefined>();
  const tags = tag.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean);
  return (
    <Sheet open={open} onClose={onClose} label={`Edit ${pieces(n)}`}>
      <div style={{ display: 'grid', gap: 14 }}>
        <p className="name" style={{ fontSize: 22 }}>Edit {pieces(n)}</p>
        <p className="m sm">Only what you set here changes. The rest stays as it is.</p>
        <div className="q"><p className="ql">Kind</p><Chips label="Kind" value={kindId} onChange={(v) => setKind(kindId === v ? undefined : v)} options={trees.kinds.map((k) => ({ value: k.id, label: k.name }))} /></div>
        <div className="q"><p className="ql">Fit</p><Chips label="Fit" value={fit} onChange={(v) => setFit(fit === v ? undefined : v)} options={(['tight', 'fits', 'loose'] as Fit[]).map((f) => ({ value: f, label: FIT_LABEL[f], tone: FIT_TONE[f] }))} /></div>
        <div className="q"><label className="ql" htmlFor="b-tag">Add tags, separated by commas</label><input id="b-tag" className="field" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="gym, travel" /></div>
        <div className="q"><p className="ql">Spot</p><Chips label="Spot" value={spot} onChange={(v) => setSpot(spot === v ? undefined : v)} options={trees.places.filter((p) => p.role !== 'home').map((p) => ({ value: p.id, label: p.name }))} /></div>
        <div className="sel-acts">
          <button type="button" className="ghost" onClick={onDelete}>Delete</button>
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="acc" disabled={!kindId && !fit && !tags.length && !spot} onClick={() => onSave({ ...(kindId ? { kindId } : {}), ...(fit ? { fit } : {}), ...(spot ? { spotId: spot } : {}) }, tags)}>Save</button>
        </div>
      </div>
    </Sheet>
  );
}
