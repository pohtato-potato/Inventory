import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_PLACES, STARTER_SHADES } from '../src/db/seed';
import { gaps, ownedLike, stapleOwned, STARTER_STAPLES } from '../src/domain/gaps';
import type { Item } from '../src/domain/types';

const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: STARTER_PLACES };
const piece = (id: string, kindId: string, shadeMain: string, extra: Partial<Item> = {}): Item => ({
  id, name: id, kindId, shadeMain, count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: 1, updatedAt: 1, ...extra,
});
const burgundyTee = piece('burgundy-tee', 'k-tees', 's-red-maroon');
const whiteTee = piece('white-tee', 'k-tees', 's-white-white');
const offWhiteTee = piece('off-white-tee', 'k-tees', 's-white-off-white');
const goneWhiteTee = piece('gone-white-tee', 'k-tees', 's-white-white', { status: 'gone' });
const navyTee = piece('navy-tee', 'k-tees', 's-blue-navy');
const goneNavyTee = piece('gone-navy-tee', 'k-tees', 's-blue-navy', { status: 'gone' });
const navyJeans = piece('navy-jeans', 'k-jeans', 's-blue-navy');

describe('gaps (Task 8)', () => {
  const labels = (items: Item[], dismissed: string[] = []) => gaps(items, STARTER_STAPLES, dismissed, trees).map((s) => s.label);
  it('a staple you have none of is a gap', () => {
    expect(labels([burgundyTee])).toContain('White tee');
  });
  it('owning one, in any shade of the family, fills it', () => {
    expect(labels([whiteTee])).not.toContain('White tee');
    expect(labels([offWhiteTee])).not.toContain('White tee');
  });
  it('a dismissed staple stays gone; a gone piece does not count', () => {
    expect(gaps([], STARTER_STAPLES, ['white-tee'], trees).map((s) => s.id)).not.toContain('white-tee');
    expect(labels([goneWhiteTee])).toContain('White tee');
  });
  it('a staple may take one of several families', () => {
    const brownShoes = piece('brown-shoes', 'k-shoes', 's-brown-chocolate');
    expect(labels([brownShoes])).not.toContain('Brown or black leather shoes');
    expect(labels([piece('white-shoes', 'k-shoes', 's-white-white')])).toContain('Brown or black leather shoes');
  });
  it('a staple whose kind the owner has removed is never shown', () => {
    expect(gaps([], [{ id: 'x', label: 'Kilt', kind: 'Kilts' }], [], trees)).toEqual([]);
  });
  it('lists the starter staples: nine clothes and three things', () => {
    expect(STARTER_STAPLES.map((s) => s.label)).toEqual(['White tee', 'Black tee', 'White shirt', 'Blue jeans', 'Dark trousers', 'White sneakers', 'Brown or black leather shoes', 'Plain belt', 'Light jacket', 'Umbrella', 'Phone charger', 'Torch']);
  });
});

describe('stapleOwned', () => {
  it('counts what you have; a thing staple needs its word in the name', () => {
    const charger = piece('Phone charger', 'k-o-electronics', '');
    const laptop = piece('Laptop', 'k-o-electronics', '');
    const staple = STARTER_STAPLES.find((s) => s.id === 'phone-charger')!;
    expect(stapleOwned([charger, laptop], staple, trees)).toEqual([charger]);
    expect(stapleOwned([laptop], staple, trees)).toEqual([]);
    expect(stapleOwned([whiteTee, offWhiteTee, navyTee], STARTER_STAPLES[0], trees)).toHaveLength(2);
    expect(stapleOwned([], { id: 'x', label: 'Kilt', kind: 'Kilts' }, trees)).toBeNull();
  });
});

describe('ownedLike', () => {
  it('owned only; a family matches its shades; a parent kind matches its children', () => {
    expect(ownedLike([navyTee, goneNavyTee, navyJeans], { kindId: 'k-tops', shadeId: 's-blue' }, trees)).toEqual([navyTee]);
    expect(ownedLike([navyTee, navyJeans], { shadeId: 's-blue' }, trees)).toEqual([navyTee, navyJeans]);
    expect(ownedLike([navyTee], {}, trees)).toEqual([]);
  });
});
