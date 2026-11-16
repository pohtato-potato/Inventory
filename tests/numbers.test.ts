import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_PLACES, STARTER_SHADES } from '../src/db/seed';
import { anniversaries, onThisDay, spend, topBrands, unpricedCount, valueRanking } from '../src/domain/numbers';
import { costPerWear } from '../src/domain/wears';
import type { Item, Wear } from '../src/domain/types';

const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: STARTER_PLACES };
const kinds = STARTER_KINDS;
let n = 0;
const piece = (p: Partial<Item> = {}): Item => ({
  id: `i${++n}`, name: `Piece ${n}`, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: 1, updatedAt: 1, ...p,
});

describe('spend (Review Focus 4)', () => {
  const inr1000 = piece({ price: { value: 1000, estimate: false }, shop: 'Myntra', brand: 'Uniqlo' });
  const inr500est = piece({ price: { value: 500, estimate: true }, kindId: 'k-jeans', status: 'gone' });
  const usd40 = piece({ price: { value: 40, estimate: false }, currency: 'USD' });
  const noPrice = piece();
  it('totals each currency apart, never mixed, with owned and gone pieces both counted', () => {
    const s = spend([inr1000, inr500est, usd40, noPrice], 'kind', trees);
    expect(s.map((x) => [x.currency, x.total])).toEqual([['INR', 1500], ['USD', 40]]);
    expect(s[0].estimated).toBe(true);
    expect(s[1].estimated).toBe(false);
  });
  it('rows by kind use the top kind, by shop and by brand say when there is none', () => {
    expect(spend([inr1000, inr500est], 'kind', trees)[0].rows.map(({ label, amount }) => ({ label, amount }))).toEqual([{ label: 'Tops', amount: 1000 }, { label: 'Bottoms', amount: 500 }]);
    expect(spend([inr1000, inr500est], 'shop', trees)[0].rows.map(({ label, amount }) => ({ label, amount }))).toEqual([{ label: 'Myntra', amount: 1000 }, { label: 'No shop', amount: 500 }]);
    expect(spend([inr1000, inr500est], 'brand', trees)[0].rows.map((r) => r.label)).toEqual(['Uniqlo', 'No brand']);
  });
  it('a trashed piece does not count; unpriced pieces are counted apart', () => {
    expect(spend([{ ...inr1000, deletedAt: 5 }], 'kind', trees)).toEqual([]);
    expect(unpricedCount([inr1000, noPrice, { ...noPrice, id: 'x', deletedAt: 3 }])).toBe(1);
  });
});

describe('valueRanking', () => {
  const cheapWornALot = piece({ price: { value: 500, estimate: false } });
  const dearWornOnce = piece({ price: { value: 5000, estimate: false } });
  const neverWorn = piece({ price: { value: 900, estimate: false } });
  const noPrice = piece();
  const counts = new Map([[cheapWornALot.id, 50], [dearWornOnce.id, 1], [noPrice.id, 9]]);
  it('best is the lowest cost per wear; pieces never worn or unpriced are left out', () => {
    const r = valueRanking([cheapWornALot, dearWornOnce, neverWorn, noPrice], counts, kinds);
    expect(r.best[0].item.id).toBe(cheapWornALot.id);
    expect(r.worst[0].item.id).toBe(dearWornOnce.id);
    expect(r.best[0].text).toBe('₹10 a wear');
  });
  it('nothing to rank: nothing', () => {
    expect(valueRanking([neverWorn], counts, kinds)).toEqual({ best: [], worst: [] });
  });
  it('a piece is never both best and worst; five each at most', () => {
    const many = Array.from({ length: 14 }, (_, i) => piece({ price: { value: 1000 + i * 100, estimate: false } }));
    const c = new Map(many.map((p) => [p.id, 10]));
    const r = valueRanking(many, c, kinds);
    expect(r.best.length).toBe(5);
    expect(r.worst.length).toBe(5);
    expect(r.best.some((b) => r.worst.some((w) => w.item.id === b.item.id))).toBe(false);
    const two = valueRanking(many.slice(0, 3), c, kinds);
    expect(two.best.length + two.worst.length).toBe(3);
  });
  it('ranks one currency at a time: the one most pieces use', () => {
    const usd = piece({ price: { value: 1, estimate: false }, currency: 'USD' });
    const r = valueRanking([cheapWornALot, dearWornOnce, usd], new Map([...counts, [usd.id, 100]]), kinds);
    expect([...r.best, ...r.worst].some((x) => x.item.id === usd.id)).toBe(false);
  });
  it('leaves things out: only clothing', () => {
    const phone = piece({ kindId: 'k-o-electronics', price: { value: 10, estimate: false } });
    expect(valueRanking([phone], new Map([[phone.id, 100]]), kinds)).toEqual({ best: [], worst: [] });
  });
  it('costPerWear also gives the amount, for ranking', () => {
    expect(costPerWear({ value: 1000, estimate: false }, { n: 4, approx: false, atLeast: false })!.value).toBe(250);
  });
});

describe('brands, on this day, anniversaries', () => {
  it('counts brands as written, ignoring case', () => {
    const u1 = piece({ brand: 'Uniqlo' }), u2 = piece({ brand: 'uniqlo ' }), z1 = piece({ brand: 'Zara' }), noBrand = piece();
    expect(topBrands([u1, u2, z1, noBrand])[0]).toEqual({ brand: 'Uniqlo', count: 2 });
    expect(topBrands([u1, u2, z1, noBrand], 1).length).toBe(1);
  });
  const watch = piece({ kindId: 'k-watches' });
  it('anniversaries on exact bought dates only, leap days on 28 Feb', () => {
    expect(anniversaries([{ ...watch, boughtOn: { value: '2021-11-15', estimate: false } }], '2026-11-15')[0].years).toBe(5);
    expect(anniversaries([{ ...watch, boughtOn: { value: '2021', estimate: true } }], '2026-11-15')).toEqual([]);
    expect(anniversaries([{ ...watch, boughtOn: { value: '2021-11-15', estimate: true } }], '2026-11-15')).toEqual([]);
    expect(anniversaries([{ ...watch, boughtOn: { value: '2024-02-29', estimate: false } }], '2026-02-28')[0].years).toBe(2);
    expect(anniversaries([{ ...watch, boughtOn: { value: '2024-02-29', estimate: false } }], '2028-02-28')).toEqual([]);
    expect(anniversaries([{ ...watch, boughtOn: { value: '2026-11-15', estimate: false } }], '2026-11-15')).toEqual([]);
  });
  it('on this day: bought or worn on this date in earlier years', () => {
    const shirt = piece({ boughtOn: { value: '2024-11-15', estimate: false } });
    const tee = piece();
    const wears: Wear[] = [
      { id: 'w1', day: '2025-11-15', itemIds: [tee.id], updatedAt: 1 },
      { id: 'w2', day: '2026-11-15', itemIds: [tee.id], updatedAt: 1 },
      { id: 'w3', day: '2025-11-14', itemIds: [shirt.id], updatedAt: 1 },
    ];
    const got = onThisDay([shirt, tee], wears, '2026-11-15');
    expect(got.map((x) => [x.item.id, x.what, x.years])).toEqual([[shirt.id, 'bought', 2], [tee.id, 'worn', 1]]);
  });
});
