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
