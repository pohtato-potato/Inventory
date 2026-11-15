import { money } from './format';
import type { Item, Kind, Rough, StartWears } from './types';

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

/** Price ÷ wears, in words. Absent (null) with no price, no wears or a free piece — never NaN, Infinity or ₹0. */
export function costPerWear(price: Rough<number> | undefined, wears: WearCount, currency = 'INR'): { text: string } | null {
  if (!price || !Number.isFinite(price.value) || price.value <= 0 || !Number.isFinite(wears.n) || wears.n <= 0) return null;
  const per = price.value / wears.n;
  if (wears.atLeast) return { text: `under ${money(Math.max(1, Math.ceil(per / 10) * 10), currency)} a wear` };
  if (per < 1) return { text: `under ${money(1, currency)} a wear` };
  if (wears.approx || price.estimate) {
    const r = Math.round(per / 10) * 10;
    return { text: r ? `about ${money(r, currency)} a wear` : `under ${money(10, currency)} a wear` };
  }
  return { text: `${money(Math.round(per), currency)} a wear` };
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
