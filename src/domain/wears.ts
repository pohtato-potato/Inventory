import { money } from './format';
import type { Id, Item, Kind, Outfit, Rough, StartWears, Wear } from './types';
import { daysBetween } from './wearlog';

export interface WearCount {
  n: number;
  approx: boolean;
  atLeast: boolean;
}

const MIDDLE = { never: 0, '1-5': 3, '5-20': 12, '20-50': 35, '50+': 50 } as const;

/** Wears before the app: a range uses its middle and is "about"; 50+ is "at least 50". */
export function startCount(s?: StartWears): WearCount {
  if (!s) return { n: 0, approx: false, atLeast: false };
  if ('exact' in s) return { n: Math.max(0, Math.round(s.exact)), approx: false, atLeast: false };
  return { n: MIDDLE[s.range], approx: s.range !== 'never', atLeast: s.range === '50+' };
}

/** Starting wears plus logged wears. */
export function totalWears(item: Pick<Item, 'startWears'>, logged: number): WearCount {
  const s = startCount(item.startWears);
  return { n: s.n + logged, approx: s.approx, atLeast: s.atLeast };
}

/** Price ÷ wears, in words (and the amount, for ranking). Absent (null) with no price, no wears or a free piece — never NaN, Infinity or ₹0. */
export function costPerWear(price: Rough<number> | undefined, wears: WearCount, currency = 'INR'): { text: string; value: number } | null {
  if (!price || !Number.isFinite(price.value) || price.value <= 0 || !Number.isFinite(wears.n) || wears.n <= 0) return null;
  const value = price.value / wears.n;
  const text = (() => {
    if (wears.atLeast) return `under ${money(Math.max(1, Math.ceil(value / 10) * 10), currency)} a wear`;
    if (value < 1) return `under ${money(1, currency)} a wear`;
    if (wears.approx || price.estimate) {
      const r = Math.round(value / 10) * 10;
      return r ? `about ${money(r, currency)} a wear` : `under ${money(10, currency)} a wear`;
    }
    return `${money(Math.round(value), currency)} a wear`;
  })();
  return { text, value };
}

export function wearsText(w: WearCount): string {
  return w.atLeast ? 'wears, at least' : w.approx ? 'wears, about' : w.n === 1 ? 'wear' : 'wears';
}

/** How the owned clothing fits now, counting ×N as N. */
export function fitSummary(items: Item[], kinds: Kind[]): { fits: number; tight: number; loose: number; unset: number } {
  const clothing = new Set(kinds.filter((k) => k.clothing).map((k) => k.id));
  const out = { fits: 0, tight: 0, loose: 0, unset: 0 };
  for (const i of items) {
    if (i.status !== 'owned' || i.deletedAt !== undefined || !clothing.has(i.kindId)) continue;
    out[i.fit ?? 'unset'] += i.count;
  }
  return out;
}

/** Two names, then "and N more": "Navy tee, Blue jeans and 2 more". */
export function namesLine(ids: Id[], items: Item[]): string {
  const names = ids.map((id) => items.find((i) => i.id === id)?.name).filter((n): n is string => !!n);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** A day's wear in a line: the outfit's name when it was a named outfit, else its pieces. */
export function wearLine(wear: Wear | undefined, outfits: Outfit[], items: Item[]): string {
  if (!wear) return 'Nothing logged';
  const name = wear.outfitId ? outfits.find((o) => o.id === wear.outfitId)?.name : undefined;
  return name || namesLine(wear.itemIds, items) || 'Nothing logged';
}

/** "today", "yesterday", "13 days ago" or "never logged". */
export function lastWornText(day: string | undefined, today: string): string {
  if (!day) return 'never logged';
  const n = daysBetween(day, today);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
}
