import { ancestors } from './tree';
import type { FieldKey, Id, Item, Kind } from './types';

export const FIELD_LABEL: Record<FieldKey, string> = {
  size: 'Size',
  shoeSize: 'Shoe size',
  serial: 'Serial number',
  metal: 'Metal',
  battery: 'Battery',
};

/** The extra fields a kind shows: its own and every parent's, plus a size for any clothing (shoes have a shoe size instead). */
export function fieldsFor(kindId: Id, kinds: Kind[]): FieldKey[] {
  const byId = new Map(kinds.map((k) => [k.id, k]));
  const chain = [kindId, ...ancestors(kindId, kinds, (k) => k.parentId)].map((id) => byId.get(id)).filter((k): k is Kind => !!k);
  const own: FieldKey[] = [];
  for (const k of chain) for (const f of k.fields) if (!own.includes(f)) own.push(f);
  const clothing = byId.get(kindId)?.clothing ?? false;
  return clothing && !own.includes('shoeSize') && !own.includes('size') ? ['size', ...own] : own;
}

/** The oldest piece still waiting for its details. */
export function nextNeedingDetails(items: Item[]): Item | undefined {
  return items.filter((i) => i.needsDetails && i.status === 'owned' && i.deletedAt === undefined).sort((a, b) => a.createdAt - b.createdAt)[0];
}

const KEEP = new Set(['jeans', 'trousers', 'shorts', 'knitwear', 'innerwear', 'ethnic', 'other', 'tools', 'home', 'electronics', 'bags and luggage', 'accessories']);

/** "Tees" → "Tee", "Watches" → "Watch"; pair words and mass nouns stay. */
export function singular(kind: string): string {
  const k = kind.toLowerCase();
  if (KEEP.has(k)) return kind;
  if (/(ch|sh|x|ss)es$/i.test(kind)) return kind.slice(0, -2);
  if (/s$/i.test(kind) && !/ss$/i.test(kind)) return kind.slice(0, -1);
  return kind;
}

/** "Navy" + "Tees" → "Navy tee". */
export function suggestName(shade: string | undefined, kind: string): string {
  const k = singular(kind);
  return shade ? `${shade} ${k.toLowerCase()}` : k;
}

/** Where a new shot waits until the owner says what it is. One for clothes, one for things; never offered as a choice. */
export const UNSORTED = { clothing: 'k-unsorted', things: 'k-o-unsorted' } as const;
export const UNSORTED_NAME = 'Not sorted yet';

export function isUnsorted(kindId: Id): boolean {
  return kindId === UNSORTED.clothing || kindId === UNSORTED.things;
}

const USUAL = {
  clothing: ['k-tees', 'k-shirts', 'k-jeans', 'k-trousers', 'k-shoes', 'k-jackets', 'k-knitwear', 'k-shorts'],
  things: ['k-o-electronics', 'k-o-bags-and-luggage', 'k-o-tools', 'k-o-home', 'k-o-other'],
};

/**
 * The kinds offered first when saying what a piece is: the last one used, then the ones the owner has most of,
 * then the usual ones, then the rest in order. Only kinds a piece can be (no parent groups, nothing removed, not "Not sorted yet").
 */
export function kindChoices({ items, kinds, last, clothing, n }: { items: Item[]; kinds: Kind[]; last?: Id; clothing: boolean; n: number }): Id[] {
  const live = kinds.filter((k) => !k.deletedAt);
  const parents = new Set(live.map((k) => k.parentId).filter(Boolean));
  const ok = new Set(live.filter((k) => k.clothing === clothing && !parents.has(k.id) && !isUnsorted(k.id)).map((k) => k.id));
  const owned = new Map<Id, number>();
  for (const i of items) if (ok.has(i.kindId) && i.status === 'owned' && !i.deletedAt) owned.set(i.kindId, (owned.get(i.kindId) ?? 0) + i.count);
  const byOwned = [...owned.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const rest = live.filter((k) => ok.has(k.id)).sort((a, b) => a.order - b.order).map((k) => k.id);
  const out: Id[] = [];
  for (const id of [...(last ? [last] : []), ...byOwned, ...USUAL[clothing ? 'clothing' : 'things'], ...rest]) {
    if (ok.has(id) && !out.includes(id)) out.push(id);
    if (out.length === n) break;
  }
  return out;
}
