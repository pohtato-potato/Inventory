import { describe, expect, it } from 'vitest';
import { STARTER_SHADES } from '../src/db/seed';
import { dominant, guessShades, hexToLab, nearestShade } from '../src/domain/colour';

/** 1000 opaque pixels split by share: [r, g, b, share]. */
function pixelsOf(parts: [number, number, number, number][]): Uint8ClampedArray {
  const out: number[] = [];
  for (const [r, g, b, share] of parts) for (let i = 0; i < Math.round(share * 1000); i++) out.push(r, g, b, 255);
  return new Uint8ClampedArray(out);
}

describe('colour', () => {
  it('converts hex to Lab', () => {
    const [L] = hexToLab('#FFFFFF');
    expect(L).toBeCloseTo(100, 0);
    expect(hexToLab('#000000')[0]).toBeCloseTo(0, 0);
  });
  it('finds burgundy, and never answers with a family', () => {
    expect(nearestShade([0x6d, 0x1a, 0x2b], STARTER_SHADES).name).toBe('Burgundy');
    expect(nearestShade([0xa3, 0x20, 0x2f], STARTER_SHADES).familyId).not.toBeNull();
  });
  it('merges three close blacks into one (the worn black trousers)', () => {
    const d = dominant(pixelsOf([[20, 20, 22, 0.82], [28, 28, 30, 0.09], [14, 14, 16, 0.03], [240, 240, 240, 0.06]]));
    expect(d[0].share).toBeCloseTo(0.94, 2);
    expect(d.length).toBe(2);
  });
  it('gives no second shade under a 20 % share', () => {
    expect(guessShades(pixelsOf([[20, 20, 22, 0.94], [240, 240, 240, 0.06]]), STARTER_SHADES).second).toBeUndefined();
  });
  it('gives a second shade at 20 % or more', () => {
    const g = guessShades(pixelsOf([[31, 47, 87, 0.7], [240, 240, 238, 0.3]]), STARTER_SHADES);
    expect(g.main.name).toBe('Navy');
    expect(g.second?.familyId).toBe('s-white');
  });
  it('skips transparent pixels', () => {
    expect(dominant(new Uint8ClampedArray(400))).toEqual([]);
    const half = new Uint8ClampedArray([200, 0, 0, 255, 0, 0, 255, 0]);
    expect(dominant(half)).toHaveLength(1);
  });
});
