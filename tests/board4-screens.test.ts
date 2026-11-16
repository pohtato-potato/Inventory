import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_PLACES, STARTER_SHADES } from '../src/db/seed';
import { likeWords, ownLine } from '../src/domain/gaps';
import { yearRooms, yearTotals } from '../src/domain/home';
import { spend } from '../src/domain/numbers';
import type { Item, Outfit, Wear, Wish } from '../src/domain/types';
import { dayStart, suggestWords } from '../src/domain/wearlog';
import { addedText } from '../src/domain/wish';

let n = 0;
const piece = (p: Partial<Item> = {}): Item => ({
  id: `i${++n}`, name: `Piece ${n}`, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: dayStart('2026-03-01'), updatedAt: 1, ...p,
});
const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: STARTER_PLACES };
const wear = (day: string, itemIds: string[], outfitId?: string): Wear => ({ id: day, day, itemIds, outfitId, updatedAt: 0 });

describe('suggestWords: why today’s suggestion is offered', () => {
  const office: Outfit = { id: 'o', itemIds: ['tee', 'jeans'], dressCodes: [], createdAt: 0, updatedAt: 0 };
  const s = { outfitId: 'o', itemIds: office.itemIds };
  const today = '2026-11-16'; // a Monday
  it('worn on the last two Mondays: your usual, same as last Monday', () => {
    const w = [wear('2026-11-02', office.itemIds, 'o'), wear('2026-11-09', office.itemIds, 'o')];
    expect(suggestWords(s, [office], w, today)).toEqual({ home: 'Your usual for a Monday', question: 'Same as last Monday?' });
  });
  it('worn on Mondays but not last week: your usual', () => {
    const w = [wear('2026-10-26', office.itemIds, 'o'), wear('2026-11-02', office.itemIds, 'o'), wear('2026-11-10', office.itemIds, 'o')];
    expect(suggestWords(s, [office], w, today)).toEqual({ home: 'Your usual for a Monday', question: 'Your usual for a Monday?' });
  });
  it('an outfit worn often, on other days: your most worn lately', () => {
    const w = [wear('2026-11-11', office.itemIds, 'o'), wear('2026-11-12', office.itemIds, 'o')];
    expect(suggestWords(s, [office], w, today)).toEqual({ home: 'Your most worn lately', question: 'Your most worn lately?' });
  });
  it('only the last day to go on: same as last time', () => {
    expect(suggestWords({ itemIds: ['tee'] }, [], [wear('2026-11-14', ['tee'])], today)).toEqual({ home: 'What you wore last time', question: 'Same as last time?' });
  });
});

describe('spend bars carry the shades of their pieces', () => {
  it('one per distinct main shade, deepest first, six at most; pieces with no shade add none', () => {
    const shades = ['s-white-white', 's-black-jet', 's-blue-navy', 's-black-jet', 's-red-burgundy', 's-grey-slate', 's-green-olive', 's-yellow-lemon'];
    const items = [...shades.map((shadeMain) => piece({ shadeMain, price: { value: 100, estimate: false } })), piece({ price: { value: 100, estimate: false } })];
    const row = spend(items, 'kind', trees)[0].rows[0];
    expect(row.label).toBe('Tops');
    expect(row.shades).toHaveLength(6);
    expect(row.shades[0]).toBe('#0E0E10');
    expect(row.shades).not.toContain('#F7F7F5'); // white, the palest of seven
    expect(new Set(row.shades).size).toBe(6);
  });
});

describe('wishes say when they were added', () => {
  it('"added 2 Nov"; another year carries the year', () => {
    const w: Wish = { id: 'w', name: 'Loafers', tier: 'now', currency: 'INR', status: 'open', source: 'hand', createdAt: dayStart('2026-11-02') + 3600_000, updatedAt: 0 };
    expect(addedText(w, '2026-11-16')).toBe('added 2 Nov');
    expect(addedText({ ...w, createdAt: dayStart('2025-12-30') }, '2026-11-16')).toBe('added 30 Dec 2025');
  });
});

describe('"Do I already own this?" in words', () => {
  it('names the kind and colour, singular for one', () => {
    expect(likeWords('Tees', 'White', 3)).toBe('white tees already yours');
    expect(likeWords('Tees', 'White', 1)).toBe('white tee already yours');
    expect(likeWords('Jeans', 'Blue', 1)).toBe('blue jeans already yours');
    expect(likeWords('Watches', undefined, 1)).toBe('watch already yours');
    expect(likeWords(undefined, 'Black', 2)).toBe('black pieces already yours');
  });
  it('a line per piece: how it fits when not "fits", else times worn', () => {
    expect(ownLine(piece({ fit: 'tight' }), 12)).toBe('tight now');
    expect(ownLine(piece({ fit: 'fits' }), 41)).toBe('worn 41 times');
    expect(ownLine(piece(), 1)).toBe('worn once');
    expect(ownLine(piece(), 0)).toBe('not worn yet');
  });
});

describe('the year in review’s numbers', () => {
  const spot = { id: 'p-rail', homeId: 'p-home', name: 'Rail', role: 'spot' as const, order: 0, updatedAt: 0 };
  it('a room says how many wears its most worn piece had', () => {
    const a = piece({ spotId: spot.id }), b = piece({ spotId: spot.id });
    const w = [wear('2026-05-01', [a.id, b.id]), wear('2026-05-02', [a.id])];
    expect(yearRooms([a, b], w, [...STARTER_PLACES, spot], 2026).find((r) => r.place.id === spot.id)).toMatchObject({ mostWorn: a, mostWornN: 2 });
  });
  it('the whole year: let go, outfits saved, and the most worn piece’s days', () => {
    const a = piece(), gone = piece({ status: 'gone', gone: { on: '2026-06-01', how: 'donated' } });
    const outfits: Outfit[] = [{ id: 'o', itemIds: [a.id], dressCodes: [], createdAt: dayStart('2026-04-01'), updatedAt: 0 }, { id: 'p', itemIds: [a.id], dressCodes: [], createdAt: dayStart('2025-04-01'), updatedAt: 0 }];
    const t = yearTotals([a, gone], [wear('2026-05-01', [a.id]), wear('2026-05-02', [a.id])], trees, 2026, outfits);
    expect(t).toMatchObject({ letGo: 1, outfitsSaved: 1, mostWorn: a, mostWornN: 2 });
  });
});
