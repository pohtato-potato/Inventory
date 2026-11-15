import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { createItemWithPhoto, undoLast, clearUndo } from '../src/db/actions';
import { addShot, landCutout, startConveyor, _setCutter, requeuePending } from '../src/photo/conveyor';
import { ModelUnavailable, type CutResult } from '../src/photo/cutout';

const blob = new Blob(['x'], { type: 'image/webp' });
const navy = (n: number) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([31, 47, 87, 255], i * 4); return a; };

beforeEach(async () => {
  clearUndo();
  await db.delete();
  await db.open();
  await seedIfEmpty();
});

describe('landCutout', () => {
  it('saves the cut-out as the main photo and guesses its shade, without filling the undo list', async () => {
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    clearUndo();
    await landCutout(id, { original: blob, cutout: blob, w: 10, h: 10, pixels: navy(100), cutW: 8, cutH: 8 });
    const item = (await db.items.get(id))!;
    expect(item.cutout).toBe('done');
    expect(item.shadeMain).toBe('s-blue-navy');
    expect((await db.photos.where('itemId').equals(id).toArray()).map((p) => p.role).sort()).toEqual(['main', 'original']);
    expect(await undoLast()).toBeNull();
  });

  it('keeps the uncut photo and says so when the cut-out failed', async () => {
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    await landCutout(id, { original: blob, cutout: null, w: 10, h: 10, pixels: null });
    expect((await db.items.get(id))!.cutout).toBe('uncut');
    expect(await db.photos.where('itemId').equals(id).count()).toBe(1);
  });

  it('does not overwrite a shade the owner already chose', async () => {
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending', shadeMain: 's-red-wine' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    await landCutout(id, { original: blob, cutout: blob, w: 10, h: 10, pixels: navy(100) });
    expect((await db.items.get(id))!.shadeMain).toBe('s-red-wine');
  });

  it('does nothing for a piece deleted meanwhile', async () => {
    await expect(landCutout('gone', { original: blob, cutout: blob, w: 1, h: 1, pixels: navy(1) })).resolves.toBeUndefined();
  });
});

describe('the conveyor', () => {
  const settle = () => new Promise((r) => setTimeout(r, 30));
  const result = (): CutResult => ({ original: blob, cutout: blob, w: 10, h: 10, pixels: navy(100) });

  it('queues pieces by id and reads each photo only when its turn comes', async () => {
    const seen: string[] = [];
    _setCutter(async (photo) => { seen.push(await photo.text()); return result(); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob: new Blob(['orig'], { type: 'image/webp' }), w: 10, h: 10 }]);
    requeuePending();
    await settle();
    expect(seen).toEqual(['orig']);
    expect((await db.items.get(id))!.cutout).toBe('done');
  });

  it('leaves a piece waiting, not uncut, when the cut-out tool could not load, and retries it later', async () => {
    let up = false;
    _setCutter(async () => { if (!up) throw new ModelUnavailable(); return result(); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    requeuePending();
    await settle();
    expect((await db.items.get(id))!.cutout).toBe('pending');
    up = true;
    requeuePending();
    await settle();
    expect((await db.items.get(id))!.cutout).toBe('done');
  });

  it('marks a piece uncut when its own cut-out failed', async () => {
    _setCutter(async () => { throw new Error('bad photo'); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    requeuePending();
    await settle();
    expect((await db.items.get(id))!.cutout).toBe('uncut');
  });

  it('closes the shot as soon as it is saved', async () => {
    _setCutter(async () => result());
    let closed = false;
    const shot = { width: 10, height: 10, close() { closed = true; } } as unknown as ImageBitmap;
    await addShot(shot, 'clothing', async () => ({ blob, w: 10, h: 10 }));
    expect(closed).toBe(true);
  });
});
