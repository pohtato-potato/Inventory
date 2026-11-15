import { useMemo, useState } from 'react';
import { addPlace, setKindHidden, updateItem, setSetting } from '../db/actions';
import { askText } from '../ui/Ask';
import { useItems, useMainPhotos, useSetting, useTrees, useWearLog, type Thumb, type Trees } from '../db/hooks';
import { countAtEveryLevel, descendants } from '../domain/tree';
import type { Id, Item } from '../domain/types';
import { kindOrder, pickWindowPiece, sortItems, type SortBy } from '../domain/window';
import { fitSummary } from '../domain/wears';
import { go, useRoute } from '../router';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { Tile, usePress } from '../ui/Tile';
import { showToast } from '../ui/Toast';
import { Piece, Window } from '../ui/Window';
import { UNKNOWN_LIGHT, windowColour } from '../ui/light';
import { IconDown, IconMenu, IconSearch, IconChev } from '../ui/icons';
import { byId, homesWithSpots, kindName, pieceColour } from './shared';
import { Selection, useSelection } from './Selection';

export type Scope = 'clothing' | 'things';
type By = 'kind' | 'colour' | 'place';

const SCOPE = {
  clothing: { title: 'Wardrobe', noun: ['piece', 'pieces'], path: '/wardrobe' },
  things: { title: 'Things', noun: ['thing', 'things'], path: '/things' },
} as const;

export function useScopedItems(scope: Scope, trees: Trees | undefined) {
  const clothing = useMemo(() => new Set(trees?.kinds.filter((k) => k.clothing).map((k) => k.id) ?? []), [trees]);
  const all = useItems();
  return useMemo(() => {
    if (!all || !trees) return undefined;
    return all.filter((i) => i.status === 'owned' && (scope === 'clothing') === clothing.has(i.kindId));
  }, [all, trees, clothing, scope]);
}

export function Browse({ scope }: { scope: Scope }) {
  const { params } = useRoute();
  const by = (params.get('by') as By) || 'kind';
  const trees = useTrees();
  const items = useScopedItems(scope, trees);
  const thumbs = useMainPhotos();
  const wear = useWearLog();
  const layout = useSetting<'grid' | 'list'>('view.layout', 'grid');
  const sort = useSetting<SortBy>('view.sort', 'kind');
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const [menu, setMenu] = useState(false);
  const sel = useSelection();
  const s = SCOPE[scope];

  if (!trees || !items || !thumbs || !wear) return <main className="screen" aria-busy="true" />;

  const total = items.reduce((n, i) => n + i.count, 0);
  const pick = pickWindowPiece(items, trees.kinds, wear.last, Date.now(), seed);
  const setBy = (v: By) => go(s.path, v === 'kind' ? {} : { by: v }, { replace: true });

  return (
    <main className="screen" style={sel.ids.size ? { paddingBottom: 'calc(var(--sheet-h, 0px) + 24px)' } : undefined}>
      {sel.ids.size ? (
        <Selection sel={sel} trees={trees} />
      ) : (
        <Header scope={scope} total={total} pick={pick} thumbs={thumbs} trees={trees} items={items} onMenu={() => setMenu(true)} />
      )}
      {items.length > 0 && (
        <>
          <Seg label="Browse by" value={by} onChange={setBy} options={[{ value: 'kind', label: 'By kind' }, { value: 'colour', label: 'By colour' }, { value: 'place', label: 'By place' }]} />
          {by === 'kind' && <ByKind items={items} trees={trees} thumbs={thumbs} layout={layout} sort={sort} lastWorn={wear.last} sel={sel} />}
          {by === 'colour' && <ByColour items={items} trees={trees} thumbs={thumbs} sel={sel} />}
          {by === 'place' && <ByPlace items={items} trees={trees} thumbs={thumbs} />}
        </>
      )}
      <ViewMenu open={menu} onClose={() => setMenu(false)} layout={layout} sort={sort} scope={scope} />
    </main>
  );
}

