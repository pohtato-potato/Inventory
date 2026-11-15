import { describe, expect, it } from 'vitest';
import { cleanMask } from '../src/photo/mask';

const W = 40, H = 40;
const at = (x: number, y: number) => y * W + x;
function draw(fn: (x: number, y: number) => boolean): Uint8Array {
  const a = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fn(x, y)) a[at(x, y)] = 255;
  return a;
}

describe('cleanMask', () => {
  it('removes a speck in the corner and keeps the piece', () => {
    const m = draw((x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30) || (x < 3 && y < 3));
    const out = cleanMask(m, W, H)!;
    expect(out[at(1, 1)]).toBe(0);
    expect(out[at(20, 20)]).toBe(255);
  });
  it('fills a hole inside the piece', () => {
    const m = draw((x, y) => {
      const d = Math.hypot(x - 20, y - 20);
      return d < 16 && d >= 4;
    });
    expect(cleanMask(m, W, H)![at(20, 20)]).toBe(255);
  });
  it('keeps only the part nearest the centre', () => {
    const m = draw((x, y) => (x >= 14 && x < 26 && y >= 14 && y < 26) || (x >= 30 && x < 39 && y >= 30 && y < 39));
    const out = cleanMask(m, W, H)!;
    expect(out[at(20, 20)]).toBe(255);
    expect(out[at(34, 34)]).toBe(0);
  });
  it('gives up on an empty cut-out (Review Focus 3)', () => {
    expect(cleanMask(new Uint8Array(W * H), W, H)).toBeNull();
  });
  it('gives up when the cut-out covers the whole frame (Review Focus 3)', () => {
    expect(cleanMask(new Uint8Array(W * H).fill(255), W, H)).toBeNull();
  });
  it('softens the edge by about a pixel', () => {
    const m = draw((x, y) => x >= 10 && x < 30 && y >= 10 && y < 30);
    const out = cleanMask(m, W, H)!;
    expect(out[at(10, 20)]).toBeGreaterThan(0);
    expect(out[at(10, 20)]).toBeLessThan(255);
  });
});
