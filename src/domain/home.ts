// Home: the day's cards in a fixed order, and the year in review's rooms.
import type { Id, Item, Outfit, Place, Wear, Wish } from './types';
import { anniversaries, onThisDay, spend, type Spend } from './numbers';
import type { SearchTrees } from './search';
import { dayKey, suggestWear } from './wearlog';
import { gladDue } from './wish';

export type Card =
  | { type: 'log'; logged?: Wear; suggestion: { outfitId?: Id; itemIds: Id[] } | null }
  | { type: 'glad'; wish: Wish }
  | { type: 'needsDetails'; count: number }
  | { type: 'onThisDay'; list: { item: Item; what: 'bought' | 'worn'; years: number }[] }
  | { type: 'anniversary'; list: { item: Item; years: number }[] }
  | { type: 'recent'; items: Item[] }
  | { type: 'year'; year: number };

/** The year in review is open from 20 December to 10 January. */
export function yearOpen(today: string): boolean {
  const md = today.slice(5);
  return md >= '12-20' || md <= '01-10';
}

/** December reviews this year; January reviews the year just ended. */
export function reviewYear(today: string): number {
  const y = Number(today.slice(0, 4));
  return today.slice(5, 7) === '01' ? y - 1 : y;
}

/**
 * Home's cards, in this order, each only when it has something to show: what you wore today (always), glad you bought
 * it, pieces needing details, on this day, anniversaries, recently added, and the year in review when it is open.
 */
export function homeCards(input: { items: Item[]; wears: Wear[]; wishes: Wish[]; outfits: Outfit[]; today: string }): Card[] {
  const { items, wears, wishes, outfits, today } = input;
  const live = items.filter((i) => i.deletedAt === undefined);
  const owned = live.filter((i) => i.status === 'owned');
  const cards: Card[] = [{ type: 'log', logged: wears.find((w) => w.day === today), suggestion: suggestWear(outfits, wears, today) }];
  const glad = gladDue(wishes, today, items)[0];
  if (glad) cards.push({ type: 'glad', wish: glad });
  const nd = owned.filter((i) => i.needsDetails).length;
  if (nd) cards.push({ type: 'needsDetails', count: nd });
  const ann = anniversaries(owned, today);
  const annIds = new Set(ann.map((a) => a.item.id));
  const otd = onThisDay(live, wears, today).filter((x) => !annIds.has(x.item.id));
  if (otd.length) cards.push({ type: 'onThisDay', list: otd });
  if (ann.length) cards.push({ type: 'anniversary', list: ann });
  const recent = [...owned].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  if (recent.length) cards.push({ type: 'recent', items: recent });
  if (yearOpen(today)) cards.push({ type: 'year', year: reviewYear(today) });
  return cards;
}

/** The year in review's room for pieces with no spot. */
export const NO_SPOT: Place = { id: 'no-spot', homeId: null, name: 'No spot yet', role: 'spot', order: 1e6, updatedAt: 0 };

export interface Room {
  place: Place;
  added: number;
  wears: number;
  mostWorn?: Item;
  letGo: number;
}

/**
 * One room per home (counting its spots), each followed by its spots, then "With me". A piece belongs where it is
 * kept now (a gone piece, where it was). Added: pieces added that year; wears: wear records that year; let go: pieces
 * gone that year. Pieces with no spot get a last room, "No spot yet". Rooms with nothing that year are left out.
 */
export function yearRooms(items: Item[], wears: Wear[], places: Place[], year: number): Room[] {
  const y = String(year);
  const live = items.filter((i) => i.deletedAt === undefined);
  const worn = new Map<Id, number>();
  for (const w of wears) if (w.day.startsWith(y)) for (const id of w.itemIds) worn.set(id, (worn.get(id) ?? 0) + 1);
  const room = (place: Place, inside: Set<Id>): Room | null => {
    const here = live.filter((i) => inside.has(i.spotId ?? ''));
    let best: Item | undefined;
    let wearsN = 0;
    for (const i of here) {
      const n = worn.get(i.id) ?? 0;
      wearsN += n;
      if (n && (!best || n > (worn.get(best.id) ?? 0))) best = i;
    }
    const added = here.filter((i) => dayKey(i.createdAt).startsWith(y)).length;
    const letGo = here.filter((i) => i.status === 'gone' && i.gone?.on.startsWith(y)).length;
    if (!added && !wearsN && !letGo) return null;
    return { place, added, wears: wearsN, letGo, ...(best ? { mostWorn: best } : {}) };
  };
  const out: Room[] = [];
  const homes = places.filter((p) => p.role === 'home').sort((a, b) => a.order - b.order);
  for (const home of homes) {
    const spots = places.filter((p) => p.role === 'spot' && p.homeId === home.id).sort((a, b) => a.order - b.order);
    const h = room(home, new Set([home.id, ...spots.map((s) => s.id)]));
    if (h) out.push(h);
    for (const s of spots) {
      const r = room(s, new Set([s.id]));
      if (r) out.push(r);
    }
  }
  for (const p of places.filter((x) => x.role === 'withme')) {
    const r = room(p, new Set([p.id]));
    if (r) out.push(r);
  }
  // Pieces with no spot, or a spot that is gone, still count: they get a room of their own, last.
  const known = new Set(places.map((p) => p.id));
  const loose = room(NO_SPOT, new Set(live.filter((i) => !i.spotId || !known.has(i.spotId)).map((i) => i.spotId ?? '')));
  if (loose) out.push(loose);
  return out;
}

/**
 * The whole year: pieces added, days of wear logged, the most worn piece, and what was spent per currency on pieces
 * bought that year (by the bought date, even a rough one; with none, by when the piece was added).
 */
export function yearTotals(items: Item[], wears: Wear[], trees: SearchTrees, year: number): { added: number; wears: number; mostWorn?: Item; spend: Spend[] } {
  const y = String(year);
  const live = items.filter((i) => i.deletedAt === undefined);
  const inYear = wears.filter((w) => w.day.startsWith(y));
  const n = new Map<Id, number>();
  for (const w of inYear) for (const id of w.itemIds) n.set(id, (n.get(id) ?? 0) + 1);
  let mostWorn: Item | undefined;
  for (const i of live) if ((n.get(i.id) ?? 0) > (mostWorn ? n.get(mostWorn.id) ?? 0 : 0)) mostWorn = i;
  const bought = live.filter((i) => (i.boughtOn ? i.boughtOn.value.startsWith(y) : dayKey(i.createdAt).startsWith(y)));
  return {
    added: live.filter((i) => dayKey(i.createdAt).startsWith(y)).length,
    wears: inYear.length,
    ...(mostWorn ? { mostWorn } : {}),
    spend: spend(bought, 'kind', trees),
  };
}
