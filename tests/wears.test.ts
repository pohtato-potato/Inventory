import { describe, expect, it } from 'vitest';
import { costPerWear, startCount, totalWears } from '../src/domain/wears';
import { money } from '../src/domain/format';
import type { Item } from '../src/domain/types';

const p = (value: number, estimate = false) => ({ value, estimate });

describe('startCount', () => {
  it('uses the middle of a range', () => {
    expect(startCount({ range: '1-5' })).toEqual({ n: 3, approx: true, atLeast: false });
    expect(startCount({ range: '5-20' })).toEqual({ n: 12, approx: true, atLeast: false });
    expect(startCount({ range: '20-50' })).toEqual({ n: 35, approx: true, atLeast: false });
    expect(startCount({ range: '50+' })).toEqual({ n: 50, approx: true, atLeast: true });
    expect(startCount({ range: 'never' })).toEqual({ n: 0, approx: false, atLeast: false });
    expect(startCount({ exact: 7 })).toEqual({ n: 7, approx: false, atLeast: false });
    expect(startCount(undefined)).toEqual({ n: 0, approx: false, atLeast: false });
  });
  it('adds logged wears on top', () => {
    expect(totalWears({ startWears: { range: '5-20' } } as Item, 3)).toEqual({ n: 15, approx: true, atLeast: false });
  });
});

describe('costPerWear (Review Focus 4)', () => {
  it('says "about" for a ranged count, to the nearest ₹10', () => {
    expect(costPerWear(p(6990), { n: 30, approx: true, atLeast: false })!.text).toBe('about ₹230 a wear');
  });
  it('is exact for an exact count', () => {
    expect(costPerWear(p(6990), { n: 30, approx: false, atLeast: false })!.text).toBe('₹233 a wear');
  });
  it('says "about" for an estimated price', () => {
    expect(costPerWear(p(800, true), { n: 3, approx: false, atLeast: false })!.text).toBe('about ₹270 a wear');
  });
  it('says "under" for 50+', () => {
    expect(costPerWear(p(5000), startCount({ range: '50+' }))!.text).toBe('under ₹100 a wear');
  });
  it('is absent with no price, no wears, or a free piece — never NaN, Infinity or ₹0', () => {
    expect(costPerWear(undefined, startCount({ exact: 10 }))).toBeNull();
    expect(costPerWear(p(999), startCount({ range: 'never' }))).toBeNull();
    expect(costPerWear(p(0), startCount({ exact: 10 }))).toBeNull();
    expect(costPerWear(p(Number.NaN), startCount({ exact: 10 }))).toBeNull();
  });
  it('rounds a tiny cost up instead of showing ₹0', () => {
    expect(costPerWear(p(10), startCount({ exact: 100 }))!.text).toBe('under ₹1 a wear');
  });
  it('uses the piece currency', () => {
    expect(costPerWear(p(60), { n: 4, approx: false, atLeast: false }, 'USD')!.text).toBe('$15 a wear');
  });
});

describe('money', () => {
  it('groups rupees the Indian way', () => {
    expect(money(6990, 'INR')).toBe('₹6,990');
    expect(money(150000, 'INR')).toBe('₹1,50,000');
    expect(money(12.5, 'USD')).toBe('$12.50');
  });
});
