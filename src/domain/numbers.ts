// The Numbers page: what it all cost (each currency apart), best and worst value, brands, and the day's memories.
import type { Id, Item, Kind, Wear } from './types';
import type { SearchTrees } from './search';
import { costPerWear, totalWears, type WearCount } from './wears';

const live = (i: Item) => i.deletedAt === undefined;

/** The top kind a kind sits under (Tees → Tops). */
function rootKind(id: Id, kinds: Kind[]): Kind | undefined {
  let k = kinds.find((x) => x.id === id);
  for (let guard = 0; k?.parentId && guard < 20; guard++) k = kinds.find((x) => x.id === k!.parentId) ?? k;
  return k;
}

/** Relative luminance of a hex colour (WCAG). */
function luminance(hex: string): number {
  const v = (i: number) => { const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * v(0) + 0.7152 * v(1) + 0.0722 * v(2);
}
const deepestFirst = (list: string[]) => list.sort((a, b) => luminance(a) - luminance(b));

export interface Spend {
  currency: string;
  total: number;
  /** true when any price in it is a guess */
  estimated: boolean;
  /** Each row's amount and the main shades of its pieces (hex, distinct, deepest first, six at most). */
  rows: { label: string; amount: number; shades: string[] }[];
}

/**
 * What it all cost, per currency and never mixed, by kind, shop or brand. Owned and gone pieces both count as money
 * spent; trashed ones do not; pieces with no price are left out (see unpricedCount). Currencies with the most priced
 * pieces come first; rows largest first.
 */
export function spend(items: Item[], by: 'kind' | 'shop' | 'brand', trees: SearchTrees): Spend[] {
  const groups = new Map<string, { n: number; s: Spend; rows: Map<string, number>; shades: Map<string, Set<string>> }>();
  const hex = new Map(trees.shades.map((s) => [s.id, s.hex]));
  for (const i of items) {
    if (!live(i) || !i.price || !(i.price.value > 0)) continue;
    const cur = (i.currency || 'INR').toUpperCase();
    let g = groups.get(cur);
    if (!g) groups.set(cur, (g = { n: 0, s: { currency: cur, total: 0, estimated: false, rows: [] }, rows: new Map(), shades: new Map() }));
    g.n++;
    g.s.total += i.price.value;
    if (i.price.estimate) g.s.estimated = true;
    const label = by === 'kind' ? rootKind(i.kindId, trees.kinds)?.name ?? 'Other' : by === 'shop' ? i.shop?.trim() || 'No shop' : i.brand?.trim() || 'No brand';
    g.rows.set(label, (g.rows.get(label) ?? 0) + i.price.value);
    const h = i.shadeMain ? hex.get(i.shadeMain) : undefined;
    if (h) { const set = g.shades.get(label) ?? new Set(); set.add(h); g.shades.set(label, set); }
  }
  return [...groups.values()]
    .sort((a, b) => b.n - a.n || a.s.currency.localeCompare(b.s.currency))
    .map((g) => ({ ...g.s, rows: [...g.rows].map(([label, amount]) => ({ label, amount, shades: deepestFirst([...(g.shades.get(label) ?? [])]).slice(0, 6) })).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label)) }));
}

/** Pieces (owned or gone, not trashed) with no price. */
export function unpricedCount(items: Item[]): number {
  return items.filter((i) => live(i) && !(i.price && i.price.value > 0)).length;
}

export interface Ranked {
  item: Item;
  wears: WearCount;
  perWear: number;
  text: string;
}

/**
 * Best and worst value among owned clothing with a price and at least one wear, by cost per wear. One currency at a
 * time (the one most of them use). Five each at most, and a piece is never in both: with fewer than ten, the cheaper
 * half is best and the rest worst.
 */
export function valueRanking(items: Item[], counts: Map<Id, number>, kinds: Kind[]): { best: Ranked[]; worst: Ranked[] } {
  const clothing = new Set(kinds.filter((k) => k.clothing).map((k) => k.id));
  const all: Ranked[] = [];
  for (const i of items) {
    if (!live(i) || i.status !== 'owned' || !clothing.has(i.kindId)) continue;
    const wears = totalWears(i, counts.get(i.id) ?? 0);
    const c = costPerWear(i.price, wears, i.currency);
    if (c) all.push({ item: i, wears, perWear: c.value, text: c.text });
  }
  if (!all.length) return { best: [], worst: [] };
  const byCur = new Map<string, number>();
  for (const r of all) byCur.set(r.item.currency, (byCur.get(r.item.currency) ?? 0) + 1);
  const cur = [...byCur].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const list = all.filter((r) => r.item.currency === cur).sort((a, b) => a.perWear - b.perWear || a.item.name.localeCompare(b.item.name));
  const nBest = Math.min(5, Math.ceil(list.length / 2));
  const best = list.slice(0, nBest);
  const worst = list.slice(nBest).reverse().slice(0, 5);
  return { best, worst };
}

/** Brands owned most, by number of pieces, as first written (case and spaces ignored). */
export function topBrands(items: Item[], n = 5): { brand: string; count: number }[] {
  const m = new Map<string, { brand: string; count: number }>();
  for (const i of items) {
    const b = i.brand?.trim();
    if (!live(i) || i.status !== 'owned' || !b) continue;
    const key = b.toLocaleLowerCase();
    const e = m.get(key) ?? { brand: b, count: 0 };
    e.count += i.count;
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand)).slice(0, n);
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const exactDay = (i: Item) => (i.boughtOn && !i.boughtOn.estimate && /^\d{4}-\d{2}-\d{2}$/.test(i.boughtOn.value) ? i.boughtOn.value : null);

/** Whether `day` (YYYY-MM-DD) falls on this date in a year before; a 29 February falls on the 28th in other years. Returns the years since. */
function sameDate(day: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(day.slice(0, 4));
  if (years < 1) return 0;
  const md = day.slice(5);
  const tmd = today.slice(5);
  if (md === tmd) return years;
  if (md === '02-29' && tmd === '02-28' && !isLeap(Number(today.slice(0, 4)))) return years;
  return 0;
}

/** Pieces still owned, bought on this date (exact dates only) in an earlier year. */
export function anniversaries(items: Item[], today: string): { item: Item; years: number }[] {
  const out: { item: Item; years: number }[] = [];
  for (const i of items) {
    const d = exactDay(i);
    if (!live(i) || i.status !== 'owned' || !d) continue;
    const years = sameDate(d, today);
    if (years) out.push({ item: i, years });
  }
  return out.sort((a, b) => b.years - a.years);
}

/** On this day: pieces bought, then pieces worn, on this date in earlier years (most recent year first). */
export function onThisDay(items: Item[], wears: Wear[], today: string): { item: Item; what: 'bought' | 'worn'; years: number }[] {
  const byId = new Map(items.filter(live).map((i) => [i.id, i]));
  const out: { item: Item; what: 'bought' | 'worn'; years: number }[] = [];
  for (const i of byId.values()) {
    const d = exactDay(i);
    const years = d ? sameDate(d, today) : 0;
    if (years) out.push({ item: i, what: 'bought', years });
  }
  const seen = new Set<string>();
  for (const w of [...wears].sort((a, b) => b.day.localeCompare(a.day))) {
    const years = sameDate(w.day, today);
    if (!years) continue;
    for (const id of w.itemIds) {
      const item = byId.get(id);
      if (!item || seen.has(id)) continue;
      seen.add(id);
      out.push({ item, what: 'worn', years });
    }
  }
  return out.sort((a, b) => (a.what === b.what ? a.years - b.years : a.what === 'bought' ? -1 : 1));
}
