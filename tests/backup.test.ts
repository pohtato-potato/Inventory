import 'fake-indexeddb/auto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { createItemWithPhoto, setSetting } from '../src/db/actions';
import { exportAll, importAll, lastBackup } from '../src/backup/file';

const ph = (role: 'main' | 'original' | 'extra', text: string) => ({ role, blob: new Blob([text], { type: 'image/webp' }), w: 4, h: 3 });

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedIfEmpty();
});

describe('backup file', () => {
  it('round-trips pieces and photos', async () => {
    await createItemWithPhoto({ name: 'A', kindId: 'k-tees' }, [ph('main', 'a1'), ph('original', 'a2')]);
    await createItemWithPhoto({ name: 'B', kindId: 'k-tees' }, [ph('main', 'b1'), ph('original', 'b2')]);
    await createItemWithPhoto({ name: 'C', kindId: 'k-o-tools' }, [ph('extra', 'c1')]);
    await setSetting('sizes.unit', 'cm');
    const zip = await exportAll();
    await db.delete();
    await db.open();
    expect(await importAll(zip)).toEqual({ items: 3, photos: 5 });
    expect(await db.items.count()).toBe(3);
    const a = (await db.items.where('name').equals('A').first())!;
    const main = (await db.photos.where('itemId').equals(a.id).toArray()).find((p) => p.role === 'main')!;
    expect(await main.blob.text()).toBe('a1');
    expect(main.blob.type).toBe('image/webp');
    expect((await db.settings.get('sizes.unit'))?.value).toBe('cm');
    expect(await db.kinds.count()).toBeGreaterThan(10);
  });

  it('a version 2 backup carries wears, outfits and wishes', async () => {
    await db.wears.add({ id: 'w1', day: '2026-11-03', itemIds: ['a'], updatedAt: 1 });
    await db.outfits.add({ id: 'o1', itemIds: ['a', 'b'], dressCodes: [], createdAt: 1, updatedAt: 1 });
    await db.wishes.add({ id: 'h1', name: 'Linen shirt', tier: 'soon', currency: 'INR', status: 'open', source: 'hand', createdAt: 1, updatedAt: 1 });
    const zip = await exportAll();
    expect(JSON.parse(strFromU8(unzipSync(new Uint8Array(await zip.arrayBuffer()))['data.json'])).version).toBe(2);
    await db.delete();
    await db.open();
    await importAll(zip);
    expect([await db.wears.count(), await db.outfits.count(), await db.wishes.count()]).toEqual([1, 1, 1]);
  });

  it('refuses a backup made by a newer version', async () => {
    const zipWithVersion = (v: number) => new Blob([zipSync({ 'data.json': strToU8(JSON.stringify({ app: 'inventory', version: v, tables: {} })) })]);
    await expect(importAll(zipWithVersion(3))).rejects.toThrow('This backup was made by a newer version of Inventory');
  });

  it('refuses a file that is not a backup, and changes nothing', async () => {
    await createItemWithPhoto({ name: 'Keep me', kindId: 'k-tees' }, []);
    await expect(importAll(new Blob(['nope']))).rejects.toThrow('This file is not an Inventory backup');
    await expect(importAll(new Blob([zipSync({ 'x.txt': strToU8('hi') })]))).rejects.toThrow('This file is not an Inventory backup');
    expect(await db.items.count()).toBe(1);
  });

  it('refuses a backup that looks right but is missing tables or photos, and changes nothing', async () => {
    await createItemWithPhoto({ name: 'Keep me', kindId: 'k-tees' }, []);
    const zipOf = (data: unknown, extra: Record<string, Uint8Array> = {}) => new Blob([zipSync({ 'data.json': strToU8(JSON.stringify(data)), ...extra })]);
    const good = JSON.parse(strFromU8(unzipSync(new Uint8Array(await (await exportAll()).arrayBuffer()))['data.json']));
    const bad = [
      { app: 'inventory', version: 1, tables: {} },
      { app: 'inventory', version: 1, tables: null },
      { ...good, tables: { ...good.tables, kinds: 'nope' } },
      { ...good, tables: { ...good.tables, items: [{ name: 'no id' }] } },
      { ...good, tables: { ...good.tables, photos: [{ id: 'p1', itemId: 'x', role: 'main', w: 1, h: 1, updatedAt: 0, type: 'image/webp' }] } },
    ];
    for (const d of bad) await expect(importAll(zipOf(d))).rejects.toThrow('This file is not an Inventory backup');
    expect(await db.items.count()).toBe(1);
    expect(await db.kinds.count()).toBeGreaterThan(10);
  });

  it('remembers when the last backup was made', async () => {
    expect(await lastBackup()).toBeNull();
    await exportAll();
    expect(await lastBackup()).toBeGreaterThan(0);
  });
});
