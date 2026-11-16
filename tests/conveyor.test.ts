import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { createItemWithPhoto, undoLast, clearUndo } from '../src/db/actions';
import { addShot, keepUncut, landCutout, retakeShot, startConveyor, _setCutter, requeuePending, whenIdle } from '../src/photo/conveyor';
import { ModelUnavailable, type CutResult } from '../src/photo/cutout';

const blob = new Blob(['x'], { type: 'image/webp' });
const navy = (n: number) => { const a = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) a.set([31, 47, 87, 255], i * 4); return a; };

beforeEach(async () => {
  await whenIdle(); // the last test's queued cut-outs finish before the database goes
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
  const result = (): CutResult => ({ original: blob, cutout: blob, w: 10, h: 10, pixels: navy(100) });

  it('queues pieces by id and reads each photo only when its turn comes', async () => {
    const seen: string[] = [];
    _setCutter(async (photo) => { seen.push(await photo.text()); return result(); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob: new Blob(['orig'], { type: 'image/webp' }), w: 10, h: 10 }]);
    await requeuePending();
    await whenIdle();
    expect(seen).toEqual(['orig']);
    expect((await db.items.get(id))!.cutout).toBe('done');
  });

  it('leaves a piece waiting, not uncut, when the cut-out tool could not load, and retries it later', async () => {
    let up = false;
    _setCutter(async () => { if (!up) throw new ModelUnavailable(); return result(); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    await requeuePending();
    await whenIdle();
    expect((await db.items.get(id))!.cutout).toBe('pending');
    up = true;
    await requeuePending();
    await whenIdle();
    expect((await db.items.get(id))!.cutout).toBe('done');
  });

  it('never cuts a piece twice: a requeue while its cut-out is being saved does not queue it again', async () => {
    let cuts = 0;
    let cutDone!: () => void;
    const cut = new Promise<void>((r) => { cutDone = r; });
    _setCutter(async () => { cuts++; cutDone(); return result(); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    void requeuePending();
    await cut;
    // While the cut-out is being saved, the app asks again (the model became ready, the app came back to the front).
    while ((await db.items.get(id))!.cutout === 'pending') await requeuePending();
    await whenIdle();
    expect(cuts).toBe(1);
  });

  it('marks a piece uncut when its own cut-out failed', async () => {
    _setCutter(async () => { throw new Error('bad photo'); });
    await startConveyor();
    const id = await createItemWithPhoto({ needsDetails: true, cutout: 'pending' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    await requeuePending();
    await whenIdle();
    expect((await db.items.get(id))!.cutout).toBe('uncut');
  });

  it('saves a new shot as "Not sorted yet", not as the last kind used', async () => {
    _setCutter(async () => result());
    const shot = { width: 10, height: 10, close() {} } as unknown as ImageBitmap;
    const { setSetting } = await import('../src/db/actions');
    await setSetting('add.lastKind', 'k-jeans');
    const a = await addShot(shot, 'clothing', async () => ({ blob, w: 10, h: 10 }));
    const b = await addShot(shot, 'things', async () => ({ blob, w: 10, h: 10 }));
    expect((await db.items.get(a))!.kindId).toBe('k-unsorted');
    expect((await db.items.get(b))!.kindId).toBe('k-o-unsorted');
  });

  it('closes the shot as soon as it is saved', async () => {
    _setCutter(async () => result());
    let closed = false;
    const shot = { width: 10, height: 10, close() { closed = true; } } as unknown as ImageBitmap;
    await addShot(shot, 'clothing', async () => ({ blob, w: 10, h: 10 }));
    expect(closed).toBe(true);
  });
});

describe('after a cut-out failed', () => {
  it('Retake swaps in the new photo, drops the old cut-out and cuts again', async () => {
    const seen: string[] = [];
    _setCutter(async (photo) => { seen.push(await photo.text()); return { original: photo, cutout: blob, w: 10, h: 10, pixels: navy(100) }; });
    await startConveyor();
    const id = await createItemWithPhoto({ name: 'Chinos', cutout: 'uncut' }, [
      { role: 'original', blob: new Blob(['old'], { type: 'image/webp' }), w: 10, h: 10 },
      { role: 'main', blob: new Blob(['bad cut'], { type: 'image/webp' }), w: 10, h: 10 },
    ]);
    let closed = false;
    const shot = { width: 10, height: 10, close() { closed = true; } } as unknown as ImageBitmap;
    await retakeShot(id, shot, async () => ({ blob: new Blob(['new'], { type: 'image/webp' }), w: 10, h: 10 }));
    expect(closed).toBe(true);
    await whenIdle();
    expect(seen).toEqual(['new']);
    const photos = await db.photos.where('itemId').equals(id).toArray();
    expect(photos.map((p) => p.role).sort()).toEqual(['main', 'original']);
    expect(await photos.find((p) => p.role === 'original')!.blob.text()).toBe('new');
    expect((await db.items.get(id))!.cutout).toBe('done');
    expect((await db.items.get(id))!.name).toBe('Chinos');
  });

  it('Keep as it is stops asking', async () => {
    const id = await createItemWithPhoto({ cutout: 'uncut' }, [{ role: 'original', blob, w: 10, h: 10 }]);
    await keepUncut(id);
    expect((await db.items.get(id))!.cutout).toBe('kept');
  });
});
