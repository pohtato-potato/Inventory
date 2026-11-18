import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { importAll } from '../src/backup/file';
import { wearsFromEvents } from '../src/db/migrate';
import type { ItemEvent } from '../src/domain/types';
// Build 1's own database code, frozen at 4f49307 (what the owner's phone runs before the upgrade).
import { db as db1 } from './fixtures/build1/db/db';
import { seedIfEmpty as seed1 } from './fixtures/build1/db/seed';
import { addKind as addKind1, createItemWithPhoto as create1, wornToday as worn1 } from './fixtures/build1/db/actions';
import { exportAll as export1 } from './fixtures/build1/backup/file';

const TEES = 'k-tees', JEANS = 'k-jeans', SHOES = 'k-shoes';
const at = (d: number, h: number) => new Date(2026, 10, d, h, 0).getTime();
const ph = (role: 'main' | 'original' | 'extra', t: string) => ({ role, blob: new Blob([t], { type: 'image/webp' }), w: 4, h: 3 });

describe('wearsFromEvents', () => {
  it('makes one wear per local day, merging and de-duplicating its pieces', () => {
    const ev = (itemId: string, when: number): ItemEvent => ({ id: `${itemId}${when}`, itemId, at: when, type: 'worn' });
    const events = [ev('tee', at(3, 9)), ev('jeans', at(3, 9)), ev('tee', at(3, 20)), ev('tee', at(4, 8)), { id: 'x', itemId: 'tee', at: at(5, 1), type: 'edited' } as ItemEvent];
    expect(wearsFromEvents(events).map((w) => [w.day, w.itemIds.length])).toEqual([['2026-11-03', 2], ['2026-11-04', 1]]);
  });
  it('a wear at ten past midnight belongs to the new day', () => {
    const w = wearsFromEvents([{ id: 'a', itemId: 'tee', at: new Date(2026, 10, 15, 0, 10).getTime(), type: 'worn' }]);
    expect(w[0].day).toBe('2026-11-15');
  });
});

/** A version 1 database, written by Build 1's code: 3 pieces, 5 photos, 3 wears over two days, an owner-added kind. */
async function seedV1Fixture() {
  db.close();
  await db1.delete();
  await db1.open();
  await seed1();
  const tee = await create1({ name: 'Navy tee', kindId: TEES }, [ph('main', 't1'), ph('original', 't2')]);
  const jeans = await create1({ name: 'Blue jeans', kindId: JEANS }, [ph('main', 'j1'), ph('original', 'j2')]);
  await create1({ name: 'Drill', kindId: 'k-o-tools' }, [ph('extra', 'd1')]);
  const kurtas = await addKind1('Kurtas', null, true);
  await worn1(tee, at(3, 9));
  await worn1(jeans, at(3, 9));
  await worn1(tee, at(4, 9));
  const before = { items: await db1.items.count(), photos: await db1.photos.count(), events: await db1.events.count(), tee, jeans, kurtas };
  db1.close();
  return before;
}

describe('upgrading a Build 1 database (Review Focus 1)', () => {
  beforeEach(() => db.close());

  it('keeps every piece, photo and event, and turns worn events into wears', async () => {
    const before = await seedV1Fixture();
    expect(before).toMatchObject({ items: 3, photos: 5 });
    await db.open();
    expect(db.verno).toBe(3);
    expect(await db.items.count()).toBe(before.items);
    expect(await db.photos.count()).toBe(before.photos);
    expect(await db.events.count()).toBe(before.events);
    expect(await db.wears.count()).toBe(2);
    const day3 = (await db.wears.where('day').equals('2026-11-03').first())!;
    expect(day3.itemIds.sort()).toEqual([before.tee, before.jeans].sort());
    expect(await (await db.photos.where('itemId').equals(before.tee).first())!.blob.text()).toMatch(/^t/);
  });

  it('gives the starter kinds their lanes and sizes, and leaves the owner’s own kinds without one', async () => {
    const before = await seedV1Fixture();
    await db.open();
    expect((await db.kinds.get(TEES))!.lane).toBe('top');
    expect((await db.kinds.get(TEES))!.layer).toBe('under');
    expect((await db.kinds.get(SHOES))!.baseScale).toBeLessThan((await db.kinds.get(JEANS))!.baseScale!);
    expect((await db.kinds.get(before.kurtas))!.lane).toBeUndefined();
    await seedIfEmpty(); // the app's start-up seeding changes nothing on an upgraded database
    expect(await db.items.count()).toBe(3);
  });

  it('a fresh database starts with the lanes too', async () => {
    await db.delete();
    await db.open();
    await seedIfEmpty();
    expect((await db.kinds.get('k-jackets'))).toMatchObject({ lane: 'top', layer: 'outer', baseScale: 1.1 });
    expect((await db.kinds.get('k-watches'))!.lane).toBe('wrist');
  });
});

describe('backups across versions', () => {
  it('a backup file made by Build 1 still restores, with its wears', async () => {
    await seedV1Fixture();
    await db1.open();
    const zip = await export1();
    db1.close();
    await db.delete();
    await db.open();
    await seedIfEmpty();
    expect((await importAll(zip)).items).toBe(3);
    expect(await db.photos.count()).toBe(5);
    expect(await db.wears.count()).toBe(2);
    expect((await db.kinds.get(TEES))!.lane).toBe('top');
  });
});
