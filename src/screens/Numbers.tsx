import { useMemo } from 'react';
import { useItems, useMainPhotos, useTrees, useWearLog } from '../db/hooks';
import { money } from '../domain/format';
import { spend, topBrands, unpricedCount, valueRanking, type Ranked } from '../domain/numbers';
import { countAtEveryLevel } from '../domain/tree';
import type { Item } from '../domain/types';
import { go, useRoute } from '../router';
import { Numeral } from '../ui/Numeral';
import { Seg } from '../ui/Seg';
import { Piece, Window } from '../ui/Window';
import { homesWithSpots, pieceColour, SubTop, type Thumb, type Trees } from './shared';

type By = 'kind' | 'shop' | 'brand';

/** Numbers: how much there is, where it is, what it all cost, best and worst value, and brands. Reached from Home. */
export function Numbers() {
  const { params } = useRoute();
  const by = (['kind', 'shop', 'brand'].includes(params.get('by') ?? '') ? params.get('by') : 'kind') as By;
  const all = useItems();
  const trees = useTrees();
  const wear = useWearLog();
  const thumbs = useMainPhotos();
  const clothing = useMemo(() => new Set(trees?.kinds.filter((k) => k.clothing).map((k) => k.id) ?? []), [trees]);
  if (!all || !trees || !wear || !thumbs) return <main className="screen" aria-busy="true" />;

  const owned = all.filter((i) => i.status === 'owned');
  const pieces = owned.filter((i) => clothing.has(i.kindId)).reduce((n, i) => n + i.count, 0);
  const things = owned.filter((i) => !clothing.has(i.kindId)).reduce((n, i) => n + i.count, 0);
  const money_ = spend(all, by, trees);
  const unpriced = unpricedCount(all);
  const value = valueRanking(all, wear.count, trees.kinds);
  const brands = topBrands(all);

  return (
    <main className="screen numbers">
      <SubTop title="Numbers" />
      <div className="num-pair">
        <div><Numeral value={pieces} className="num-big" /><p className="caps m">{pieces === 1 ? 'piece' : 'pieces'}</p></div>
        <div><Numeral value={things} className="num-big" /><p className="caps m">{things === 1 ? 'thing' : 'things'}</p></div>
      </div>

      <h2 className="caps m section-cap">By kind</h2>
      <KindCounts items={owned} trees={trees} />

      <h2 className="caps m section-cap">By home and spot</h2>
      <PlaceCounts items={owned} trees={trees} />

      <h2 className="caps m section-cap">What it all cost</h2>
      {money_.length ? (
        <>
          <div className="spend-totals">
            {money_.map((s) => (
              <p key={s.currency} className="spend-total"><span className="m sm">{s.estimated ? 'about ' : ''}</span>{money(s.total, s.currency)}</p>
            ))}
          </div>
          {unpriced > 0 && <p className="m sm num-note">{unpriced === 1 ? '1 piece has' : `${unpriced} pieces have`} no price</p>}
          <Seg label="Spend by" value={by} onChange={(v) => go('/numbers', v === 'kind' ? {} : { by: v }, { replace: true })} options={[{ value: 'kind', label: 'By kind' }, { value: 'shop', label: 'By shop' }, { value: 'brand', label: 'By brand' }]} />
          {money_.map((s) => {
            const max = Math.max(...s.rows.map((r) => r.amount));
            return (
              <div key={s.currency} className="bars" role="list" aria-label={`Spend in ${s.currency}`}>
                {money_.length > 1 && <p className="caps m sm bars-cur">{s.currency}</p>}
                {s.rows.map((r) => (
                  <div key={r.label} className="bar-row" role="listitem">
                    <span className="bar-label">{r.label}</span>
                    <span className="bar-amt">{money(r.amount, s.currency)}</span>
                    <span className="bar" aria-hidden="true" style={{ width: `${Math.max(4, (r.amount / max) * 100)}%` }}>
                      {(r.shades.length ? r.shades : ['var(--t)']).map((c, k) => <span key={k} style={{ background: c }} />)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      ) : (
        <p className="m empty-line">Add prices to your pieces to see what it all cost.</p>
      )}

      <h2 className="caps m section-cap">Best value</h2>
      {value.best.length ? <ValueTiles list={value.best.slice(0, 3)} thumbs={thumbs} trees={trees} /> : <p className="m empty-line">Log a few wears to see best and worst value.</p>}
      {value.worst.length > 0 && (
        <>
          <h2 className="caps m section-cap">Worst value</h2>
          <ValueTiles list={value.worst.slice(0, 3)} thumbs={thumbs} trees={trees} />
        </>
      )}

      <h2 className="caps m section-cap">Brands you own most</h2>
      {brands.length ? brands.map((b) => (
        <button key={b.brand} type="button" className="li" onClick={() => go('/search', { brand: b.brand })}>
          <span>{b.brand}</span><span className="n">{b.count}</span>
        </button>
      )) : <p className="m empty-line">Add brands to your pieces to see which you own most.</p>}
      <div style={{ height: 24 }} />
    </main>
  );
}

function KindCounts({ items, trees }: { items: Item[]; trees: Trees }) {
  const counts = countAtEveryLevel(items.map((i) => ({ key: i.kindId, n: i.count })), trees.kinds, (k) => k.parentId);
  const tops = trees.kinds.filter((k) => !k.parentId && (counts.get(k.id) ?? 0) > 0).sort((a, b) => Number(b.clothing) - Number(a.clothing) || a.order - b.order);
  if (!tops.length) return <p className="m empty-line">Nothing here yet.</p>;
  return (
    <>
      {tops.map((k) => (
        <div key={k.id} className="li"><span>{k.name}</span><span className="n">{counts.get(k.id)}</span></div>
      ))}
    </>
  );
}

function PlaceCounts({ items, trees }: { items: Item[]; trees: Trees }) {
  const n = new Map<string, number>();
  for (const i of items) n.set(i.spotId ?? '', (n.get(i.spotId ?? '') ?? 0) + i.count);
  const rows: { id: string; label: string; count: number; spot: boolean }[] = [];
  for (const { home, spots } of homesWithSpots(trees.places)) {
    const inSpots = spots.reduce((s, p) => s + (n.get(p.id) ?? 0), 0);
    const total = inSpots + (n.get(home.id) ?? 0);
    if (!total) continue;
    rows.push({ id: home.id, label: home.name, count: total, spot: false });
    for (const p of spots) if (n.get(p.id)) rows.push({ id: p.id, label: p.name, count: n.get(p.id)!, spot: true });
  }
  for (const p of trees.places.filter((x) => x.role === 'withme')) if (n.get(p.id)) rows.push({ id: p.id, label: p.name, count: n.get(p.id)!, spot: false });
  if (n.get('')) rows.push({ id: 'none', label: 'No spot', count: n.get('')!, spot: false });
  if (!rows.length) return <p className="m empty-line">Nothing here yet.</p>;
  return (
    <>
      {rows.map((r) => (
        <div key={r.id} className="li" style={r.spot ? { paddingLeft: 38 } : undefined}><span className={r.spot ? 'm' : undefined}>{r.label}</span><span className="n">{r.count}</span></div>
      ))}
    </>
  );
}

/** Three small windows, each with its cost per wear under it. */
function ValueTiles({ list, thumbs, trees }: { list: Ranked[]; thumbs: Map<string, Thumb>; trees: Trees }) {
  return (
    <div className="value-row">
      {list.map((r, i) => (
        <button key={r.item.id} type="button" className="value-cell" onClick={() => go('/piece', { id: r.item.id })} aria-label={`${r.item.name}, ${r.text}`}>
          <Window className="value-win" colour={pieceColour(r.item, trees.shades)} delay={i * 50}><Piece src={thumbs.get(r.item.id)?.url} cut={thumbs.get(r.item.id)?.cut ?? true} /></Window>
          <span className="lbl" aria-hidden="true">{r.text}</span>
        </button>
      ))}
    </div>
  );
}
