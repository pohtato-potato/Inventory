import { useMemo, useState } from 'react';
import { setSetting } from '../db/actions';
import { useItems, useMainPhotos, useSetting, useTrees, useWearLog, type Thumb, type Trees } from '../db/hooks';
import { countAtEveryLevel, descendants } from '../domain/tree';
import type { Id, Item } from '../domain/types';
import { kindOrder, sortItems, type SortBy } from '../domain/sort';
import { fitSummary } from '../domain/wears';
import { shownItems } from '../domain/search';
import { GROUP_NAME, groupColour, kindGroup, KIND_GROUPS, type KindGroup } from '../domain/kinds';
import { go, useRoute } from '../router';
import { Chips } from '../ui/Chips';
import { Numeral } from '../ui/Numeral';
import { Seg } from '../ui/Seg';
import { Sheet } from '../ui/Sheet';
import { Tile, usePress } from '../ui/Tile';
import { Cut, Swatch } from '../ui/Swatch';
import { KindIcon, NoPhoto } from '../ui/kindIcons';
import { IconDown, IconMenu, IconSearch, IconChev, IconScan, IconCamera } from '../ui/icons';
import { byId, kindName, openItem, pieceColour, Top } from './shared';
import { Selection, useSelection } from './Selection';
import { WardrobeSwitch } from './Outfits';
import { PlaceGroups } from './Places';

export type Scope = 'all' | 'clothing' | 'things';
type By = 'kind' | 'colour' | 'place';

const SCOPE = {
  all: { title: 'Everything', noun: ['thing', 'things'], path: '/everything' },
  clothing: { title: 'Wardrobe', noun: ['piece', 'pieces'], path: '/wardrobe' },
  things: { title: 'Things', noun: ['thing', 'things'], path: '/things' },
} as const;

/** Owned things in a scope (or, with `gone`, only things let go). */
export function useScopedItems(scope: Scope, trees: Trees | undefined, gone = false) {
  const clothing = useMemo(() => new Set(trees?.kinds.filter((k) => k.clothing).map((k) => k.id) ?? []), [trees]);
  const all = useItems();
  return useMemo(() => {
    if (!all || !trees) return undefined;
    return shownItems(all, { gone }).filter((i) => scope === 'all' || (scope === 'clothing') === clothing.has(i.kindId));
  }, [all, trees, clothing, scope, gone]);
}

export function Everything() { return <Browse scope="all" />; }
export function Wardrobe() { return <Browse scope="clothing" />; }
export function Things() { return <Browse scope="things" />; }

export function Browse({ scope }: { scope: Scope }) {
  const { params } = useRoute();
  const by = (params.get('by') as By) || 'kind';
  const gone = params.get('gone') === '1';
  const trees = useTrees();
  const items = useScopedItems(scope, trees, gone);
  const owned = useScopedItems(scope, trees);
  const thumbs = useMainPhotos();
  const wear = useWearLog();
  const layout = useSetting<'grid' | 'list'>('view.layout', 'grid');
  const sort = useSetting<SortBy>('view.sort', 'kind');
  const [menu, setMenu] = useState(false);
  const sel = useSelection();
  const s = SCOPE[scope];

  if (!trees || !items || !owned || !thumbs || !wear) return <main className="screen" aria-busy="true" />;

  const setBy = (v: By) => go(s.path, { ...(v === 'kind' ? {} : { by: v }), ...(gone ? { gone: '1' } : {}) }, { replace: true });
  const setGone = (on: boolean) => go(s.path, { ...(by === 'kind' ? {} : { by }), ...(on ? { gone: '1' } : {}) }, { replace: true });
  const dayOne = scope === 'all' && !owned.length && !gone;

  return (
    <main className="screen browse" style={sel.ids.size ? { paddingBottom: 'calc(var(--sheet-h, 0px) + 24px)' } : undefined}>
      {sel.ids.size ? (
        <Selection sel={sel} trees={trees} />
      ) : (
        <Header scope={scope} owned={owned} trees={trees} onMenu={() => setMenu(true)} />
      )}
      {scope === 'clothing' && !sel.ids.size && <WardrobeSwitch on="pieces" />}
      {dayOne ? <DayOne /> : (
        <>
          <Seg label="Browse by" value={by} onChange={setBy} options={[{ value: 'kind', label: 'By kind' }, { value: 'colour', label: 'By colour' }, { value: 'place', label: 'By place' }]} />
          {by === 'kind' && <ByKind scope={scope} items={items} trees={trees} thumbs={thumbs} layout={layout} sort={sort} lastWorn={wear.last} sel={sel} gone={gone} setGone={setGone} goneCount={0} />}
          {by === 'colour' && <ByColour items={items} trees={trees} thumbs={thumbs} sel={sel} />}
          {by === 'place' && <div style={{ paddingTop: 6 }}><PlaceGroups items={items} trees={trees} thumbs={thumbs} /></div>}
          {!items.length && by === 'kind' && <p className="m empty-line">{gone ? 'Nothing let go yet.' : `No ${s.noun[1]} yet.`}</p>}
        </>
      )}
      <ViewMenu open={menu} onClose={() => setMenu(false)} layout={layout} sort={sort} scope={scope} />
    </main>
  );
}

