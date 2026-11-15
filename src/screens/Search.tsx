import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db, newId } from '../db/db';
import { useItems, useMainPhotos, useTrees } from '../db/hooks';
import { decodeQuery, encodeQuery, isEmptyQuery, matches, type Query } from '../domain/search';
import type { Fit, Id } from '../domain/types';
import { go, useRoute } from '../router';
import { askText } from '../ui/Ask';
import { Chips } from '../ui/Chips';
import { showToast } from '../ui/Toast';
import { IconClose } from '../ui/icons';
import { Pieces } from './Browse';
import { useSelection } from './Selection';
import { SubTop } from './shared';

export function Search() {
  const { params } = useRoute();
  const [q, setQ] = useState<Query>(() => decodeQuery(params.toString()));
  const trees = useTrees();
  const items = useItems();
  const thumbs = useMainPhotos();
  const saved = useLiveQuery(() => db.searches.filter((s) => !s.deletedAt).toArray(), []);
  const sel = useSelection();
  const set = (patch: Partial<Query>) => setQ((old) => {
    const next = { ...old, ...patch };
    for (const k of Object.keys(next) as (keyof Query)[]) if (next[k] === undefined) delete next[k];
    go('/search', Object.fromEntries(new URLSearchParams(encodeQuery(next))), { replace: true });
    return next;
  });
  const toggle = <K extends keyof Query>(k: K, v: Query[K]) => set({ [k]: q[k] === v ? undefined : v } as Partial<Query>);

  const results = useMemo(() => (trees && items && !isEmptyQuery(q) ? items.filter((i) => matches(i, q, trees)) : []), [items, trees, q]);
  const tags = useMemo(() => [...new Set(items?.flatMap((i) => i.tags) ?? [])].sort(), [items]);
  if (!trees || !items || !thumbs) return <main className="screen" aria-busy="true" />;

  const roots = trees.kinds.filter((k) => !k.parentId);
  const families = trees.shades.filter((s) => !s.familyId);
  const spots = trees.places.filter((p) => p.role !== 'home');
  const empty = isEmptyQuery(q);
  const count = results.reduce((n, i) => n + i.count, 0);

  const save = async () => {
    const name = await askText('Name this search', 'For example: Gym tops that fit');
    if (!name) return;
    await db.searches.add({ id: newId(), name, query: encodeQuery(q), updatedAt: Date.now() });
    showToast(`Saved "${name}"`);
  };

  return (
    <main className="screen">
      <SubTop title="Search" />
      <div style={{ padding: '4px 14px 0', position: 'relative' }}>
        <input
          className="field" type="search" autoFocus={!params.toString()} value={q.text ?? ''} enterKeyHint="search"
          placeholder="Name, brand, colour, kind, spot" aria-label="Search your pieces"
          onChange={(e) => set({ text: e.target.value || undefined })}
          style={{ paddingRight: 48 }}
        />
        {q.text && <button type="button" className="icon-btn" style={{ position: 'absolute', right: 16, top: 6 }} aria-label="Clear the text" onClick={() => set({ text: undefined })}><IconClose /></button>}
      </div>
      <div className="filters">
        <Chips label="Fit" value={q.fit} onChange={(v) => toggle('fit', v as Fit)} options={[{ value: 'fits', label: 'Fits', tone: 'ok' }, { value: 'tight', label: 'Tight', tone: 'warn' }, { value: 'loose', label: 'Loose', tone: 'lo' }]} />
        <Chips scroll label="Kind" value={q.kindId} onChange={(v) => toggle('kindId', v as Id)} options={roots.map((k) => ({ value: k.id, label: k.name }))} />
        <Chips scroll label="Colour" value={q.shadeId} onChange={(v) => toggle('shadeId', v as Id)} options={families.map((f) => ({ value: f.id, label: f.name, dot: f.hex }))} />
        <Chips scroll label="Spot" value={q.spotId} onChange={(v) => toggle('spotId', v as Id)} options={[...spots.map((p) => ({ value: p.id, label: p.name })), { value: 'none', label: 'No spot' }]} />
        {tags.length > 0 && <Chips scroll label="Tag" value={q.tag} onChange={(v) => toggle('tag', v)} options={tags.map((t) => ({ value: t, label: `#${t}` }))} />}
        <Chips label="More" value={[q.needsDetails ? 'nd' : '', q.gone ? 'gone' : ''].filter(Boolean) as string[]} onChange={(v) => (v === 'nd' ? toggle('needsDetails', true) : toggle('gone', true))} options={[{ value: 'nd', label: 'Needs details' }, { value: 'gone', label: 'Let go' }]} />
      </div>

      {empty ? (
        <section aria-label="Saved searches" style={{ paddingTop: 8 }}>
          <h2 className="caps m" style={{ padding: '8px 18px' }}>Saved searches</h2>
          {saved?.length ? saved.map((s) => (
            <div key={s.id} className="li">
              <button type="button" className="link" style={{ color: 'var(--t)', fontWeight: 400, justifyContent: 'flex-start', flex: 1 }} onClick={() => { const nq = decodeQuery(s.query); setQ(nq); go('/search', Object.fromEntries(new URLSearchParams(s.query)), { replace: true }); }}>{s.name}</button>
              <button type="button" className="icon-btn m" aria-label={`Forget ${s.name}`} onClick={async () => { await db.searches.update(s.id, { deletedAt: Date.now(), updatedAt: Date.now() }); showToast(`Forgot "${s.name}"`, () => void db.searches.update(s.id, { deletedAt: undefined, updatedAt: Date.now() })); }}><IconClose /></button>
            </div>
          )) : <p className="m" style={{ padding: '0 18px' }}>Type a word or pick a filter. A search you use often can be saved here.</p>}
        </section>
      ) : (
        <section aria-label="Results">
          <div className="section-h" style={{ alignItems: 'center' }}>
            <span className="name" role="status">{count ? `${count} found` : 'Nothing found'}</span>
            <button type="button" className="link" style={{ marginLeft: 'auto' }} onClick={save}>Save this search</button>
          </div>
          <Pieces items={results} trees={trees} thumbs={thumbs} sel={sel} />
        </section>
      )}
    </main>
  );
}
