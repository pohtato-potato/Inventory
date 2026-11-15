import { describe, expect, it } from 'vitest';
import { lastWornText, wearLine } from '../src/domain/wears';
import type { Item, Outfit, Wear } from '../src/domain/types';

const piece = (id: string, name: string): Item => ({ id, name, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0 });
const items = [piece('a', 'Navy tee'), piece('b', 'Blue jeans'), piece('c', 'Sneakers'), piece('d', 'Watch')];
const w: Wear = { id: 'w', day: '2026-11-15', itemIds: [], updatedAt: 0 };
const o: Outfit = { id: 'o', itemIds: ['a', 'b'], dressCodes: [], createdAt: 0, updatedAt: 0 };

describe('wearLine', () => {
  it('names two pieces and counts the rest', () => {
    expect(wearLine({ ...w, itemIds: ['a', 'b', 'c', 'd'] }, [], items)).toBe('Navy tee, Blue jeans and 2 more');
  });
  it('names one or two pieces in full', () => {
    expect(wearLine({ ...w, itemIds: ['a'] }, [], items)).toBe('Navy tee');
    expect(wearLine({ ...w, itemIds: ['a', 'b'] }, [], items)).toBe('Navy tee and Blue jeans');
  });
  it('uses a named outfit’s name', () => {
    expect(wearLine({ ...w, outfitId: o.id }, [{ ...o, name: 'Office' }], items)).toBe('Office');
  });
  it('says so when nothing is logged', () => {
    expect(wearLine(undefined, [], items)).toBe('Nothing logged');
  });
});

describe('lastWornText', () => {
  it('reads as days', () => {
    expect(lastWornText('2026-11-15', '2026-11-15')).toBe('today');
    expect(lastWornText('2026-11-14', '2026-11-15')).toBe('yesterday');
    expect(lastWornText('2026-11-02', '2026-11-15')).toBe('13 days ago');
    expect(lastWornText(undefined, '2026-11-15')).toBe('never logged');
  });
});