function Header({ scope, total, pick, thumbs, trees, items, onMenu }: { scope: Scope; total: number; items: Item[]; pick: ReturnType<typeof pickWindowPiece>; thumbs: Map<Id, Thumb>; trees: Trees; onMenu: () => void }) {
  const s = SCOPE[scope];
  const [hideSheet, setHideSheet] = useState(false);
  const press = usePress(pick ? () => go('/piece', { id: pick.item.id }) : undefined, pick ? () => setHideSheet(true) : undefined);
  const colour = pick ? pieceColour(pick.item, trees.shades) : undefined;
  const thumb = pick ? thumbs.get(pick.item.id) : undefined;
  return (
    <Window as="section" colour={colour} lit={!!pick} className={`hero hero-${scope}`} aria-label={s.title}>
      <div className="top">
        <h1 className="caps">{s.title}</h1>
        <span style={{ marginLeft: 'auto', display: 'flex' }}>
          <button type="button" className="icon-btn" aria-label="Search" onClick={() => go('/search', scope === 'things' ? { scope } : {})}><IconSearch /></button>
          <button type="button" className="icon-btn" aria-label="View and settings" onClick={onMenu}><IconMenu /></button>
        </span>
      </div>
      <div className="hero-count">
        <Numeral value={total} className="hero-num" />
        <p className="caps m">{total === 1 ? s.noun[0] : s.noun[1]}</p>
        {scope === 'clothing' && <FitNow items={items} trees={trees} />}
      </div>
      {pick ? (
        <>
          <button type="button" className="hero-piece" aria-label={`${pick.item.name}, in the window. Hold for options.`} {...press}>
            <Piece src={thumb?.url} cut={thumb?.cut} />
          </button>
          <p className="hero-why" aria-hidden="true">
            <span className="m">In the window</span>
            <br />
            <b>{pick.item.name}</b>
            <br />
            <span className="m">{pick.reason}</span>
          </p>
          <Sheet open={hideSheet} onClose={() => setHideSheet(false)} label="Window options">
            <p className="name" style={{ fontSize: 22, paddingBottom: 10 }}>{pick.item.name}</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <button type="button" className="ghost" onClick={async () => { await updateItem(pick.item.id, { hideFromWindow: true }); setHideSheet(false); showToast("It won't show in the window"); }}>Don't show this in the window</button>
              <button type="button" className="ghost" onClick={async () => { await setKindHidden(pick.item.kindId, true); setHideSheet(false); showToast(`No ${kindName(pick.item.kindId, trees.kinds).toLowerCase()} in the window`, () => void setKindHidden(pick.item.kindId, false)); }}>Don't show any {kindName(pick.item.kindId, trees.kinds).toLowerCase()}</button>
              <button type="button" className="ghost" onClick={() => setHideSheet(false)}>Cancel</button>
            </div>
          </Sheet>
        </>
      ) : (
        <div className="hero-empty">
          <p className="name" style={{ fontSize: 24 }}>Nothing here yet</p>
          <button type="button" className="acc" onClick={() => go('/add', scope === 'things' ? { scope } : {})}>Add your first {scope === 'things' ? 'thing' : 'piece'}</button>
        </div>
      )}
    </Window>
  );
}

/** "N fit now": tapping it shows what fits today. */
function FitNow({ items, trees }: { items: Item[]; trees: Trees }) {
  const n = fitSummary(items, trees.kinds).fits;
  if (!n) return null;
  return (
    <button type="button" className="fitnow" onClick={() => go('/search', { fit: 'fits' })}>
      <span className="fitnow-dot" aria-hidden="true" />{n} fit now
    </button>
  );
}

// ---------- by kind ----------

