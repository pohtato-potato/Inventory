import { describe, expect, it } from 'vitest';
import { LONG_EDGE, fitWithin } from '../src/photo/encode';
import { maskBounds, tiltDegrees } from '../src/photo/polish';

/** A 50 × 20 bar at the centre of an 80 × 80 frame, turned by `deg`. */
function rectTiltedBy(deg: number, w = 80, h = 80): Uint8Array {
  const a = new Uint8Array(w * h);
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2, dy = y - h / 2;
      const qx = c * dx + s * dy, qy = -s * dx + c * dy;
      if (Math.abs(qx) < 25 && Math.abs(qy) < 10) a[y * w + x] = 255;
    }
  return a;
}

/** A tee: a body with two sleeves, turned by `deg`. Nearly square, so its long axis says little. */
function teeTiltedBy(deg: number, w = 120, h = 120): Uint8Array {
  const a = new Uint8Array(w * h);
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = x - w / 2, dy = y - h / 2;
      const qx = c * dx + s * dy, qy = -s * dx + c * dy;
      const body = Math.abs(qx) < 22 && Math.abs(qy) < 30;
      const sleeves = Math.abs(qx) < 40 && qy > -30 && qy < -12;
      if (body || sleeves) a[y * w + x] = 255;
    }
  return a;
}

describe('straightening', () => {
  it('straightens a nearly square tee', () => {
    expect(tiltDegrees(teeTiltedBy(0), 120, 120)).toBe(0);
    expect(tiltDegrees(teeTiltedBy(9), 120, 120)).toBeCloseTo(9, 0);
    expect(tiltDegrees(teeTiltedBy(-7), 120, 120)).toBeCloseTo(-7, 0);
  });
  it('measures a 10° tilt', () => {
    expect(tiltDegrees(rectTiltedBy(10), 80, 80)).toBeCloseTo(10, 0);
    expect(tiltDegrees(rectTiltedBy(-12), 80, 80)).toBeCloseTo(-12, 0);
  });
  it('treats a piece standing upright the same as one lying flat', () => {
    expect(tiltDegrees(rectTiltedBy(98), 80, 80)).toBeCloseTo(8, 0);
  });
  it('leaves a tilt under 3° alone', () => {
    expect(tiltDegrees(rectTiltedBy(1), 80, 80)).toBe(0);
  });
  it('never turns more than 20°', () => {
    expect(Math.abs(tiltDegrees(rectTiltedBy(35), 80, 80))).toBeLessThanOrEqual(20);
  });
  it('is 0 for an empty mask', () => {
    expect(tiltDegrees(new Uint8Array(6400), 80, 80)).toBe(0);
  });
  it('finds the bounds of the piece', () => {
    expect(maskBounds(rectTiltedBy(0), 80, 80, 0)).toEqual({ x: 16, y: 31, w: 49, h: 19 });
    expect(maskBounds(new Uint8Array(6400), 80, 80, 0)).toBeNull();
  });
});

describe('photo sizes', () => {
  it('shrinks to the long edge and never enlarges', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000, 1000)).toEqual({ w: 750, h: 1000 });
    expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });
    expect(LONG_EDGE).toEqual({ original: 1600, cutout: 1000 });
  });
});
