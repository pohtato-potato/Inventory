import { describe, expect, it } from 'vitest';
import { cutOut, createQueue, ModelUnavailable, runModel, _setWorkerFactory, _setJobTimeout, type CutDeps } from '../src/photo/cutout';

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

  it('does not give up on the photo when the cut-out tool could not load', async () => {
    await expect(cutOut(bitmap, { ...deps(box), runModel: async () => { throw new ModelUnavailable(); } })).rejects.toBeInstanceOf(ModelUnavailable);
  });
});

/** A stand-in for the model worker: answers load at once; what it does with a run is up to the test. */
function fakeWorker(onRun: (w: FakeWorker, id: number) => void) {
  const made: FakeWorker[] = [];
  _setWorkerFactory(() => {
    const w = new FakeWorker(onRun);
    made.push(w);
    return w as unknown as Worker;
  });
  return made;
}
class FakeWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessageerror: ((ev: unknown) => void) | null = null;
  private extra = new Set<(ev: MessageEvent) => void>();
  terminated = false;
  constructor(private onRun: (w: FakeWorker, id: number) => void) {}
  addEventListener(_t: string, f: (ev: MessageEvent) => void) { this.extra.add(f); }
  removeEventListener(_t: string, f: (ev: MessageEvent) => void) { this.extra.delete(f); }
  emit(data: unknown) { const ev = { data } as MessageEvent; this.onmessage?.(ev); this.extra.forEach((f) => f(ev)); }
  postMessage(m: { type: string; id?: number }) {
    if (m.type === 'load') setTimeout(() => this.emit({ type: 'ready', device: 'fake' }), 0);
    else this.onRun(this, m.id!);
  }
  terminate() { this.terminated = true; }
}

describe('the model worker', () => {
  it('a crashed worker fails its jobs as "tool unavailable", and the next job starts a fresh worker', async () => {
    const made = fakeWorker((w, id) => {
      if (made.length === 1) setTimeout(() => w.onerror?.({ message: 'killed' }), 0);
      else setTimeout(() => w.emit({ type: 'mask', id, alpha: new Uint8Array(4) }), 0);
    });
    await expect(runModel(rgba(2, 2), 2, 2)).rejects.toBeInstanceOf(ModelUnavailable);
    expect(made[0].terminated).toBe(true);
    await expect(runModel(rgba(2, 2), 2, 2)).resolves.toHaveLength(4);
    expect(made).toHaveLength(2);
  });

  it('a job that never answers times out as "tool unavailable"', async () => {
    _setJobTimeout(20);
    const made = fakeWorker(() => {});
    await expect(runModel(rgba(2, 2), 2, 2)).rejects.toBeInstanceOf(ModelUnavailable);
    expect(made[0].terminated).toBe(true);
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

  it('knows which jobs are waiting, so a piece is never queued twice', async () => {
    const q = createQueue(async (job: string) => job);
    q.add('x', 'p1');
    expect(q.has('p1')).toBe(true);
    expect(q.has('p2')).toBe(false);
    await new Promise((r) => q.onDone(r));
    expect(q.has('p1')).toBe(false);
  });
});

describe('the queue goes idle', () => {
  it('resolves idle() only after every added job ran and its listeners were told', async () => {
    const told: string[] = [];
    const q = createQueue(async (job: string) => { await new Promise((r) => setTimeout(r, 5)); return job; });
    q.onDone((id) => told.push(id));
    await q.idle(); // nothing queued: at once
    q.add('a', 'a');
    q.add('b', 'b');
    await q.idle();
    expect(told).toEqual(['a', 'b']);
  });
});
