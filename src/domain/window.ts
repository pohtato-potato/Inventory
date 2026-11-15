import { ancestors } from './tree';
import type { Id, Item, Kind } from './types';

const DAY = 24 * 60 * 60 * 1000;

function dayNumber(t: number): number {
  const d = new Date(t);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY + 0.5);
}

/** Whether a kind, or any kind above it, is marked "don't show in the window". */
export function kindHidden(kindId: Id, kinds: Kind[]): boolean {
  const byId = new Map(kinds.map((k) => [k.id, k]));
  return [kindId, ...ancestors(kindId, kinds, (k) => k.parentId)].some((id) => byId.get(id)?.hideFromWindow);
}

export function isClothing(kindId: Id, kinds: Kind[]): boolean {
  return kinds.find((k) => k.id === kindId)?.clothing ?? false;
}

/** A small seeded random number generator (mulberry32). */
function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The piece shown large at the top of Wardrobe and Things, and why:
 * added today or yesterday; else the clothing piece unworn longest, if over 10 days;
 * else a random piece (the same one for the same seed).
 */
export function pickWindowPiece(items: Item[], kinds: Kind[], lastWorn: Map<Id, number>, now: number, seed: number): { item: Item; reason: string } | null {
  const pool = items.filter((i) => i.status === 'owned' && i.deletedAt === undefined && !i.hideFromWindow && !kindHidden(i.kindId, kinds));
  if (!pool.length) return null;

  const today = dayNumber(now);
  const fresh = pool.filter((i) => today - dayNumber(i.createdAt) <= 1 && i.createdAt <= now).sort((a, b) => b.createdAt - a.createdAt);
  if (fresh.length) {
    const i = fresh[0];
    return { item: i, reason: dayNumber(i.createdAt) === today ? 'added today' : 'added yesterday' };
  }

  const unworn = pool
    .filter((i) => isClothing(i.kindId, kinds) && lastWorn.has(i.id))
    .map((i) => ({ i, days: Math.floor((now - lastWorn.get(i.id)!) / DAY) }))
    .sort((a, b) => b.days - a.days)[0];
  if (unworn && unworn.days > 10) return { item: unworn.i, reason: `not worn for ${unworn.days} days` };

  const r = rand(seed)();
  const sorted = [...pool].sort((a, b) => (a.id < b.id ? -1 : 1));
  const item = sorted[Math.floor(r * sorted.length)];
  return { item, reason: isClothing(item.kindId, kinds) ? 'from your wardrobe' : 'from your things' };
}

export type SortBy = 'kind' | 'added' | 'lastWorn' | 'name';

export function sortItems(items: Item[], by: SortBy, ctx: { kinds: Kind[]; lastWorn: Map<Id, number> } = { kinds: [], lastWorn: new Map() }): Item[] {
  const list = [...items];
  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (by === 'name') return list.sort(byName);
  if (by === 'added') return list.sort((a, b) => b.createdAt - a.createdAt);
  if (by === 'lastWorn') return list.sort((a, b) => (ctx.lastWorn.get(b.id) ?? -1) - (ctx.lastWorn.get(a.id) ?? -1) || byName(a, b));
  const order = kindOrder(ctx.kinds);
  return list.sort((a, b) => (order.get(a.kindId) ?? 1e9) - (order.get(b.kindId) ?? 1e9) || byName(a, b));
}

/** Kinds in tree order (parent, then its children), for grouping a grid by kind. */
export function kindOrder(kinds: Kind[]): Map<Id, number> {
  const out = new Map<Id, number>();
  const kids = (p: Id | null) => kinds.filter((k) => k.parentId === p && !k.deletedAt).sort((a, b) => a.order - b.order);
  let n = 0;
  const walk = (p: Id | null, depth: number) => {
    if (depth > 10) return;
    for (const k of kids(p)) {
      if (out.has(k.id)) continue;
      out.set(k.id, n++);
      walk(k.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