function ByKind({ items, trees, thumbs, layout, sort, lastWorn, sel }: { items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; layout: 'grid' | 'list'; sort: SortBy; lastWorn: Map<Id, number>; sel: ReturnType<typeof useSelection> }) {
  const [kind, setKind] = useState<Id | 'all'>('all');
  const counts = useMemo(() => countAtEveryLevel(items.map((i) => ({ key: i.kindId, n: i.count })), trees.kinds, (k) => k.parentId), [items, trees]);
  const order = useMemo(() => kindOrder(trees.kinds), [trees]);
  const total = items.reduce((n, i) => n + i.count, 0);
  const chipKinds = trees.kinds.filter((k) => (counts.get(k.id) ?? 0) > 0).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const inKind = kind === 'all' ? items : items.filter((i) => i.kindId === kind || descendants(kind, trees.kinds, (k) => k.parentId).includes(i.kindId));
  const sorted = sortItems(inKind, sort, { kinds: trees.kinds, lastWorn });
  const groups: { kindId: Id; items: Item[] }[] = [];
  if (sort === 'kind') {
    for (const i of sorted) {
      const g = groups.at(-1);
      if (g && g.kindId === i.kindId) g.items.push(i);
      else groups.push({ kindId: i.kindId, items: [i] });
    }
  } else groups.push({ kindId: '', items: sorted });

  return (
    <>
      <div style={{ padding: '12px 14px 0' }}>
        <Chips scroll label="Kinds" value={kind} onChange={(v) => setKind(v === kind ? 'all' : v)}
          options={[{ value: 'all' as Id, label: 'All', count: total }, ...chipKinds.map((k) => ({ value: k.id, label: k.name, count: counts.get(k.id) }))]} />
      </div>
      {groups.map((g, gi) => (
        <section key={g.kindId || 'all'} aria-label={g.kindId ? kindName(g.kindId, trees.kinds) : 'Pieces'}>
          {g.kindId ? (
            <h2 className="section-h"><span className="name">{kindName(g.kindId, trees.kinds)}</span> <span className="m">{g.items.reduce((n, i) => n + i.count, 0)}</span></h2>
          ) : <div style={{ height: 12 }} />}
          <Pieces items={g.items} trees={trees} thumbs={thumbs} layout={layout} sel={sel} offset={gi * 3} />
        </section>
      ))}
    </>
  );
}

/** A grid (three across) or list of pieces. Tap opens; hold starts selecting. */
export function Pieces({ items, trees, thumbs, layout = 'grid', sel, offset = 0 }: { items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; layout?: 'grid' | 'list'; sel?: ReturnType<typeof useSelection>; offset?: number }) {
  const selecting = !!sel && sel.ids.size > 0;
  const tap = (i: Item) => (selecting ? sel!.toggle(i.id) : go('/piece', { id: i.id }));
  const hold = sel ? (i: Item) => sel.toggle(i.id) : undefined;
  if (layout === 'list') {
    const shades = byId(trees.shades);
    return (
      <ul className="plist">
        {items.map((i, n) => (
          <ListRow key={i.id} item={i} thumb={thumbs.get(i.id)} colour={pieceColour(i, trees.shades)} sub={[kindName(i.kindId, trees.kinds), i.shadeMain ? shades.get(i.shadeMain)?.name : undefined, i.brand].filter(Boolean).join(' · ')} onPress={() => tap(i)} onLongPress={hold ? () => hold(i) : undefined} selected={sel?.ids.has(i.id)} selecting={selecting} index={n + offset} />
        ))}
      </ul>
    );
  }
  return (
    <div className="grid">
      {items.map((i, n) => {
        const t = thumbs.get(i.id);
        return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees.shades)} index={n + offset} onPress={() => tap(i)} onLongPress={hold ? () => hold(i) : undefined} selected={sel?.ids.has(i.id)} selecting={selecting} />;
      })}
    </div>
  );
}

function ListRow({ item, thumb, colour, sub, onPress, onLongPress, selected, selecting, index }: { item: Item; thumb?: Thumb; colour: string; sub: string; onPress: () => void; onLongPress?: () => void; selected?: boolean; selecting: boolean; index: number }) {
  const press = usePress(onPress, onLongPress);
  return (
    <li>
      <button type="button" className={`prow${selected ? ' sel' : ''}`} aria-pressed={selecting ? !!selected : undefined} {...press}>
        <Window colour={colour} delay={Math.min(index, 12) * 40} lit={!selecting || !!selected} className="prow-win"><Piece src={thumb?.url} cut={thumb?.cut} /></Window>
        <span style={{ minWidth: 0 }}>
          <span className="prow-name">{item.name}{item.count > 1 ? ` ×${item.count}` : ''}</span>
          <span className="m sm prow-sub">{sub}</span>
        </span>
      </button>
    </li>
  );
}

// ---------- by colour ----------

