// Sorting things for a grid, and the kinds tree in order.
import type { Id, Item, Kind } from './types';

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
