import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { fieldsFor, isUnsorted, kindChoices, nextNeedingDetails, singular, suggestName } from '../src/domain/fields';
import type { Item } from '../src/domain/types';

const kinds = STARTER_KINDS;
const item = (over: Partial<Item>): Item => ({
  id: 'x', name: 'New piece', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: true, extra: {}, createdAt: 0, updatedAt: 0, ...over,
});

describe('fieldsFor', () => {
  it('gives clothing a size', () => expect(fieldsFor('k-tees', kinds)).toEqual(['size']));
  it('gives watches metal and battery', () => expect(fieldsFor('k-watches', kinds)).toEqual(expect.arrayContaining(['metal', 'battery'])));
  it('gives shoes a shoe size instead of a size', () => {
    expect(fieldsFor('k-shoes', kinds)).toContain('shoeSize');
    expect(fieldsFor('k-shoes', kinds)).not.toContain('size');
  });
  it('gives electronics a serial number only', () => expect(fieldsFor('k-o-electronics', kinds)).toEqual(['serial']));
  it('passes a parent kind\'s fields down', () => {
    const k = [...kinds, { id: 'k-sandals', parentId: 'k-shoes', name: 'Sandals', clothing: true, fields: [], order: 99, updatedAt: 0 }];
    expect(fieldsFor('k-sandals', k)).toEqual(['shoeSize']);
  });
});

describe('nextNeedingDetails', () => {
  it('takes the oldest first, skipping gone and trashed pieces', () => {
    const a1 = item({ id: 'a1', createdAt: 1 });
    const b2 = item({ id: 'b2', createdAt: 2 });
    expect(nextNeedingDetails([b2, a1])!.id).toBe(a1.id);
    expect(nextNeedingDetails([b2, { ...a1, deletedAt: 5 }])!.id).toBe('b2');
    expect(nextNeedingDetails([{ ...b2, needsDetails: false }])).toBeUndefined();
  });
});

describe('names', () => {
  it('makes a kind singular', () => {
    expect(singular('Tees')).toBe('Tee');
    expect(singular('Watches')).toBe('Watch');
    expect(singular('Jeans')).toBe('Jeans');
    expect(singular('Knitwear')).toBe('Knitwear');
  });
  it('suggests a name from shade and kind', () => expect(suggestName('Navy', 'Tees')).toBe('Navy tee'));
});

describe('kindChoices', () => {
  const tees = (n: number, kindId: string) => Array.from({ length: n }, (_, i) => item({ id: `${kindId}${i}`, kindId, needsDetails: false }));
  it('starts with the last kind used, then the kinds you own most, then the usual ones', () => {
    const items = [...tees(5, 'k-jeans'), ...tees(3, 'k-shirts'), ...tees(9, 'k-o-tools')];
    const c = kindChoices({ items, kinds, last: 'k-tees', clothing: true, n: 6 });
    expect(c[0]).toBe('k-tees');
    expect(c.slice(1, 3)).toEqual(['k-jeans', 'k-shirts']);
    expect(c).toHaveLength(6);
    expect(new Set(c).size).toBe(6);
    expect(c.every((id) => kinds.find((k) => k.id === id)!.clothing)).toBe(true);
  });
  it('never offers "Not sorted yet", a parent group or a removed kind', () => {
    const removed = kinds.map((k) => (k.id === 'k-shirts' ? { ...k, deletedAt: 1 } : k));
    const c = kindChoices({ items: tees(4, 'k-unsorted'), kinds: removed, last: 'k-unsorted', clothing: true, n: 8 });
    expect(c).not.toContain('k-unsorted');
    expect(c).not.toContain('k-tops');
    expect(c).not.toContain('k-shirts');
  });
  it('knows a piece that is not sorted yet', () => {
    expect(isUnsorted('k-unsorted')).toBe(true);
    expect(isUnsorted('k-o-unsorted')).toBe(true);
    expect(isUnsorted('k-tees')).toBe(false);
  });
});
