import { describe, expect, it } from 'vitest';
import { STARTER_PLACES } from '../src/db/seed';
import { homeCards, reviewYear, yearOpen, yearRooms } from '../src/domain/home';
import type { Item, Wear, Wish } from '../src/domain/types';
import { dayStart } from '../src/domain/wearlog';

let n = 0;
const piece = (p: Partial<Item> = {}): Item => ({
  id: `i${++n}`, name: `Piece ${n}`, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: dayStart('2026-03-01'), updatedAt: 1, ...p,
});
const today = '2026-11-15';
const watch = piece({ kindId: 'k-watches', boughtOn: { value: '2021-11-15', estimate: false } });
const tee = piece();
const fresh = piece({ needsDetails: true, createdAt: dayStart('2026-11-10') });
const wish: Wish = { id: 'w', name: 'Boots', tier: 'now', currency: 'INR', status: 'bought', itemId: tee.id, boughtOn: '2026-10-01', source: 'hand', createdAt: 1, updatedAt: 1 };
const wears: Wear[] = [{ id: 'w1', day: '2025-11-15', itemIds: [tee.id], updatedAt: 1 }];
const full = { items: [watch, tee, fresh], wears, wishes: [wish], outfits: [], today };
const empty = { items: [], wears: [], wishes: [], outfits: [], today };

describe('homeCards (Task 11)', () => {
  it('nothing yet: only "what did you wear today?"', () => {
    expect(homeCards(empty).map((c) => c.type)).toEqual(['log']);
  });
  it('in a fixed order, each only when it has something', () => {
    expect(homeCards(full).map((c) => c.type)).toEqual(['log', 'glad', 'needsDetails', 'onThisDay', 'anniversary', 'recent']);
  });
  it('the year in review joins at the end from 20 December', () => {
    expect(homeCards({ ...full, today: '2026-12-25' }).at(-1)!.type).toBe('year');
  });
  it('the needs-details card counts; recent holds at most six, newest first', () => {
    const many = Array.from({ length: 8 }, (_, i) => piece({ createdAt: dayStart('2026-01-01') + i }));
    const cards = homeCards({ ...empty, items: many });
    const recent = cards.find((c) => c.type === 'recent');
    expect(recent && recent.type === 'recent' && recent.items.map((i) => i.id)).toEqual(many.slice(2).reverse().map((i) => i.id));
    const nd = homeCards(full).find((c) => c.type === 'needsDetails');
    expect(nd && nd.type === 'needsDetails' && nd.count).toBe(1);
  });
  it('a piece shown as an anniversary is not repeated on "on this day"', () => {
    const c = homeCards(full).find((x) => x.type === 'onThisDay');
    expect(c && c.type === 'onThisDay' && c.list.map((x) => x.item.id)).toEqual([tee.id]);
  });
});

describe('the year in review', () => {
  it('opens from 20 December to 10 January', () => {
    expect(yearOpen('2026-12-19')).toBe(false);
    expect(yearOpen('2026-12-20')).toBe(true);
    expect(yearOpen('2027-01-10')).toBe(true);
    expect(yearOpen('2027-01-11')).toBe(false);
  });
  it('in January it reviews the year just ended', () => {
    expect(reviewYear('2026-12-24')).toBe(2026);
    expect(reviewYear('2027-01-05')).toBe(2026);
  });
  it('one room per home, then its spots, then With me; empty rooms left out', () => {
    const home = STARTER_PLACES.find((p) => p.role === 'home')!;
    const spot = { id: 'p-shelf', homeId: home.id, name: 'Shelf', role: 'spot' as const, order: 0, updatedAt: 1 };
    const places = [...STARTER_PLACES, spot];
    const a = piece({ spotId: spot.id, createdAt: dayStart('2026-02-02') });
    const b = piece({ spotId: spot.id, createdAt: dayStart('2025-02-02') });
    const gone = piece({ spotId: spot.id, status: 'gone', gone: { on: '2026-06-01', how: 'donated' }, createdAt: dayStart('2024-01-01') });
    const old = piece({ spotId: 'p-withme', createdAt: dayStart('2020-01-01') });
    const w: Wear[] = [
      { id: 'x1', day: '2026-03-01', itemIds: [b.id], updatedAt: 1 },
      { id: 'x2', day: '2026-03-02', itemIds: [b.id, a.id], updatedAt: 1 },
      { id: 'x3', day: '2025-03-02', itemIds: [old.id], updatedAt: 1 },
    ];
    const rooms = yearRooms([a, b, gone, old], w, places, 2026);
    expect(rooms.map((r) => r.place.id)).toEqual([home.id, spot.id]);
    expect(rooms[0]).toMatchObject({ added: 1, wears: 3, letGo: 1 });
    expect(rooms[0].mostWorn!.id).toBe(b.id);
    expect(rooms.every((r) => r.added + r.wears + r.letGo > 0)).toBe(true);
  });
});

describe('yearTotals', () => {
  it('the whole year: added, wears, the most worn piece, and spend per currency on what was bought that year', async () => {
    const { yearTotals } = await import('../src/domain/home');
    const { STARTER_KINDS, STARTER_SHADES } = await import('../src/db/seed');
    const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: STARTER_PLACES };
    const a = piece({ createdAt: dayStart('2026-02-02'), boughtOn: { value: '2026-02', estimate: true }, price: { value: 1000, estimate: false } });
    const b = piece({ createdAt: dayStart('2026-02-02'), boughtOn: { value: '2019', estimate: true }, price: { value: 9000, estimate: false } });
    const c = piece({ createdAt: dayStart('2026-05-02'), price: { value: 40, estimate: false }, currency: 'USD' });
    const w: Wear[] = [
      { id: 'x1', day: '2026-03-01', itemIds: [b.id], updatedAt: 1 },
      { id: 'x2', day: '2026-03-02', itemIds: [b.id, a.id], updatedAt: 1 },
      { id: 'x3', day: '2025-03-02', itemIds: [a.id], updatedAt: 1 },
    ];
    const t = yearTotals([a, b, c], w, trees, 2026);
    expect(t).toMatchObject({ added: 3, wears: 2, mostWorn: b });
    expect(t.spend.map((s) => [s.currency, s.total])).toEqual([['INR', 1000], ['USD', 40]]);
  });
});
