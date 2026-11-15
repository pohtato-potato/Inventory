import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { laneOf, layout, pairedFirst, placeIn } from '../src/domain/outfit';
import { pairKey } from '../src/domain/wearlog';
import type { Id, Item } from '../src/domain/types';

const kinds = STARTER_KINDS;
const piece = (id: string, kindId: string, extra: Partial<Item> = {}): Item => ({
  id, name: id, kindId, count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0, ...extra,
});
const tee = piece('tee', 'k-tees'), otherTee = piece('tee2', 'k-tees'), shirt = piece('shirt', 'k-shirts'), jacket = piece('jacket', 'k-jackets');
const jeans = piece('jeans', 'k-jeans'), sneakers = piece('sneakers', 'k-shoes'), loafers = piece('loafers', 'k-shoes');
const watch = piece('watch', 'k-watches'), band = piece('band', 'k-bracelets'), bangle = piece('bangle', 'k-bracelets');
const items = [tee, otherTee, shirt, jacket, jeans, sneakers, loafers, watch, band, bangle];
const aspect = new Map<Id, number>(items.map((i) => [i.id, 1.2]));

describe('layout', () => {
  const p = layout([tee, jeans, sneakers, watch], kinds, aspect);
  const w = (id: Id) => p.find((x) => x.itemId === id)!;
  it('keeps true proportions: shoes smaller than jeans, a watch small', () => {
    expect(w(sneakers.id).w).toBeLessThan(w(jeans.id).w);
    expect(w(watch.id).w).toBeLessThan(0.2);
  });
  it('stands head to toe, with the watch at the wrist beside the top', () => {
    expect(w(tee.id).y).toBeLessThan(w(jeans.id).y);
    expect(w(jeans.id).y).toBeLessThan(w(sneakers.id).y);
    expect(w(watch.id).x).toBeLessThan(w(tee.id).x);
  });
  it('honours the owner’s size correction', () => {
    expect(layout([{ ...tee, outfitScale: 1.2 }], kinds, aspect)[0].w).toBeCloseTo(1.2 * layout([tee], kinds, aspect)[0].w);
  });
  it('stacks the top layers: outer over over over under', () => {
    expect(layout([jacket, shirt, tee], kinds, aspect).map((x) => x.z)).toEqual([3, 2, 1]);
  });
  it('a gone or deleted piece is marked gone (Review Focus 2)', () => {
    expect(layout([{ ...jeans, status: 'gone' }], kinds, aspect)[0].gone).toBe(true);
    expect(layout([{ ...jeans, deletedAt: 5 }], kinds, aspect)[0].gone).toBe(true);
  });
  it('puts two wrist pieces on opposite wrists', () => {
    const q = layout([tee, watch, band], kinds, aspect);
    expect(q[1].x).toBeLessThan(0.5);
    expect(q[2].x).toBeGreaterThan(0.5);
  });
  it('a kind with no lane falls back to its parent’s, then stands at the side', () => {
    const kurta = { id: 'k-kurtas', parentId: null, name: 'Kurtas', clothing: true, fields: [], order: 50, updatedAt: 0 };
    const linen = { id: 'k-linen', parentId: 'k-shirts', name: 'Linen', clothing: true, fields: [], order: 51, updatedAt: 0 };
    expect(laneOf('k-linen', [...kinds, linen]).lane).toBe('top');
    expect(laneOf('k-kurtas', [...kinds, kurta]).lane).toBe('carry');
  });
});

describe('placeIn', () => {
  it('an over layer joins an under layer in the top lane', () => {
    expect(placeIn([tee.id], shirt, items, kinds)).toEqual([tee.id, shirt.id]);
  });
  it('the same lane and layer replaces', () => {
    expect(placeIn([tee.id], otherTee, items, kinds)).toEqual([otherTee.id]);
    expect(placeIn([sneakers.id, jeans.id], loafers, items, kinds)).toEqual([jeans.id, loafers.id]);
  });
  it('wrists hold two; a third replaces the oldest', () => {
    expect(placeIn([watch.id], band, items, kinds)).toEqual([watch.id, band.id]);
    expect(placeIn([watch.id, band.id], bangle, items, kinds)).toEqual([band.id, bangle.id]);
  });
  it('tapping a chosen piece takes it out', () => {
    expect(placeIn([tee.id, jeans.id], tee, items, kinds)).toEqual([jeans.id]);
  });
});

describe('pairedFirst', () => {
  it('puts pieces often worn with the chosen ones first', () => {
    expect(pairedFirst([loafers, sneakers], [jeans.id], new Map([[pairKey(jeans.id, sneakers.id), 4]]))[0].id).toBe(sneakers.id);
  });
  it('puts pieces marked "pairs well" before ones merely worn together', () => {
    const marked = { ...loafers, pairs: [jeans.id] };
    expect(pairedFirst([sneakers, marked], [jeans.id], new Map([[pairKey(jeans.id, sneakers.id), 4]]))[0].id).toBe(loafers.id);
  });
});
