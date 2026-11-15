import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseReceipt } from '../src/read/parse';

const fx = (name: string) => readFileSync(`tests/fixtures/receipts/${name}.txt`, 'utf8');
const myntra = fx('myntra'), amazon = fx('amazon'), bill = fx('bill'), nonsense = fx('nonsense');

describe('parseReceipt', () => {
  it('reads a Myntra order screen', () => {
    expect(parseReceipt(myntra)).toMatchObject({ shop: 'Myntra', price: 1299, size: 'M', date: '2026-10-04' });
    expect(parseReceipt(myntra).name).toMatch(/T-shirt/);
  });
  it('reads an Amazon order screen', () => {
    expect(parseReceipt(amazon)).toMatchObject({ shop: 'Amazon', price: 2499, date: '2026-09-12' });
    expect(parseReceipt(amazon).name).toMatch(/Headphones/);
  });
  it('reads the total of a printed bill, not a line item or the GST line', () => {
    const r = parseReceipt(bill);
    expect(r.price).toBe(3450);
    expect(r.date).toBe('2026-09-21');
    expect(r.shop).toBe("Levi's");
  });
  it('copes with the reader mistaking ₹ for a 3 (seen on a real read)', () => {
    expect(parseReceipt('Total Order Price 31,299\nPaid by UPI').price).toBe(1299);
    expect(parseReceipt('Grand Total: 32,499.00').price).toBe(2499);
    expect(parseReceipt('TOTAL 3450.00').price).toBe(3450);
    expect(parseReceipt('Grand Total: ₹31,299').price).toBe(31299);
  });
  it('never invents values', () => {
    expect(parseReceipt(nonsense)).toEqual({});
    expect(parseReceipt('')).toEqual({});
  });
});