function Header({ scope, owned, trees, onMenu }: { scope: Scope; owned: Item[]; trees: Trees; onMenu: () => void }) {
  const s = SCOPE[scope];
  const total = owned.reduce((n, i) => n + i.count, 0);
  const clothes = owned.filter((i) => kindGroup(i.kindId, trees.kinds) === 'clothes').reduce((n, i) => n + i.count, 0);
  return (
    <>
      <Top title={s.title} right={
        <>
          <button type="button" className="icon-btn" aria-label="Search" onClick={() => go('/search', scope === 'all' ? {} : { scope })}><IconSearch /></button>
          <button type="button" className="icon-btn boxed" aria-label="Do I own this?" onClick={() => go('/own')}><IconScan /></button>
          <button type="button" className="icon-btn" aria-label="View and settings" onClick={onMenu}><IconMenu /></button>
        </>
      } />
      {total > 0 && (
        <div className="count-head rise">
          <Numeral value={total} className="count-num" />
          <p>
            <b>{total === 1 ? s.noun[0] : s.noun[1]} you own</b><br />
            <span className="m sm">{scope === 'all' ? `${clothes} ${clothes === 1 ? 'piece of clothing' : 'clothes'} · ${total - clothes} other ${total - clothes === 1 ? 'thing' : 'things'}` : ''}</span>
            {scope === 'clothing' && <FitNow items={owned} trees={trees} />}
          </p>
        </div>
      )}
    </>
  );
}

