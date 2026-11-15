import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { clearUndo, createItemWithPhoto, undoLast } from '../src/db/actions';
import { prepareFix, saveFix, tapFix, _setFixWorkerFactory, type FixDeps } from '../src/photo/fix';

/** A stand-in for the SlimSAM worker that records what it was asked. */
class FakeSam {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessageerror: ((ev: unknown) => void) | null = null;
  private extra = new Set<(ev: MessageEvent) => void>();
  got: string[] = [];
  addEventListener(_t: string, f: (ev: MessageEvent) => void) { this.extra.add(f); }
  removeEventListener(_t: string, f: (ev: MessageEvent) => void) { this.extra.delete(f); }
  emit(data: unknown) { const ev = { data } as MessageEvent; this.onmessage?.(ev); this.extra.forEach((f) => f(ev)); }
  postMessage(m: { type: string; id?: number }) {
    this.got.push(m.type);
    setTimeout(() => {
      if (m.type === 'load') this.emit({ type: 'ready', device: 'fake' });
      else if (m.type === 'embed') this.emit({ type: 'done', id: m.id, ms: 5 });
      else this.emit({ type: 'done', id: m.id, alpha: new Uint8Array([0, 255, 255, 0]), score: 0.9, ms: 1 });
    }, 0);
  }
  terminate() {}
}

describe('the fix model', () => {
  it('loads only on first use, and prepares each photo once', async () => {
    const made: FakeSam[] = [];
    _setFixWorkerFactory(() => { const w = new FakeSam(); made.push(w); return w as unknown as Worker; });
    expect(made).toHaveLength(0); // nothing fetched just by opening the app
    await prepareFix('piece-a', new Uint8ClampedArray(16), 2, 2);
    await prepareFix('piece-a', new Uint8ClampedArray(16), 2, 2);
    expect(made).toHaveLength(1);
    expect(made[0].got).toEqual(['load', 'embed']);
    const r = await tapFix([{ x: 0.5, y: 0.5, label: 1 }]);
    expect(Array.from(r.alpha)).toEqual([0, 255, 255, 0]);
    await prepareFix('piece-b', new Uint8ClampedArray(16), 2, 2);
    expect(made[0].got).toEqual(['load', 'embed', 'decode', 'embed']);
  });
});

describe('saveFix', () => {
  const W = 40, H = 40;
  const navy = () => { const p = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) p.set([20, 30, 90, 255], i * 4); return p; };
  const box = (x0: number, y0: number, x1: number, y1: number) => {
    const a = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * W + x] = 255;
    return a;
  };
  const deps: FixDeps = {
    compose: async (pixels, _m, w, h) => ({ pixels, w, h }),
    encode: async () => new Blob(['new cut'], { type: 'image/webp' }),
  };
  let id: string;
  beforeEach(async () => {
    clearUndo();
    await db.delete();
    await db.open();
    await seedIfEmpty();
    id = await createItemWithPhoto({ name: 'Chinos', kindId: 'k-tees', cutout: 'uncut' }, [{ role: 'original', blob: new Blob(['orig']), w: W, h: H }]);
    clearUndo();
  });
  const mainPhoto = () => db.photos.where('itemId').equals(id).filter((p) => p.role === 'main').first();

  it('saves a mask the busy-background rules would refuse, since the owner chose it', async () => {
    const r = await saveFix(id, { pixels: navy(), alpha: box(0, 0, 40, 34), w: W, h: H, points: [{ x: 0.5, y: 0.5, label: 1 }] }, deps);
    expect(r).toEqual({ ok: true });
    expect(await (await mainPhoto())!.blob.text()).toBe('new cut');
    const item = (await db.items.get(id))!;
    expect(item.cutout).toBe('done');
    expect(item.shadeMain).toBeTruthy(); // re-guessed from the new cut-out
    expect(await undoLast()).toBe('Fixed the cut-out of Chinos');
  });
  it('refuses an empty mask with a plain message and changes nothing', async () => {
    const r = await saveFix(id, { pixels: navy(), alpha: new Uint8Array(W * H), w: W, h: H, points: [{ x: 0.5, y: 0.5, label: 1 }] }, deps);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/too small/) });
    expect(await mainPhoto()).toBeUndefined();
    expect((await db.items.get(id))!.cutout).toBe('uncut');
    expect(await undoLast()).toBeNull();
  });
  it('refuses a whole-frame mask with a plain message', async () => {
    const r = await saveFix(id, { pixels: navy(), alpha: box(0, 0, 40, 40), w: W, h: H, points: [{ x: 0.5, y: 0.5, label: 1 }] }, deps);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/whole photo/) });
    expect(await mainPhoto()).toBeUndefined();
  });
});
