// Days and wears. A day is the phone's local calendar day, as YYYY-MM-DD.
import type { Id, Outfit, Wear } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment: a wear at 00:10 belongs to the new day. */
export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day `by` days after (or before) `day`. */
export function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + by).getTime());
}

/** Whole days from `a` to `b` (b later = positive). Calendar days, so clock changes do not matter. */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 864e5);
}

/** Milliseconds from `at` until the next local midnight (a full day when `at` is midnight). */
export function msToNextDay(at: number): number {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - at;
}

/** Local midnight of a day, for code that wants a time. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export const pairKey = (a: Id, b: Id) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Per piece: the last day worn and how many days; per pair of pieces: how many days they were worn together. */
export function wearStats(wears: Wear[]): { last: Map<Id, string>; count: Map<Id, number>; together: Map<string, number> } {
  const last = new Map<Id, string>();
  const count = new Map<Id, number>();
  const together = new Map<string, number>();
  for (const w of wears) {
    const ids = [...new Set(w.itemIds)];
    for (const id of ids) {
      count.set(id, (count.get(id) ?? 0) + 1);
      if ((last.get(id) ?? '') < w.day) last.set(id, w.day);
    }
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      together.set(k, (together.get(k) ?? 0) + 1);
    }
  }
  return { last, count, together };
}

/** A wear is this outfit when it says so, or when it holds every piece of it. */
export function wearIsOutfit(w: Wear, o: Outfit): boolean {
  if (w.outfitId === o.id) return true;
  if (!o.itemIds.length) return false;
  const has = new Set(w.itemIds);
  return o.itemIds.every((id) => has.has(id));
}

export function outfitCount(outfit: Outfit, wears: Wear[]): number {
  return wears.filter((w) => wearIsOutfit(w, outfit)).length;
}

/**
 * What to offer for today: the outfit worn most in the last 60 days, unless it was worn yesterday (then the next one);
 * with no such outfit, the last thing worn before today. Null when there is nothing to go on.
 */
export function suggestWear(outfits: Outfit[], wears: Wear[], today: string): { outfitId?: Id; itemIds: Id[] } | null {
  const recent = wears.filter((w) => w.day < today && daysBetween(w.day, today) <= 60);
  const yesterday = wears.find((w) => w.day === shiftDay(today, -1));
  const ranked = outfits
    .map((o) => ({ o, n: outfitCount(o, recent) }))
    .filter((x) => x.n > 0 && !(yesterday && wearIsOutfit(yesterday, x.o)))
    .sort((a, b) => b.n - a.n || b.o.createdAt - a.o.createdAt);
  if (ranked.length) return { outfitId: ranked[0].o.id, itemIds: ranked[0].o.itemIds };
  const last = wears.filter((w) => w.day < today && w.itemIds.length).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  return last ? { itemIds: last.itemIds } : null;
}
