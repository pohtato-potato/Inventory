import { describe, expect, it } from 'vitest';
import { parseRoughDate, parseRoughPrice } from '../src/domain/estimate';
import { roughDateText } from '../src/domain/format';

describe('parseRoughDate', () => {
  it('reads a guessed year', () => expect(parseRoughDate('about 2023')).toEqual({ value: '2023', estimate: true }));
  it('reads a month and year', () => {
    expect(parseRoughDate('Jan 2024')).toEqual({ value: '2024-01', estimate: false });
    expect(parseRoughDate('january 2024')).toEqual({ value: '2024-01', estimate: false });
    expect(parseRoughDate('around Sept 2022')).toEqual({ value: '2022-09', estimate: true });
    expect(parseRoughDate('03/2021')).toEqual({ value: '2021-03', estimate: false });
  });
  it('reads a full date', () => {
    expect(parseRoughDate('4 Oct 2026')).toEqual({ value: '2026-10-04', estimate: false });
    expect(parseRoughDate('2026-10-04')).toEqual({ value: '2026-10-04', estimate: false });
    expect(parseRoughDate('04/10/2026')).toEqual({ value: '2026-10-04', estimate: false });
  });
  it('reads a plain year', () => expect(parseRoughDate('2019')).toEqual({ value: '2019', estimate: false }));
  it('reads "last year" as a guess', () => {
    expect(parseRoughDate('last year', new Date('2026-11-15'))).toEqual({ value: '2025', estimate: true });
    expect(parseRoughDate('3 years ago', new Date('2026-11-15'))).toEqual({ value: '2023', estimate: true });
  });
  it('refuses nonsense', () => {
    expect(parseRoughDate('soon')).toBeNull();
    expect(parseRoughDate('')).toBeNull();
    expect(parseRoughDate('31 Feb 2024')).toBeNull();
    expect(parseRoughDate('13/2024')).toBeNull();
  });
  it('shows a rough date in words', () => {
    expect(roughDateText({ value: '2024-01', estimate: false })).toBe('Jan 2024');
    expect(roughDateText({ value: '2023', estimate: true })).toBe('about 2023');
    expect(roughDateText({ value: '2026-10-04', estimate: false })).toBe('4 Oct 2026');
  });
});

describe('parseRoughPrice', () => {
  it('reads a guessed amount', () => expect(parseRoughPrice('about ₹800')).toEqual({ value: 800, estimate: true }));
  it('reads grouped digits', () => expect(parseRoughPrice('6,990')).toEqual({ value: 6990, estimate: false }));
  it('reads Rs and paise', () => {
    expect(parseRoughPrice('Rs. 1,299.00')).toEqual({ value: 1299, estimate: false });
    expect(parseRoughPrice('~1.5k')).toEqual({ value: 1500, estimate: true });
  });
  it('refuses words', () => {
    expect(parseRoughPrice('cheap')).toBeNull();
    expect(parseRoughPrice('')).toBeNull();
    expect(parseRoughPrice('-5')).toBeNull();
  });
});

describe('exact dates and prices', () => {
  const now = new Date('2026-11-15T10:00:00');
  const exact = { value: '2026-11-12', estimate: false };
  it.each(['12 Nov 2026', '12/11/2026', '2026-11-12', '12.11.2026', '12-11-2026', '12th Nov 2026', '12 November 2026', 'Nov 12, 2026', '12/11/26'])('reads %s as an exact day, day first', (s) => {
    expect(parseRoughDate(s, now)).toEqual(exact);
  });
  it('reads today and yesterday as exact days', () => {
    expect(parseRoughDate('today', now)).toEqual({ value: '2026-11-15', estimate: false });
    expect(parseRoughDate('yesterday', now)).toEqual({ value: '2026-11-14', estimate: false });
  });
  it('shows an exact day in full on the piece page', () => {
    expect(roughDateText(parseRoughDate('12/11/2026', now)!)).toBe('12 Nov 2026');
  });
  it.each(['2000', '₹2,000', '2,000.00', 'Rs 2000'])('does not mark the exact price %s as a guess', (s) => {
    expect(parseRoughPrice(s)).toEqual({ value: 2000, estimate: false });
  });
});
