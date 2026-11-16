import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { homeStats } from '../src/domain/home';
import type { Item, Wear, Wish } from '../src/domain/types';
import { dayStart } from '../src/domain/wearlog';

let n = 0;
const piece = (p: Partial<Item> = {}): Item => ({
  id: `i${++n}`, name: `Piece ${n}`, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: dayStart('2026-03-01'), updatedAt: 1, ...p,
});
const wear = (day: string, itemIds: string[] = ['x']): Wear => ({ id: `w-${day}-${itemIds.join()}`, day, itemIds, updatedAt: 0 });
const wish = (status: Wish['status']): Wish => ({ id: `w${++n}`, name: 'Loafers', tier: 'now', currency: 'INR', status, source: 'hand', createdAt: 0, updatedAt: 0 });
const base = { items: [] as Item[], kinds: STARTER_KINDS, wears: [] as Wear[], wishes: [] as Wish[], today: '2026-11-16' };

describe('homeStats: the four numbers under the date', () => {
  it('all zeros with nothing yet', () => {
    expect(homeStats(base)).toEqual({ pieces: 0, fits: 0, wornThisWeek: 0, wishes: 0 });
  });
  it('counts clothing ×N as N, and fit now the same way', () => {
    const items = [piece({ count: 3, fit: 'fits' }), piece({ fit: 'tight' }), piece({ kindId: 'k-o-unsorted', count: 5 })];
    expect(homeStats({ ...base, items })).toMatchObject({ pieces: 4, fits: 3 });
  });
  it('leaves out gone and deleted pieces', () => {
    const items = [piece({ fit: 'fits' }), piece({ status: 'gone', fit: 'fits' }), piece({ deletedAt: 5, fit: 'fits' })];
    expect(homeStats({ ...base, items })).toMatchObject({ pieces: 1, fits: 1 });
  });
  it('worn this week: distinct days in the last seven, today included, across a month', () => {
    const wears = [wear('2026-10-26'), wear('2026-10-27'), wear('2026-10-31'), wear('2026-11-02'), wear('2026-11-03')];
    expect(homeStats({ ...base, wears, today: '2026-11-02' }).wornThisWeek).toBe(3);
  });
  it('two wears on one day count as one day', () => {
    const wears = [wear('2026-11-15', ['a']), wear('2026-11-15', ['b']), wear('2026-11-16', ['c'])];
    expect(homeStats({ ...base, wears }).wornThisWeek).toBe(2);
  });
  it('open wishes only: dropped and bought are left out', () => {
    expect(homeStats({ ...base, wishes: [wish('open'), wish('open'), wish('dropped'), wish('bought')] }).wishes).toBe(2);
  });
});
