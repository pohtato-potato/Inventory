// "Do I already own this?" and the staples behind the gap hints. Both reuse search's `matches`, so a family
// matches its shades and a parent kind matches its children, exactly as search does.
import type { Id, Item } from './types';
import { matches, type SearchTrees } from './search';

/** A basic most wardrobes have. Kind and family are by name, so they follow the owner's own tree; a staple may take one of several families. */
export interface Staple {
  id: string;
  label: string;
  kind: string;
  family?: string | string[];
}

export const STARTER_STAPLES: Staple[] = [
  { id: 'white-tee', label: 'White tee', kind: 'Tees', family: 'White' },
  { id: 'black-tee', label: 'Black tee', kind: 'Tees', family: 'Black' },
  { id: 'white-shirt', label: 'White shirt', kind: 'Shirts', family: 'White' },
  { id: 'blue-jeans', label: 'Blue jeans', kind: 'Jeans', family: 'Blue' },
  { id: 'dark-trousers', label: 'Dark trousers', kind: 'Trousers', family: ['Black', 'Grey', 'Blue', 'Brown', 'Green'] },
  { id: 'white-sneakers', label: 'White sneakers', kind: 'Shoes', family: 'White' },
  { id: 'leather-shoes', label: 'Brown or black leather shoes', kind: 'Shoes', family: ['Brown', 'Black'] },
  { id: 'plain-belt', label: 'Plain belt', kind: 'Belts' },
  { id: 'light-jacket', label: 'Light jacket', kind: 'Jackets' },
];

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Owned pieces like this: of the kind (or under it) and of the shade (or in that family). Nothing asked: nothing. */
export function ownedLike(items: Item[], q: { kindId?: Id; shadeId?: Id }, trees: SearchTrees): Item[] {
  if (!q.kindId && !q.shadeId) return [];
  return items.filter((i) => i.status === 'owned' && matches(i, q, trees));
}

/** The staples you own none of, leaving out ones dismissed and ones whose kind or family no longer exists. */
export function gaps(items: Item[], staples: Staple[], dismissed: string[], trees: SearchTrees): Staple[] {
  const off = new Set(dismissed);
  return staples.filter((s) => {
    if (off.has(s.id)) return false;
    const kind = trees.kinds.find((k) => same(k.name, s.kind));
    if (!kind) return false;
    const names = s.family === undefined ? [] : Array.isArray(s.family) ? s.family : [s.family];
    const families = names.map((n) => trees.shades.find((x) => !x.familyId && same(x.name, n))).filter((x) => !!x);
    if (names.length && !families.length) return false;
    const queries = families.length ? families.map((f) => ({ kindId: kind.id, shadeId: f.id })) : [{ kindId: kind.id }];
    return !queries.some((q) => ownedLike(items, q, trees).length > 0);
  });
}
