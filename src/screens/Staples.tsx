import { useState, type CSSProperties } from 'react';
import { useAllItems, useMainPhotos, useTrees } from '../db/hooks';
import { GROUP_NAME, groupColour, kindGroup } from '../domain/kinds';
import { Cut, Swatch } from '../ui/Swatch';
import { KindIcon, NoPhoto } from '../ui/kindIcons';
import { setSetting } from '../db/actions';
import { isUnsorted } from '../domain/fields';
import { stapleOwned, type Staple } from '../domain/gaps';
import { Chips } from '../ui/Chips';
import { Sheet } from '../ui/Sheet';
import { showToast } from '../ui/Toast';
import { useStaples } from './OwnThis';
import { pieceColour, SubTop, type Trees } from './shared';

const familyText = (f: Staple['family']) => (f === undefined ? 'any colour' : Array.isArray(f) ? f.join(' or ') : f);

/**
 * Staples: the basics behind "You have none of these". Owned ones show in their colour with how many you have;
 * missing ones are a dashed tile and "None yet". Each can be removed; new ones added; dismissed ones brought back.
 */
export function StaplesPage() {
  const trees = useTrees();
  const items = useAllItems();
  const thumbs = useMainPhotos();
  const { staples, dismissed } = useStaples();
  const [open, setOpen] = useState<Staple | 'new' | null>(null);
  if (!trees || !items || !thumbs) return <main className="screen" aria-busy="true" />;
  const save = async (next: Staple[], msg: string) => {
    const before = staples;
    await setSetting('staples', next);
    showToast(msg, () => void setSetting('staples', before));
  };
  const live = items.filter((i) => i.deletedAt === undefined);
  return (
    <main className="screen staples">
      <SubTop title="Staples" />
      <p className="m page-lede">The basics Wishes mentions when you own none of them.</p>
      <div className="staple-list">
        {staples.map((s, n) => {
          const owned = stapleOwned(live, s, trees) ?? [];
          const kind = trees.kinds.find((k) => k.name.toLocaleLowerCase() === s.kind.toLocaleLowerCase());
          const group = kind ? kindGroup(kind.id, trees.kinds) : 'other';
          const first = owned[0];
          const t = first ? thumbs.get(first.id) : undefined;
          return (
            <button key={s.id} type="button" className={`staple rise${owned.length ? '' : ' none'}`} style={{ '--d': `${n * 50}ms` } as CSSProperties} onClick={() => setOpen(s)}>
              {first ? (
                <Swatch className="staple-tile" colour={pieceColour(first, trees)}>{t ? <Cut src={t.url} cut={t.cut} /> : <NoPhoto group={group} size={26} />}</Swatch>
              ) : (
                <span className="staple-tile empty" style={{ '--k': groupColour(group) } as CSSProperties}><KindIcon group={group} size={26} /></span>
              )}
              <span className="staple-text"><span className="b">{s.label}</span><span className="m sm">{GROUP_NAME[group]}{s.family ? `, ${familyText(s.family)}` : ''}</span></span>
              <span className={`staple-n ${owned.length ? 'have' : 'nothing'}`}>{owned.length ? `You have ${owned.length}` : 'None yet'}</span>
            </button>
          );
        })}
      </div>
      {staples.length === 0 && <p className="m page-lede">No staples: Wishes won't suggest any.</p>}
      <div className="page-acts">
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
          <div className="sheet-body">
            <p className="name">{open.label}</p>
            <p className="m">{open.kind}, {familyText(open.family)}</p>
            <button type="button" className="ghost" onClick={async () => { setOpen(null); await save(staples.filter((x) => x.id !== open.id), `Removed ${open.label}`); }}>Remove from staples</button>
            <button type="button" className="ghost" onClick={() => setOpen(null)}>Cancel</button>
          </div>
        )}
      </Sheet>
    </main>
  );
}

function NewStaple({ trees, onDone }: { trees: Trees; onDone: (s: Staple) => void }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<string | undefined>();
  const [family, setFamily] = useState<string | undefined>();
  const kinds = trees.kinds.filter((k) => !isUnsorted(k.id));
  const families = trees.shades.filter((s) => !s.familyId);
  const k = kinds.find((x) => x.id === kind);
  const f = families.find((x) => x.id === family);
  return (
    <div className="sheet-body">
      <p className="name">Add a staple</p>
      <div className="q">
        <label className="ql" htmlFor="st-label">Name</label>
        <input id="st-label" className="field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={k ? `${f ? `${f.name} ` : ''}${k.name.toLowerCase()}` : 'Grey hoodie'} />
      </div>
      <div className="q"><p className="ql">Kind</p><Chips label="Kind" value={kind} onChange={setKind} options={kinds.map((x) => ({ value: x.id, label: x.name }))} /></div>
      <div className="q"><p className="ql">Colour, if it matters</p><Chips label="Colour family" value={family} onChange={(v) => setFamily(v === family ? undefined : v)} options={families.map((x) => ({ value: x.id, label: x.name, dot: x.hex }))} /></div>
      <button type="button" className="acc" disabled={!k} onClick={() => {
        if (!k) return;
        const name = label.trim() || `${f ? `${f.name} ` : ''}${k.name.toLowerCase()}`;
        onDone({ id: `own-${Date.now().toString(36)}`, label: name, kind: k.name, ...(f ? { family: f.name } : {}), ...(!k.clothing && label.trim() ? { word: label.trim().toLocaleLowerCase() } : {}) });
      }}>Add</button>
    </div>
  );
}
