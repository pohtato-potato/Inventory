import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { DAY } from '../src/db/actions';
import { sortItems } from '../src/domain/sort';
import type { Item } from '../src/domain/types';

const kinds = STARTER_KINDS;
const now = new Date('2026-11-15T12:00:00').getTime();
const item = (over: Partial<Item>): Item => ({
  id: over.name ?? 'x', name: 'x', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: false, extra: {}, createdAt: now - 100 * DAY, updatedAt: now, ...over,
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
