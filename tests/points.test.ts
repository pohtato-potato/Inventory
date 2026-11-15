import { describe, expect, it } from 'vitest';
import { addPoint, pickMask, promptFor, tapAt, undoPoint, type TapPoint } from '../src/photo/points';

describe('tap points', () => {
  it('a tap becomes a point in 0–1 photo coordinates, labelled by the mode', () => {
    const rect = { left: 10, top: 20, width: 200, height: 400 };
    expect(tapAt(110, 220, rect, 'keep')).toEqual({ x: 0.5, y: 0.5, label: 1 });
    expect(tapAt(10, 20, rect, 'remove')).toEqual({ x: 0, y: 0, label: 0 });
  });
  it('a tap just outside the photo is held to its edge', () => {
    expect(tapAt(0, 1000, { left: 10, top: 20, width: 200, height: 400 }, 'keep')).toEqual({ x: 0, y: 1, label: 1 });
  });
  it('adds and undoes points without changing the old list', () => {
    const a: TapPoint[] = [];
    const b = addPoint(a, { x: 0.5, y: 0.5, label: 1 });
    const c = addPoint(b, { x: 0.1, y: 0.1, label: 0 });
    expect(a).toEqual([]);
    expect(c).toHaveLength(2);
    expect(undoPoint(c)).toEqual(b);
    expect(undoPoint([])).toEqual([]);
  });
  it('turns points into the model prompt (its resized frame is height × width)', () => {
    const p = promptFor([{ x: 0.5, y: 0.25, label: 1 }, { x: 0, y: 1, label: 0 }], [1024, 768]);
    expect(Array.from(p.coords)).toEqual([384, 256, 0, 1024]);
    expect(p.labels).toEqual([1, 0]);
  });
});

describe('pickMask', () => {
  const W = 10, H = 10;
  const box = (x0: number, y0: number, x1: number, y1: number) => {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1;
    return m;
  };
  const whole = box(0, 0, 10, 10);
  const half = box(0, 0, 10, 5);
  const piece = box(3, 1, 6, 4);

  it('never picks the whole frame, even when the model scores it highest (measured on SlimSAM)', () => {
    expect(pickMask([whole, half, piece], [0.97, 0.85, 0.9], [{ x: 0.45, y: 0.25, label: 1 }], W, H)).toBe(2);
  });
  it('picks the smallest mask holding every keep point', () => {
    // a second keep point outside the small piece: the half is now the smallest that holds both
    expect(pickMask([whole, half, piece], [0.97, 0.85, 0.9], [{ x: 0.45, y: 0.25, label: 1 }, { x: 0.85, y: 0.25, label: 1 }], W, H)).toBe(1);
  });
  it('skips a mask that holds a remove point', () => {
    expect(pickMask([whole, half, piece], [0.97, 0.85, 0.6], [{ x: 0.85, y: 0.25, label: 1 }, { x: 0.45, y: 0.25, label: 0 }], W, H)).toBe(1);
  });
  it('with no mask fitting every point, takes the one that fits most, then the best score', () => {
    // keep at (4,2) and remove at (4,2)'s neighbour inside every mask that holds it
    const pts: TapPoint[] = [{ x: 0.45, y: 0.25, label: 1 }, { x: 0.55, y: 0.25, label: 0 }];
    expect(pickMask([whole, half, piece], [0.5, 0.9, 0.7], pts, W, H)).toBe(1);
  });
  it('only whole-frame masks: the best score (the refusal comes later)', () => {
    expect(pickMask([whole, whole], [0.2, 0.8], [{ x: 0.5, y: 0.5, label: 1 }], W, H)).toBe(1);
  });
});
