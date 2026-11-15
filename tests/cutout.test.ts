import { describe, expect, it } from 'vitest';
import { cutOut, createQueue, type CutDeps } from '../src/photo/cutout';

const bitmap = { width: 80, height: 60, close() {} } as unknown as ImageBitmap; // shrinks to fit 1600: stays 80 × 60
const rgba = (w: number, h: number) => new Uint8ClampedArray(w * h * 4).fill(200);
const deps = (alpha: (w: number, h: number) => Uint8Array): CutDeps => ({
  readPixels: async (_b, w, h) => rgba(w, h),
  encode: async (_px, w, h) => new Blob([`${w}x${h}`], { type: 'image/webp' }),
  runModel: async (_px, w, h) => alpha(w, h),
});
const box = (w: number, h: number) => {
  const a = new Uint8Array(w * h);
  for (let y = Math.floor(h / 4); y < Math.floor((3 * h) / 4); y++) for (let x = Math.floor(w / 4); x < Math.floor((3 * w) / 4); x++) a[y * w + x] = 255;
  return a;
};

describe('cutOut', () => {
  it('keeps the uncut photo when the model finds nothing (Review Focus 3)', async () => {
    const r = await cutOut(bitmap, deps((w, h) => new Uint8Array(w * h)));
    expect(r.cutout).toBeNull();
    expect(r.pixels).toBeNull();
    expect(r.original).toBeInstanceOf(Blob);
    expect({ w: r.w, h: r.h }).toEqual({ w: 80, h: 60 });
  });

  it('keeps the uncut photo when the model takes the whole frame (black jeans on a dark sheet)', async () => {
    const r = await cutOut(bitmap, deps((w, h) => new Uint8Array(w * h).fill(255)));
    expect(r.cutout).toBeNull();
  });

  it('returns a cut-out and its pixels when the piece is found', async () => {
    const r = await cutOut(bitmap, {
      ...deps(box),
      compose: async (_px, mask, w, h) => ({ pixels: rgba(w, h).map((v, i) => (i % 4 === 3 ? mask[(i - 3) / 4] : v)), w, h }),
    });
    expect(r.cutout).toBeInstanceOf(Blob);
    expect(r.pixels).not.toBeNull();
  });

  it('keeps the uncut photo when the model fails', async () => {
    const r = await cutOut(bitmap, { ...deps(box), runModel: async () => { throw new Error('out of memory'); } });
    expect(r.cutout).toBeNull();
    expect(r.original).toBeInstanceOf(Blob);
  });
});

describe('queue', () => {
  it('runs one cut-out at a time, in order, and never makes shooting wait', async () => {
    let running = 0, most = 0;
    const order: string[] = [];
    const q = createQueue(async (job: string) => {
      running++; most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return job.toUpperCase();
    });
    const done = new Promise<void>((resolve) => q.onDone((id, res) => { order.push(`${id}:${res.value}`); if (order.length === 3) resolve(); }));
    const ids = ['a', 'b', 'c'].map((j) => q.add(j));
    expect(q.pending()).toBe(3); // add returned at once
    await done;
    expect(most).toBe(1);
    expect(order).toEqual(ids.map((id, i) => `${id}:${'ABC'[i]}`));
  });
});