/** Day one: an empty app that shows where things will go. */
function DayOne() {
  return (
    <section className="dayone" aria-label="Nothing here yet">
      <p className="name dayone-title rise">Nothing here yet</p>
      <p className="m rise" style={{ '--d': '60ms' } as React.CSSProperties}>Start with what's in front of you: a shelf, a drawer, a pile of clothes. Lay a few things flat and take photos one after another.</p>
      <button type="button" className="acc wide rise" style={{ '--d': '120ms' } as React.CSSProperties} onClick={() => go('/add')}><IconCamera />Take photos</button>
      <div className="dayone-tiles" aria-hidden="true">
        {(['clothes', 'electronics', 'home', 'tools'] as KindGroup[]).map((g, i) => (
          <span key={g} className="dayone-tile" style={{ '--k': groupColour(g), animationDelay: `${i * 300}ms` } as React.CSSProperties}><KindIcon group={g} size={30} /></span>
        ))}
      </div>
    </section>
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

function ByKind({ scope, items, trees, thumbs, layout, sort, lastWorn, sel, gone, setGone }: { scope: Scope; items: Item[]; trees: Trees; thumbs: Map<Id, Thumb>; layout: 'grid' | 'list'; sort: SortBy; lastWorn: Map<Id, number>; sel: ReturnType<typeof useSelection>; gone: boolean; setGone: (on: boolean) => void; goneCount: number }) {
  const [kind, setKind] = useState<string>('all');
  const counts = useMemo(() => countAtEveryLevel(items.map((i) => ({ key: i.kindId, n: i.count })), trees.kinds, (k) => k.parentId), [items, trees]);
  const order = useMemo(() => kindOrder(trees.kinds), [trees]);
  const total = items.reduce((n, i) => n + i.count, 0);
  const groupN = new Map<KindGroup, number>();
  for (const i of items) groupN.set(kindGroup(i.kindId, trees.kinds), (groupN.get(kindGroup(i.kindId, trees.kinds)) ?? 0) + i.count);
  // Everything filters by the six kind groups; Wardrobe and Things by their own kinds, as before.
  const options = scope === 'all'
    ? KIND_GROUPS.filter((g) => groupN.get(g)).map((g) => ({ value: `g:${g}`, label: GROUP_NAME[g], count: groupN.get(g), dot: groupColour(g) }))
    : trees.kinds.filter((k) => (counts.get(k.id) ?? 0) > 0).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map((k) => ({ value: k.id, label: k.name, count: counts.get(k.id) }));
  const inKind = kind === 'all' ? items
    : kind.startsWith('g:') ? items.filter((i) => kindGroup(i.kindId, trees.kinds) === kind.slice(2))
    : items.filter((i) => i.kindId === kind || descendants(kind, trees.kinds, (k) => k.parentId).includes(i.kindId));
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
        <Chips scroll label="Kinds" value={gone ? 'gone' : kind} onChange={(v) => { if (v === 'gone') { setGone(!gone); setKind('all'); } else { if (gone) setGone(false); setKind(v === kind ? 'all' : v); } }}
          options={[{ value: 'all', label: 'All', count: gone ? undefined : total }, ...(gone ? [] : options), { value: 'gone', label: 'Gone' }]} />
      </div>
      {groups.map((g, gi) => (
        <section key={g.kindId || 'all'} aria-label={g.kindId ? kindName(g.kindId, trees.kinds) : 'Things'}>
          {g.kindId ? (
            <h2 className="section-h"><span className="dot" style={{ background: groupColour(kindGroup(g.kindId, trees.kinds)) }} aria-hidden="true" /><span className="name">{kindName(g.kindId, trees.kinds)}</span> <span className="m">{g.items.reduce((n, i) => n + i.count, 0)}</span></h2>
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
  const tap = (i: Item) => (selecting ? sel!.toggle(i.id) : openItem(i.id));
  const hold = sel ? (i: Item) => sel.toggle(i.id) : undefined;
  if (layout === 'list') {
    const shades = byId(trees.shades);
    return (
      <ul className="plist">
        {items.map((i, n) => (
          <ListRow key={i.id} item={i} thumb={thumbs.get(i.id)} colour={pieceColour(i, trees)} group={kindGroup(i.kindId, trees.kinds)} sub={[kindName(i.kindId, trees.kinds), i.shadeMain ? shades.get(i.shadeMain)?.name : undefined, i.brand].filter(Boolean).join(' · ')} onPress={() => tap(i)} onLongPress={hold ? () => hold(i) : undefined} selected={sel?.ids.has(i.id)} selecting={selecting} index={n + offset} />
        ))}
      </ul>
    );
  }
  return (
    <div className="grid">
      {items.map((i, n) => {
        const t = thumbs.get(i.id);
        return <Tile key={i.id} item={i} photo={t?.url} cut={t?.cut ?? true} colour={pieceColour(i, trees)} group={kindGroup(i.kindId, trees.kinds)} index={n + offset} onPress={() => tap(i)} onLongPress={hold ? () => hold(i) : undefined} selected={sel?.ids.has(i.id)} selecting={selecting} />;
      })}
    </div>
  );
}

function ListRow({ item, thumb, colour, group, sub, onPress, onLongPress, selected, selecting, index }: { item: Item; thumb?: Thumb; colour: string; group: KindGroup; sub: string; onPress: () => void; onLongPress?: () => void; selected?: boolean; selecting: boolean; index: number }) {
  const press = usePress(onPress, onLongPress);
  return (
    <li>
      <button type="button" className={`prow${selected ? ' sel' : ''}${selecting && !selected ? ' faded' : ''}`} aria-pressed={selecting ? !!selected : undefined} {...press}>
        <Swatch colour={colour} delay={Math.min(index, 12) * 40} dim={item.status === 'gone'} className="prow-win rise">{thumb ? <Cut src={thumb.url} cut={thumb.cut} /> : <NoPhoto group={group} size={26} />}</Swatch>
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
            <Swatch key={f.id} as="section" tone="page" colour={f.hex} delay={fi * 60} className="fam open rise" aria-label={`${f.name}, ${counts.get(f.id)}`}>
              <button type="button" className="fam-head" aria-expanded="true" onClick={() => { setOpen(null); setShade(null); }}>
                <Numeral value={counts.get(f.id) ?? 0} className="fam-num-lg" />
                <span className="b">{f.name}</span>
                <span style={{ marginLeft: 'auto' }}><IconDown /></span>
              </button>
              {shades.length > 0 && (
                <div className="chips" style={{ paddingTop: 10 }}>
                  {shades.map((s) => (
                    <button key={s.id} type="button" className={`chip${shade === s.id ? ' on' : ''}`} aria-pressed={shade === s.id} onClick={() => setShade(shade === s.id ? null : s.id)}>
                      <span className="dot" style={{ background: s.hex }} />{s.name} <span className="chip-n">{counts.get(s.id)}</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="sm tint" style={{ padding: '10px 0 8px' }}>{shown.reduce((n, i) => n + i.count, 0)} in {(shadeName ?? f.name).toLowerCase()}</p>
              <div className="fam-grid"><Pieces items={shown} trees={trees} thumbs={thumbs} sel={sel} /></div>
            </Swatch>
          );
        }
        return (
          <Swatch key={f.id} as="button" type="button" tone="page" colour={f.hex} delay={fi * 60} className="fam rise" aria-expanded="false" aria-label={`${f.name}, ${counts.get(f.id)}`} onClick={() => { setOpen(f.id); setShade(null); }}>
            <span className="num fam-num">{counts.get(f.id)}</span>
            <span className="b">{f.name}</span>
            <span className="fam-pieces">{lead.map((i) => <Cut key={i.id} src={thumbs.get(i.id)?.url} cut={thumbs.get(i.id)?.cut} />)}</span>
          </Swatch>
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

// ---------- view menu ----------

function ViewMenu({ open, onClose, layout, sort, scope }: { open: boolean; onClose: () => void; layout: 'grid' | 'list'; sort: SortBy; scope: Scope }) {
  return (
    <Sheet open={open} onClose={onClose} label="View">
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="q">
          <p className="ql">Show as</p>
          <Chips label="Show as" value={layout} onChange={(v) => void setSetting('view.layout', v)} options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'List' }]} />
        </div>
        <div className="q">
          <p className="ql">Sort by</p>
          <Chips label="Sort by" value={sort} onChange={(v) => void setSetting('view.sort', v)} options={[{ value: 'kind', label: 'Kind' }, { value: 'added', label: 'Newest' }, { value: 'lastWorn', label: 'Last worn' }, { value: 'name', label: 'Name' }]} />
        </div>
        <div style={{ display: 'grid', gap: 0, margin: '0 -18px' }}>
          {scope !== 'things' && <button type="button" className="li" onClick={() => { onClose(); go('/outfits'); }}>Outfits<span className="n"><IconChev /></span></button>}
          {scope !== 'things' && <button type="button" className="li" onClick={() => { onClose(); go('/wear'); }}>What you wore<span className="n"><IconChev /></span></button>}
          <button type="button" className="li" onClick={() => { onClose(); go('/own'); }}>Do I already own this?<span className="n"><IconChev /></span></button>
          {scope !== 'things' && <button type="button" className="li" onClick={() => { onClose(); go('/sizes'); }}>My sizes<span className="n"><IconChev /></span></button>}
          <button type="button" className="li" onClick={() => { onClose(); go('/details'); }}>Pieces that need details<span className="n"><IconChev /></span></button>
          <button type="button" className="li" onClick={() => { onClose(); go(SCOPE[scope].path, { gone: '1' }, { replace: true }); }}>Things you let go<span className="n"><IconChev /></span></button>
          <button type="button" className="li" onClick={() => { onClose(); go('/settings'); }}>Kinds, backup and trash<span className="n"><IconChev /></span></button>
        </div>
        <button type="button" className="ghost" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
