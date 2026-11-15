import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { DAY } from '../src/db/actions';
import { pickWindowPiece, sortItems } from '../src/domain/window';
import type { Item } from '../src/domain/types';

const kinds = STARTER_KINDS;
const now = new Date('2026-11-15T12:00:00').getTime();
const item = (over: Partial<Item>): Item => ({
  id: over.name ?? 'x', name: 'x', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: false, extra: {}, createdAt: now - 100 * DAY, updatedAt: now, ...over,
});
const jacket13DaysAgo = item({ name: 'Leather jacket', kindId: 'k-jackets' });
const tee1DayAgo = item({ name: 'Tee' });
const newHeadphones = item({ name: 'Headphones', kindId: 'k-o-electronics', createdAt: now - DAY });
const socks = item({ name: 'Socks', kindId: 'k-socks', createdAt: now - 3 * 3600_000 });
const goneJeans = item({ name: 'Old jeans', kindId: 'k-jeans', status: 'gone' });
const worn = new Map([[jacket13DaysAgo.id, now - 13 * DAY], [tee1DayAgo.id, now - DAY]]);

describe('pickWindowPiece', () => {
  it('shows the clothing piece unworn longest when it is over 10 days', () => {
    expect(pickWindowPiece([jacket13DaysAgo, tee1DayAgo], kinds, worn, now, 1)).toMatchObject({ item: { name: 'Leather jacket' }, reason: 'not worn for 13 days' });
  });
  it('shows something just added first', () => {
    expect(pickWindowPiece([newHeadphones], kinds, worn, now, 1)!.reason).toBe('added yesterday');
    const today = item({ name: 'New tee', createdAt: now - 3600_000 });
    expect(pickWindowPiece([jacket13DaysAgo, today], kinds, worn, now, 1)!).toMatchObject({ item: { name: 'New tee' }, reason: 'added today' });
  });
  it('falls back to a random piece, the same one for the same seed', () => {
    const a = pickWindowPiece([tee1DayAgo, item({ name: 'B' }), item({ name: 'C' })], kinds, worn, now, 7)!;
    expect(a.reason).toBe('from your wardrobe');
    expect(pickWindowPiece([tee1DayAgo, item({ name: 'B' }), item({ name: 'C' })], kinds, worn, now, 7)!.item.name).toBe(a.item.name);
    expect(pickWindowPiece([item({ name: 'Drill', kindId: 'k-o-tools' })], kinds, worn, now, 7)!.reason).toBe('from your things');
  });
  it('never shows a kind hidden from the window, a hidden piece, or a gone piece', () => {
    expect(pickWindowPiece([socks], kinds, worn, now, 1)).toBeNull();
    expect(pickWindowPiece([{ ...jacket13DaysAgo, hideFromWindow: true }], kinds, worn, now, 1)).toBeNull();
    expect(pickWindowPiece([goneJeans], kinds, worn, now, 1)).toBeNull();
    expect(pickWindowPiece([{ ...tee1DayAgo, deletedAt: now }], kinds, worn, now, 1)).toBeNull();
  });
  it('hides a kind when its parent is hidden', () => {
    const k = kinds.map((x) => (x.id === 'k-tops' ? { ...x, hideFromWindow: true } : x));
    expect(pickWindowPiece([tee1DayAgo], k, worn, now, 1)).toBeNull();
  });
});

describe('sortItems', () => {
  const a = item({ name: 'apple', kindId: 'k-jeans', createdAt: now - 3 * DAY });
  const b = item({ name: 'Banana', kindId: 'k-tees', createdAt: now - DAY });
  const c = item({ name: 'cherry', kindId: 'k-shoes', createdAt: now - 2 * DAY });
  const ctx = { kinds, lastWorn: new Map([[c.id, now - DAY], [a.id, now - 5 * DAY]]) };
  it('sorts by name, ignoring case', () => expect(sortItems([c, b, a], 'name', ctx).map((i) => i.name)).toEqual(['apple', 'Banana', 'cherry']));
  it('sorts newest first', () => expect(sortItems([a, c, b], 'added', ctx).map((i) => i.name)).toEqual(['Banana', 'cherry', 'apple']));
  it('sorts by the kinds tree order', () => expect(sortItems([c, a, b], 'kind', ctx).map((i) => i.name)).toEqual(['Banana', 'apple', 'cherry']));
  it('sorts most recently worn first, never-worn last', () => expect(sortItems([b, a, c], 'lastWorn', ctx).map((i) => i.name)).toEqual(['cherry', 'apple', 'Banana']));
});
