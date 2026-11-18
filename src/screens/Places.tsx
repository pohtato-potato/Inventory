import { useMemo, useState } from 'react';
import { addPlace } from '../db/actions';
import { useItems, useMainPhotos, useTrees, type Thumb, type Trees } from '../db/hooks';
import { matches, shownItems } from '../domain/search';
import type { Id, Item } from '../domain/types';
import { go } from '../router';
import { askText } from '../ui/Ask';
import { IconChev, IconClose, IconPin, IconSearch } from '../ui/icons';
import { homesWithSpots, kindName, Mini, openItem, placeLabel, Top } from './shared';

const sum = (list: Item[]) => list.reduce((n, i) => n + i.count, 0);

/** Places: every home and its spots, each with its count; "Where is my…" finds a thing and says where it lives. */
export function Places() {
  const trees = useTrees();
  const all = useItems();
  const thumbs = useMainPhotos();
  const [q, setQ] = useState('');
  const items = useMemo(() => (all ? shownItems(all) : undefined), [all]);
  if (!trees || !items || !thumbs) return <main className="screen" aria-busy="true" />;
  const found = q.trim() ? items.filter((i) => matches(i, { text: q }, trees)) : [];
  return (
    <main className="screen places">
      <Top title="Places" />
      <div className="where">
        <span className="where-icon m" aria-hidden="true"><IconSearch size={20} /></span>
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Where is my…" aria-label="Where is my…" enterKeyHint="search" />
        {q && <button type="button" className="icon-btn where-clear" aria-label="Clear" onClick={() => setQ('')}><IconClose /></button>}
      </div>
      {q.trim() ? (
        <section aria-label="Found" role="status">
          <p className="m sm" style={{ padding: '12px 18px 4px' }}>{found.length ? `${found.length} found` : 'Nothing by that name'}</p>
          {found.map((i, n) => (
            <button key={i.id} type="button" className="li place-thing rise" style={{ '--d': `${Math.min(n, 10) * 40}ms` } as React.CSSProperties} onClick={() => openItem(i.id)}>
              <Mini item={i} thumb={thumbs.get(i.id)} trees={trees} size={44} />
              <span style={{ minWidth: 0 }}>
                <b className="ellipsis">{i.name}</b>
                <span className="m sm ellipsis"><IconPin size={14} /> {placeLabel(i.spotId, trees.places)}</span>
              </span>
              <span className="n"><IconChev /></span>
            </button>
          ))}
        </section>
      ) : <PlaceGroups items={items} trees={trees} thumbs={thumbs} />}
    </main>
  );
}

/** Homes, then their spots as cards with a count and the first few things; With me; things with no spot. */
export function PlaceGroups({ items, trees, thumbs }: { items: Item[]; trees: Trees; thumbs: Map<Id, Thumb> }) {
  const groups = homesWithSpots(trees.places);
  const withMe = trees.places.find((p) => p.role === 'withme');
  const inSpot = (id: Id) => items.filter((i) => i.spotId === id);
  const known = new Set(trees.places.map((p) => p.id));
  const nowhere = items.filter((i) => !i.spotId || !known.has(i.spotId));
  const addSpot = async (homeId: Id, homeName: string) => {
    const name = await askText(`A new spot in ${homeName}`, 'For example: Cupboard, left rail');
    if (name) await addPlace(name, homeId);
  };
  const addHome = async () => {
    const name = await askText('A new home', "For example: Parents' home");
    if (name) await addPlace(name, null);
  };
  let n = 0;
  return (
    <>
      {groups.map(({ home, spots }) => {
        const homeItems = items.filter((i) => spots.some((s) => s.id === i.spotId));
        return (
          <section key={home.id} aria-label={home.name}>
            <h2 className="section-h"><span className="name">{home.name}</span> <span className="m">{sum(homeItems)}</span></h2>
            {spots.map((sp) => <SpotCard key={sp.id} id={sp.id} name={sp.name} items={inSpot(sp.id)} trees={trees} thumbs={thumbs} index={n++} />)}
            <div style={{ padding: '2px 14px 6px' }}>
              <button type="button" className="ghost wide" onClick={() => addSpot(home.id, home.name)}>Add a spot in {home.name}</button>
            </div>
          </section>
        );
      })}
      {withMe && (
        <section aria-label="With me">
          <h2 className="section-h"><span className="name">With me</span> <span className="m">{sum(inSpot(withMe.id))}</span></h2>
          {inSpot(withMe.id).length > 0 && <SpotCard id={withMe.id} name="With me" items={inSpot(withMe.id)} trees={trees} thumbs={thumbs} index={n++} />}
        </section>
      )}
      {nowhere.length > 0 && (
        <section aria-label="No spot yet">
          <h2 className="section-h"><span className="name">No spot yet</span> <span className="m">{sum(nowhere)}</span></h2>
          <SpotCard id="none" name="Not put anywhere" items={nowhere} trees={trees} thumbs={thumbs} index={n++} />
        </section>
      )}
      <div style={{ padding: '12px 14px 0' }}>
        <button type="button" className="ghost wide" onClick={addHome}>Add a home</button>
      </div>
    </>
  );
}

/** One spot: its name and count, then its first three things as rows with their kind. */
function SpotCard({ id, name, items, trees, thumbs, index }: { id: Id; name: string; items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; index: number }) {
  const lead = items.slice(0, 3);
  const n = sum(items);
  return (
    <button type="button" className="spot-card rise" style={{ '--d': `${Math.min(index, 10) * 50}ms` } as React.CSSProperties} onClick={() => go('/spot', { id })} aria-label={`${name}, ${n}`}>
      <span className="spot-head"><b className="ellipsis">{name}</b><span className="num spot-n">{n}</span><IconChev /></span>
      {lead.length > 0 && (
        <span className="spot-things" aria-hidden="true">
          {lead.map((i) => (
            <span key={i.id} className="spot-thing">
              <Mini item={i} thumb={thumbs.get(i.id)} trees={trees} size={40} />
              <span style={{ minWidth: 0 }}><span className="ellipsis">{i.name}</span><span className="m sm ellipsis">{kindName(i.kindId, trees.kinds)}</span></span>
            </span>
          ))}
          {items.length > 3 && <span className="m sm spot-more">and {items.length - 3} more</span>}
        </span>
      )}
      {!lead.length && <span className="m sm" style={{ display: 'block', paddingTop: 4 }}>Nothing here yet</span>}
    </button>
  );
}