function ByColour({ items, trees, thumbs, sel }: { items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; sel: ReturnType<typeof useSelection> }) {
  const [open, setOpen] = useState<Id | null>(null);
  const [shade, setShade] = useState<Id | null>(null);
  const counts = useMemo(() => countAtEveryLevel(items.filter((i) => i.shadeMain).map((i) => ({ key: i.shadeMain!, n: i.count })), trees.shades, (s) => s.familyId), [items, trees]);
  const families = trees.shades.filter((s) => s.familyId === null && (counts.get(s.id) ?? 0) > 0);
  const famOf = (id?: Id) => (id ? (trees.shades.find((s) => s.id === id)?.familyId ?? id) : undefined);
  const noColour = items.filter((i) => !i.shadeMain);
  const openId = open && families.some((f) => f.id === open) ? open : (families[0]?.id ?? null);

  return (
    <div style={{ display: 'grid', gap: 7, padding: '12px 14px 0' }}>
      {families.map((f, fi) => {
        const inFam = items.filter((i) => famOf(i.shadeMain) === f.id);
        const lead = inFam.slice(0, 3);
        if (f.id === openId) {
          const shades = trees.shades.filter((s) => s.familyId === f.id && (counts.get(s.id) ?? 0) > 0).sort((a, b) => a.order - b.order);
          const shown = shade && shades.some((s) => s.id === shade) ? inFam.filter((i) => i.shadeMain === shade) : inFam;
          const shadeName = shade ? shades.find((s) => s.id === shade)?.name : undefined;
          return (
            <Window key={f.id} as="section" colour={f.hex} delay={fi * 80} className="fam open" aria-label={`${f.name}, ${counts.get(f.id)}`}>
              <button type="button" className="fam-head" aria-expanded="true" onClick={() => { setOpen(null); setShade(null); }}>
                <Numeral value={counts.get(f.id) ?? 0} className="fam-num-lg" />
                <span className="caps">{f.name}</span>
                <span className="m" style={{ marginLeft: 'auto' }}><IconDown /></span>
              </button>
              {shades.length > 0 && (
                <div className="chips" style={{ paddingTop: 10 }}>
                  {shades.map((s) => (
                    <button key={s.id} type="button" className={`chip${shade === s.id ? ' on' : ''}`} style={shade === s.id ? undefined : { background: '#0B0C0FAA' }} aria-pressed={shade === s.id} onClick={() => setShade(shade === s.id ? null : s.id)}>
                      <span className="dot" style={{ background: s.hex }} />{s.name} <span className="chip-n">{counts.get(s.id)}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="sm m" style={{ padding: '10px 0 8px' }}>{shown.reduce((n, i) => n + i.count, 0)} in {(shadeName ?? f.name).toLowerCase()}</p>
              <div className="fam-grid"><Pieces items={shown} trees={trees} thumbs={thumbs} sel={sel} /></div>
            </Window>
          );
        }
        return (
          <Window key={f.id} as="button" type="button" colour={f.hex} delay={100 + fi * 80} className="fam" aria-expanded="false" aria-label={`${f.name}, ${counts.get(f.id)}`} onClick={() => { setOpen(f.id); setShade(null); }}>
            <span className="num fam-num">{counts.get(f.id)}</span>
            <span className="caps">{f.name}</span>
            <span className="fam-pieces">{lead.map((i) => <Piece key={i.id} src={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut} />)}</span>
          </Window>
        );
      })}
      {noColour.length > 0 && (
        <section aria-label="No colour yet">
          <h2 className="section-h" style={{ padding: '12px 4px 8px' }}><span className="name">No colour yet</span> <span className="m">{noColour.reduce((n, i) => n + i.count, 0)}</span></h2>
          <div style={{ margin: '0 -14px' }}><Pieces items={noColour} trees={trees} thumbs={thumbs} sel={sel} /></div>
        </section>
      )}
    </div>
  );
}

// ---------- by place ----------

function ByPlace({ items, trees, thumbs }: { items: Item[]; trees: Trees; thumbs: Map<Id, Thumb> }) {
  const groups = homesWithSpots(trees.places);
  const withMe = trees.places.find((p) => p.role === 'withme');
  const inSpot = (id: Id) => items.filter((i) => i.spotId === id);
  const sum = (list: Item[]) => list.reduce((n, i) => n + i.count, 0);
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
  return (
    <>
      {groups.map(({ home, spots }) => {
        const homeItems = items.filter((i) => spots.some((s) => s.id === i.spotId));
        return (
          <section key={home.id} aria-label={home.name}>
            <h2 className="section-h"><span className="name">{home.name}</span> <span className="m">{sum(homeItems)}</span></h2>
            {spots.map((sp) => <Shelf key={sp.id} id={sp.id} name={sp.name} items={inSpot(sp.id)} trees={trees} thumbs={thumbs} />)}
            <div style={{ padding: '0 14px 6px' }}>
              <button type="button" className="ghost wide" onClick={() => addSpot(home.id, home.name)}>Add a spot in {home.name}</button>
            </div>
          </section>
        );
      })}
      {withMe && (
        <section aria-label="With me">
          <h2 className="section-h"><span className="name">With me</span> <span className="m">{sum(inSpot(withMe.id))}</span></h2>
          {inSpot(withMe.id).length > 0 && <Shelf id={withMe.id} name="With me" items={inSpot(withMe.id)} trees={trees} thumbs={thumbs} />}
        </section>
      )}
      {nowhere.length > 0 && (
        <section aria-label="No spot yet">
          <h2 className="section-h"><span className="name">No spot yet</span> <span className="m">{sum(nowhere)}</span></h2>
          <Shelf id="none" name="Not put anywhere" items={nowhere} trees={trees} thumbs={thumbs} />
        </section>
      )}
      <div style={{ padding: '12px 14px 0' }}>
        <button type="button" className="ghost wide" onClick={addHome}>Add a home</button>
      </div>
    </>
  );
}

function Shelf({ id, name, items, trees, thumbs }: { id: Id; name: string; items: Item[]; trees: Trees; thumbs: Map<Id, Thumb> }) {
  const lead = items.slice(0, 3);
  const colour = lead[0] ? pieceColour(lead[0], trees.shades) : undefined;
  const n = items.reduce((s, i) => s + i.count, 0);
  return (
    <button type="button" className="shelf" style={{ '--c': windowColour(colour ?? UNKNOWN_LIGHT) } as React.CSSProperties} onClick={() => go('/spot', { id })} aria-label={`${name}, ${n}`}>
      <span className="num shelf-num">{n}</span>
      <span className="shelf-name">{name}</span>
      <span className="shelf-pieces">{lead.map((i) => <Piece key={i.id} src={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut} />)}</span>
      <span className="m" aria-hidden="true"><IconChev /></span>
    </button>
  );
}

// ---------- view menu ----------

function ViewMenu({ open, onClose, layout, sort, scope }: { open: boolean; onClose: () => void; layout: 'grid' | 'list'; sort: SortBy; scope: Scope }) {
  return (
    <Sheet open={open} onClose={onClose} label="View">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="q">
          <p className="ql">Show as</p>
          <Chips label="Show as" value={layout} onChange={(v) => void setSetting('view.layout', v)} options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]} />
        </div>
        <div className="q">
          <p className="ql">Sort by</p>
          <Chips label="Sort by" value={sort} onChange={(v) => void setSetting('view.sort', v)} options={[{ value: 'kind', label: 'Kind' }, { value: 'added', label: 'Newest' }, { value: 'lastWorn', label: 'Last worn' }, { value: 'name', label: 'Name' }]} />
        </div>
        <div style={{ display: 'grid', gap: 0, margin: '0 -18px' }}>
          {scope === 'clothing' && <button type="button" className="li" onClick={() => { onClose(); go('/sizes'); }}>My sizes<span className="n"><IconChev /></span></button>}
          <button type="button" className="li" onClick={() => { onClose(); go('/details'); }}>Pieces that need details<span className="n"><IconChev /></span></button>
          <button type="button" className="li" onClick={() => { onClose(); go('/search', { gone: '1' }); }}>Pieces you let go<span className="n"><IconChev /></span></button>
          <button type="button" className="li" onClick={() => { onClose(); go('/settings'); }}>Kinds, backup and trash<span className="n"><IconChev /></span></button>
        </div>
        <button type="button" className="ghost" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
