import { describe, expect, it } from 'vitest';
import { CHALK, contrast, itemColour, tileColour, tintOf } from '../src/domain/colour';
import { STARTER_SHADES } from '../src/db/seed';
import { KIND_COLOURS, KIND_PALETTE, kindGroup } from '../src/domain/kinds';
import type { Kind } from '../src/domain/types';

const BOARD = ['#34405A', '#2C55B8', '#8E3F1F', '#9A2A4C', '#7A7466', '#77736A'];

describe('itemColour, the clamp for a whole page in a thing\'s colour', () => {
  it('gives chalk text 4.5:1 or better on every sample shade', () => {
    for (const s of STARTER_SHADES) expect(contrast(CHALK, itemColour(s.hex)), `${s.name} ${s.hex}`).toBeGreaterThanOrEqual(4.5);
  });
  it('fixes the board\'s pale things, which failed', () => {
    expect(contrast(CHALK, '#7A7466')).toBeLessThan(4.5);
    expect(contrast(CHALK, itemColour('#7A7466'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(CHALK, itemColour('#77736A'))).toBeGreaterThanOrEqual(4.5);
  });
  it('leaves a colour that already passes as it is', () => {
    expect(itemColour('#2C55B8')).toBe('#2C55B8');
    expect(itemColour('#34405A')).toBe('#34405A');
  });
  it('keeps every board sample and its tile at 4.5:1 for chalk', () => {
    for (const h of BOARD) {
      expect(contrast(CHALK, itemColour(h))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(CHALK, tileColour(h))).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('lifts a near-black thing off the graphite ground', () => {
    expect(contrast(itemColour('#0E0E10'), '#101114')).toBeGreaterThan(1.15);
  });
  it('gives quiet text (the tint) 4.5:1 on its colour too', () => {
    for (const s of STARTER_SHADES) expect(contrast(tintOf(s.hex), itemColour(s.hex)), s.name).toBeGreaterThanOrEqual(4.5);
  });
});

describe('kind colours', () => {
  it('all carry chalk text', () => {
    for (const c of [...Object.values(KIND_COLOURS), ...KIND_PALETTE]) expect(contrast(CHALK, c), c).toBeGreaterThanOrEqual(4.5);
  });
  it('puts all clothing under Clothes and owner-made kinds under Other', () => {
    const kinds = [
      { id: 'k-tops', parentId: null, clothing: true },
      { id: 'k-tees', parentId: 'k-tops', clothing: true },
      { id: 'k-o-electronics', parentId: null, clothing: false },
      { id: 'k-phones', parentId: 'k-o-electronics', clothing: false },
      { id: 'mine', parentId: null, clothing: false },
    ] as Kind[];
    expect(kindGroup('k-tees', kinds)).toBe('clothes');
    expect(kindGroup('k-phones', kinds)).toBe('electronics');
    expect(kindGroup('mine', kinds)).toBe('other');
  });
});
