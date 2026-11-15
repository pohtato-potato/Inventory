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

  // Numbers measured on the real model (docs/superpowers/notes/2026-11-cutout-patterned.md): a piece on a busy bedsheet kept
  // 83–85 % of the frame and ran along 41–64 % of its edge; pieces on a plain surface kept at most 60 % and touched at most 7 % of the edge.
  it('gives up on a background taken in with the piece: a mask filling most of the frame and running along its edges', () => {
    // the owner's photo: bedsheet and pillow kept, only a corner and a strip cut away
    const m = draw((x, y) => !(x > 30 && y > 24) && x > 1);
    expect(cleanMask(m, W, H)).toBeNull();
  });
  it('gives up when the mask hugs the frame edge even if it is not that big', () => {
    const m = draw((_x, y) => y < 14); // a band across the whole top: 35 % of the frame, a third of the edge
    expect(cleanMask(m, W, H)).toBeNull();
  });
  it('keeps a garment-like shape laid flat in the middle', () => {
    const m = draw((x, y) => (y >= 6 && y < 16 && x >= 6 && x < 34) || (y >= 16 && y < 36 && x >= 13 && x < 27)); // a tee
    expect(cleanMask(m, W, H)![at(20, 20)]).toBe(255);
  });
  it('keeps a big piece framed tight on a plain surface (about 60 % of the frame, barely touching the edge)', () => {
    const m = draw((x, y) => x >= 3 && x < 37 && y >= 0 && y < 29 && !(y < 6 && x > 14 && x < 25)); // a jacket, collar touching the top
    expect(cleanMask(m, W, H)).not.toBeNull();
  });
  it('gives up when the model was unsure about much of the frame (lots of mid-grey), even if the shape looks fine', () => {
    // a jacket on a floral sheet: 27 % of the raw mask was mid-grey; plain-surface shots stay at 1 % or less
    const m = draw((x, y) => (y >= 6 && y < 16 && x >= 6 && x < 34) || (y >= 16 && y < 36 && x >= 13 && x < 27));
    for (let i = 0; i < m.length; i += 3) if (!m[i]) m[i] = 110; // a third of the background half-believed
    expect(cleanMask(m, W, H)).toBeNull();
  });
});
