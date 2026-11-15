import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import {
  DAY, addPlace, bringBack, copyItem, createItemWithPhoto, letGo, moveItems, removeKind, removePlace, removeShade,
  restore, sweepTrash, trash, undoLast, updateItem, updateMany, clearUndo,
} from '../src/db/actions';

const tees = 'k-tees', tops = 'k-tops', burgundy = 's-red-burgundy', red = 's-red';
const photo = { role: 'main' as const, blob: new Blob(['x'], { type: 'image/webp' }), w: 10, h: 10 };

beforeEach(async () => {
  vi.restoreAllMocks();
  clearUndo();
  await db.delete();
  await db.open();
  await seedIfEmpty();
});

describe('createItemWithPhoto', () => {
  it('saves the piece, its photo and an "added" event', async () => {
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, [photo]);
    const item = (await db.items.get(id))!;
    expect(item).toMatchObject({ name: 'Tee', kindId: tees, count: 1, currency: 'INR', status: 'owned', tags: [], usualSpotIds: [] });
    expect(item.updatedAt).toBeGreaterThan(0);
    expect(await db.photos.where('itemId').equals(id).count()).toBe(1);
    expect((await db.events.where('itemId').equals(id).toArray()).map((e) => e.type)).toEqual(['added']);
  });

  it('leaves nothing half-saved when the phone is full (Review Focus 2)', async () => {
    vi.spyOn(db.photos, 'bulkAdd').mockRejectedValueOnce(Object.assign(new Error('q'), { name: 'QuotaExceededError' }));
    await expect(createItemWithPhoto({ name: 'X', kindId: tees }, [photo])).rejects.toThrow('Not enough space to save this photo');
    expect(await db.items.where('name').equals('X').count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });
});

describe('undo', () => {
  it('undoes a move and says what it undid', async () => {
    const spotA = await addPlace('Cupboard', 'p-home');
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, [photo]);
    await moveItems([id], spotA);
    expect((await db.items.get(id))!.spotId).toBe(spotA);
    expect(await undoLast()).toBe('Moved 1 piece');
    expect((await db.items.get(id))!.spotId).toBeUndefined();
  });

  it('undoes an edit to many pieces', async () => {
    const a = await createItemWithPhoto({ name: 'A', kindId: tees, fit: 'tight' }, []);
    const b = await createItemWithPhoto({ name: 'B', kindId: tees }, []);
    await updateMany([a, b], { fit: 'fits' });
    expect((await db.items.get(b))!.fit).toBe('fits');
    expect(await undoLast()).toBe('Edited 2 pieces');
    expect((await db.items.get(a))!.fit).toBe('tight');
    expect((await db.items.get(b))!.fit).toBeUndefined();
  });

  it('returns null when there is nothing to undo', async () => {
    expect(await undoLast()).toBeNull();
  });

  it('keeps at most 20 steps', async () => {
    const id = await createItemWithPhoto({ name: 'A', kindId: tees }, []);
    for (let i = 0; i < 25; i++) await updateItem(id, { brand: `b${i}` });
    let n = 0;
    while (await undoLast()) n++;
    expect(n).toBe(20);
  });
});

describe('trash', () => {
  it('keeps trashed pieces 30 days, then removes them with their photos', async () => {
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, [photo]);
    await trash([id]);
    expect((await db.items.get(id))!.deletedAt).toBeGreaterThan(0);
    expect(await sweepTrash(Date.now() + 29 * DAY)).toBe(0);
    expect(await sweepTrash(Date.now() + 31 * DAY)).toBe(1);
    expect(await db.items.get(id)).toBeUndefined();
    expect(await db.photos.where('itemId').equals(id).count()).toBe(0);
  });

  it('restores from the trash', async () => {
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, []);
    await trash([id]);
    await restore([id]);
    expect((await db.items.get(id))!.deletedAt).toBeUndefined();
  });
});

describe('letting go', () => {
  it('marks a piece gone and brings it back, with history', async () => {
    const id = await createItemWithPhoto({ name: 'Jeans', kindId: 'k-jeans' }, []);
    await letGo(id, { on: '2026-11-03', how: 'sold', amount: 800 });
    expect((await db.items.get(id))!).toMatchObject({ status: 'gone', gone: { how: 'sold', amount: 800 } });
    await bringBack(id);
    const item = (await db.items.get(id))!;
    expect(item.status).toBe('owned');
    expect(item.gone).toBeUndefined();
    expect((await db.events.where('itemId').equals(id).sortBy('at')).map((e) => e.type)).toEqual(['added', 'gone', 'back']);
  });
});

describe('removing things in use (Review Focus 5)', () => {
  it('moves pieces up to the parent kind, the family, or no spot', async () => {
    const spotA = await addPlace('Cupboard', 'p-home');
    const id2 = await createItemWithPhoto({ name: 'Tee', kindId: tees, shadeMain: burgundy, spotId: spotA, usualSpotIds: [spotA] }, [photo]);
    await removeKind(tees);
    expect((await db.items.get(id2))!.kindId).toBe(tops);
    await removeShade(burgundy);
    expect((await db.items.get(id2))!.shadeMain).toBe(red);
    await removePlace(spotA);
    const item = (await db.items.get(id2))!;
    expect(item.spotId).toBeUndefined();
    expect(item.usualSpotIds).toEqual([]);
    expect((await db.kinds.get(tees))!.deletedAt).toBeGreaterThan(0);
  });

  it('undoes removing a kind', async () => {
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, []);
    await removeKind(tees);
    expect(await undoLast()).toBe('Removed Tees');
    expect((await db.items.get(id))!.kindId).toBe(tees);
    expect((await db.kinds.get(tees))!.deletedAt).toBeUndefined();
  });

  it('a top kind sends its pieces to Other, and Other stays', async () => {
    const id = await createItemWithPhoto({ name: 'Kurta', kindId: 'k-ethnic' }, []);
    await removeKind('k-ethnic');
    expect((await db.items.get(id))!.kindId).toBe('k-o-other');
    await expect(removeKind('k-o-other')).rejects.toThrow();
  });

  it('removing a home empties its spots onto "No spot"', async () => {
    const home2 = await addPlace("Parents' home", null);
    const spot = await addPlace('Old cupboard', home2);
    const id = await createItemWithPhoto({ name: 'Tee', kindId: tees, spotId: spot }, []);
    await removePlace(home2);
    expect((await db.items.get(id))!.spotId).toBeUndefined();
    expect((await db.places.get(spot))!.deletedAt).toBeGreaterThan(0);
  });

  it('refuses to remove "With me"', async () => {
    await expect(removePlace('p-withme')).rejects.toThrow();
  });
});

describe('copyItem', () => {
  it('copies fields and the main photo, resets starting wears', async () => {
    const id2 = await createItemWithPhoto({ name: 'Tee', kindId: tees, brand: 'Uniqlo', startWears: { range: '5-20' } }, [photo, { ...photo, role: 'original' }]);
    const c = await copyItem(id2);
    const copy = (await db.items.get(c))!;
    expect(copy.name).toBe('Tee copy');
    expect(copy.brand).toBe('Uniqlo');
    expect(copy.startWears).toBeUndefined();
    expect((await db.photos.where('itemId').equals(c).toArray()).map((p) => p.role)).toEqual(['main']);
  });
});
