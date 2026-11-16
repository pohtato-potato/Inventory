import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearUndo, createItemWithPhoto, removeOutfit, removePhoto, saveOutfit, savePhotos } from '../src/db/actions';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { outfitPhotos, wearPhotos } from '../src/domain/face';
import type { Outfit, Photo, Wear } from '../src/domain/types';

const shot = (id: string, itemId: string, updatedAt: number, role: Photo['role'] = 'selfie'): Photo => ({ id, itemId, role, updatedAt, blob: new Blob(['x']), w: 3, h: 4 });
const office: Outfit = { id: 'o1', itemIds: ['tee', 'jeans'], dressCodes: [], createdAt: 0, updatedAt: 0 };
const day = (id: string, outfitId?: string): Wear => ({ id, day: '2026-11-10', itemIds: ['tee', 'jeans'], outfitId, updatedAt: 0 });

describe('the outfit’s face', () => {
  it('is its newest mirror photo, newest first after it', () => {
    const list = outfitPhotos(office, [], [shot('a', 'o1', 1), shot('b', 'o1', 3), shot('c', 'o1', 2)]);
    expect(list.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });
  it('counts mirror photos taken on days it was worn', () => {
    const list = outfitPhotos(office, [day('w1', 'o1'), day('w2')], [shot('a', 'o1', 1), shot('d', 'w1', 5), shot('e', 'w2', 9)]);
    expect(list.map((p) => p.id)).toEqual(['d', 'a']);
  });
  it('has none without a mirror photo, and ignores other photos', () => {
    expect(outfitPhotos(office, [], [shot('m', 'o1', 1, 'main'), shot('x', 'other', 2)])).toEqual([]);
  });
  it('a wear day shows its own mirror photos, newest first', () => {
    expect(wearPhotos(day('w1', 'o1'), [shot('a', 'o1', 1), shot('d', 'w1', 5), shot('f', 'w1', 7)]).map((p) => p.id)).toEqual(['f', 'd']);
  });
});

describe('mirror photos in the database', () => {
  beforeEach(async () => {
    clearUndo();
    await db.delete();
    await db.open();
    await seedIfEmpty();
  });
  const blob = () => ({ role: 'selfie' as const, blob: new Blob(['s'], { type: 'image/webp' }), w: 3, h: 4 });
  it('a removed photo stops being the face; the one before takes its place', async () => {
    const tee = await createItemWithPhoto({ name: 'Tee', kindId: 'k-tees' }, []);
    const { id } = await saveOutfit([tee]);
    const o = (await db.outfits.get(id))!;
    await savePhotos(id, [blob()]);
    await new Promise((r) => setTimeout(r, 2));
    await savePhotos(id, [blob()]);
    const all = await db.photos.toArray();
    const [newest, older] = outfitPhotos(o, [], all);
    await removePhoto(newest.id);
    expect(outfitPhotos(o, [], await db.photos.toArray())[0].id).toBe(older.id);
    await removePhoto(older.id);
    expect(outfitPhotos(o, [], await db.photos.toArray())).toEqual([]);
  });
  it('removing an outfit removes its mirror photos', async () => {
    const tee = await createItemWithPhoto({ name: 'Tee', kindId: 'k-tees' }, []);
    const { id } = await saveOutfit([tee]);
    await savePhotos(id, [blob(), blob()]);
    await removeOutfit(id);
    expect(await db.photos.where('itemId').equals(id).count()).toBe(0);
  });
});
