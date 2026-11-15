import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_SHADES } from '../src/db/seed';
import { ancestors, countAtEveryLevel, descendants } from '../src/domain/tree';

const kinds = STARTER_KINDS;
const shades = STARTER_SHADES;
const id = (list: { id: string; name: string }[], name: string) => list.find((n) => n.name === name)!.id;
const tops = id(kinds, 'Tops'), tees = id(kinds, 'Tees'), accessories = id(kinds, 'Accessories'), socks = id(kinds, 'Socks');
const red = id(shades, 'Red'), burgundy = id(shades.filter((s) => s.familyId), 'Burgundy');

describe('counts at every level', () => {
  const kindCounts = countAtEveryLevel([{ key: tees, n: 1 }, { key: socks, n: 4 }], kinds, (k) => k.parentId);
  const counts = countAtEveryLevel([{ key: burgundy, n: 1 }], shades, (s) => s.familyId);
  it('counts a burgundy tee under Burgundy and Red', () => {
    expect(counts.get(burgundy)).toBe(1);
    expect(counts.get(red)).toBe(1);
  });
  it('counts a tee under Tees and Tops', () => {
    expect(kindCounts.get(tees)).toBe(1);
    expect(kindCounts.get(tops)).toBe(1);
  });
  it('counts socks ×4 as four', () => {
    expect(kindCounts.get(accessories)).toBe(4);
    expect(kindCounts.get(socks)).toBe(4);
  });
});

describe('walks', () => {
  it('lists ancestors nearest first', () => {
    expect(ancestors(tees, kinds, (k) => k.parentId)).toEqual([tops]);
    expect(ancestors(tops, kinds, (k) => k.parentId)).toEqual([]);
  });
  it('lists descendants', () => {
    expect(descendants(tops, kinds, (k) => k.parentId).sort()).toEqual([id(kinds, 'Jackets'), id(kinds, 'Knitwear'), id(kinds, 'Shirts'), tees].sort());
  });
  it('stops at a cycle instead of hanging', () => {
    const loop = [{ id: 'a', p: 'b' }, { id: 'b', p: 'a' }];
    expect(() => ancestors('a', loop, (k) => k.p)).not.toThrow();
    expect(ancestors('a', loop, (k) => k.p)).toEqual(['b']);
    expect(() => descendants('a', loop, (k) => k.p)).not.toThrow();
    const c = countAtEveryLevel([{ key: 'a', n: 2 }], loop, (k) => k.p);
    expect(c.get('a')).toBe(2);
    expect(c.get('b')).toBe(2);
  });
});
