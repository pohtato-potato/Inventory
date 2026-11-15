import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { addWish, buyWish, clearUndo, dropWish, undoLast, updateWish } from '../src/db/actions';
import { isWaiting, sortWishes } from '../src/domain/wish';
import type { Wish } from '../src/domain/types';

const w: Wish = { id: 'w', name: 'Linen shirt', tier: 'soon', currency: 'INR', status: 'open', source: 'hand', createdAt: 1, updatedAt: 1 };

describe('waiting', () => {
  it('waits until a date, then stops waiting', () => {
    expect(isWaiting({ ...w, waitUntil: { date: '2026-12-01' } }, '2026-11-15')).toBe(true);
    expect(isWaiting({ ...w, waitUntil: { date: '2026-11-01' } }, '2026-11-15')).toBe(false);
    expect(isWaiting({ ...w, waitUntil: { date: '2026-11-15' } }, '2026-11-15')).toBe(false);
  });
  it('waits on a note until it is cleared by hand', () => {
    expect(isWaiting({ ...w, waitUntil: { note: 'when my waist is under 32' } }, '2026-11-15')).toBe(true);
    expect(isWaiting(w, '2026-11-15')).toBe(false);
  });
});

describe('sortWishes', () => {
  it('open first; by tier; waiting last within a tier; newest first', () => {
    const list: Wish[] = [
      { ...w, id: 'old-now', tier: 'now', createdAt: 1 },
      { ...w, id: 'bought', tier: 'now', status: 'bought', createdAt: 9 },
      { ...w, id: 'new-now', tier: 'now', createdAt: 5 },
      { ...w, id: 'wait-now', tier: 'now', createdAt: 8, waitUntil: { date: '2027-01-01' } },
      { ...w, id: 'soon', tier: 'soon', createdAt: 7 },
    ];
    expect(sortWishes(list, '2026-11-15').map((x) => x.id)).toEqual(['new-now', 'old-now', 'wait-now', 'soon', 'bought']);
  });
});

describe('wish actions', () => {
  beforeEach(async () => {
    clearUndo();
    await db.delete();
    await db.open();
    await seedIfEmpty();
  });

  it('adds a wish with its picture, edits and drops it, all undoable', async () => {
    const id = await addWish({ name: 'Linen shirt', tier: 'soon', kindId: 'k-shirts', source: 'share', url: 'https://www.myntra.com/x', shop: 'Myntra' }, { blob: new Blob(['p'], { type: 'image/webp' }), w: 3, h: 4 });
    expect(await db.wishes.get(id)).toMatchObject({ name: 'Linen shirt', status: 'open', currency: 'INR' });
    expect((await db.photos.where('itemId').equals(id).first())!.role).toBe('wish');
    await updateWish(id, { tier: 'now' });
    expect(await undoLast()).toBe('Changed 1 wish');
    await dropWish(id);
    expect((await db.wishes.get(id))!.status).toBe('dropped');
    expect(await undoLast()).toBe('Dropped 1 wish');
    expect((await db.wishes.get(id))!.status).toBe('open');
    expect(await undoLast()).toBe('Added 1 wish');
    expect(await db.wishes.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
  });

  it('buying makes a piece that needs details, with what the wish knew', async () => {
    const wid = await addWish({ name: 'Linen shirt', tier: 'now', kindId: 'k-shirts', shadeId: 's-white-white', shop: 'Myntra', price: { value: 1999, estimate: false } }, { blob: new Blob(['p'], { type: 'image/webp' }), w: 3, h: 4 });
    clearUndo();
    const itemId = await buyWish(wid, { boughtOn: '2026-11-15' });
    const item = (await db.items.get(itemId))!;
    expect(item).toMatchObject({ name: 'Linen shirt', kindId: 'k-shirts', shadeMain: 's-white-white', shop: 'Myntra', needsDetails: true, price: { value: 1999, estimate: false }, boughtOn: { value: '2026-11-15', estimate: false } });
    const photos = await db.photos.where('itemId').equals(itemId).toArray();
    expect(photos.map((p) => p.role)).toEqual(['extra']);
    expect(await db.wishes.get(wid)).toMatchObject({ status: 'bought', itemId, boughtOn: '2026-11-15' });
    expect(await undoLast()).toBe('Bought 1 wish');
    expect(await db.items.get(itemId)).toBeUndefined();
    expect(await db.photos.where('itemId').equals(itemId).count()).toBe(0);
    expect((await db.wishes.get(wid))!.status).toBe('open');
  });

  it('the price paid can differ from the wish’s', async () => {
    const wid = await addWish({ name: 'Boots', tier: 'soon' });
    const itemId = await buyWish(wid, { boughtOn: '2026-11-15', price: { value: 2500, estimate: false } });
    expect((await db.items.get(itemId))!.price).toEqual({ value: 2500, estimate: false });
    expect((await db.items.get(itemId))!.kindId).toBe('k-unsorted');
  });
});
