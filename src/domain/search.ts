import { descendants } from './tree';
import type { Fit, Id, Item, Kind, Place, Shade } from './types';

export interface Query {
  text?: string;
  kindId?: Id;
  shadeId?: Id;
  spotId?: Id;
  fit?: Fit;
  tag?: string;
  brand?: string;
  needsDetails?: boolean;
  gone?: boolean;
}

export interface SearchTrees {
  kinds: Kind[];
  shades: Shade[];
  places: Place[];
}

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** Whether a piece fits a query. Gone pieces show only when asked for; trashed ones never. */
export function matches(item: Item, q: Query, trees: SearchTrees): boolean {
  if (item.deletedAt !== undefined) return false;
  if (!!q.gone !== (item.status === 'gone')) return false;
  if (q.kindId && item.kindId !== q.kindId && !descendants(q.kindId, trees.kinds, (k) => k.parentId).includes(item.kindId)) return false;
  if (q.shadeId) {
    const set = new Set([q.shadeId, ...descendants(q.shadeId, trees.shades, (s) => s.familyId)]);
    if (!(item.shadeMain && set.has(item.shadeMain)) && !(item.shadeSecond && set.has(item.shadeSecond))) return false;
  }
  if (q.spotId) {
    if (q.spotId === 'none') {
      if (item.spotId) return false;
    } else {
      const set = new Set([q.spotId, ...trees.places.filter((p) => p.homeId === q.spotId).map((p) => p.id)]);
      if (!item.spotId || !set.has(item.spotId)) return false;
    }
  }
  if (q.fit && item.fit !== q.fit) return false;
  if (q.tag && !item.tags.some((t) => norm(t) === norm(q.tag!))) return false;
  if (q.brand && norm(item.brand ?? '') !== norm(q.brand)) return false;
  if (q.needsDetails && !item.needsDetails) return false;
  const words = norm(q.text ?? '').split(/[\s,]+/).filter(Boolean);
  if (words.length) {
    const name = (list: { id: Id; name: string }[], id?: Id) => (id ? list.find((x) => x.id === id)?.name ?? '' : '');
    const kind = trees.kinds.find((k) => k.id === item.kindId);
    const parent = kind?.parentId ? name(trees.kinds, kind.parentId) : '';
    const shade = trees.shades.find((s) => s.id === item.shadeMain);
    const spot = trees.places.find((p) => p.id === item.spotId);
    const hay = norm([
      item.name, item.brand, item.size, item.shop, item.fitNote, ...item.tags, ...Object.values(item.extra),
      kind?.name, parent, shade?.name, name(trees.shades, shade?.familyId ?? undefined), name(trees.shades, item.shadeSecond),
      spot?.name, name(trees.places, spot?.homeId ?? undefined), item.fit, item.condition,
    ].filter(Boolean).join(' '));
    if (!words.every((w) => hay.includes(w) || (w.endsWith('s') && hay.includes(w.slice(0, -1))))) return false;
  }
  return true;
}

/**
 * What Everything, Places and a place show: owned things, or, with the Gone filter on, only things let go.
 * Trashed things never.
 */
export function shownItems(items: Item[], opts: { gone?: boolean } = {}): Item[] {
  return items.filter((i) => i.deletedAt === undefined && (opts.gone ? i.status === 'gone' : i.status === 'owned'));
}

const KEYS = ['text', 'kindId', 'shadeId', 'spotId', 'fit', 'tag', 'brand', 'needsDetails', 'gone'] as const;
const FITS: Fit[] = ['tight', 'fits', 'loose'];

export function encodeQuery(q: Query): string {
  const p = new URLSearchParams();
  for (const k of KEYS) {
    const v = q[k];
    if (v === undefined || v === '' || v === false) continue;
    p.set(k, v === true ? '1' : String(v));
  }
  return p.toString();
}

export function decodeQuery(s: string): Query {
  const p = new URLSearchParams(s);
  const q: Query = {};
  for (const k of KEYS) {
    const v = p.get(k);
    if (v === null || v === '') continue;
    if (k === 'needsDetails' || k === 'gone') {
      if (v === '1') q[k] = true;
    } else if (k === 'fit') {
      if (FITS.includes(v as Fit)) q.fit = v as Fit;
    } else q[k] = v;
  }
  return q;
}

export function isEmptyQuery(q: Query): boolean {
  return KEYS.every((k) => (k === 'text' ? !q.text?.trim() : q[k] === undefined || q[k] === false));
}
