import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { fieldsFor, nextNeedingDetails, singular, suggestName } from '../src/domain/fields';
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
