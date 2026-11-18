import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { sizeRowForward } from '../src/db/migrate';
import { matches, shownItems } from '../src/domain/search';
import type { Item, SizeRow } from '../src/domain/types';

const item = (p: Partial<Item>): Item => ({
  id: p.name ?? 'x', name: 'x', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0, ...p,
});
const trees = { kinds: [], shades: [], places: [] };

describe('gone things are hidden unless the Gone filter is on', () => {
  const tee = item({ name: 'Tee' });
  const sold = item({ name: 'Sold jacket', status: 'gone', gone: { on: '2026-01-02', how: 'sold' } });
  const trashed = item({ name: 'Trashed', deletedAt: 5 });
  const trashedGone = item({ name: 'Trashed gone', status: 'gone', deletedAt: 5 });
  it('Everything, Places and a place show owned things only', () => {
    expect(shownItems([tee, sold, trashed, trashedGone]).map((i) => i.name)).toEqual(['Tee']);
  });
  it('the Gone filter shows only things let go, never trashed ones', () => {
    expect(shownItems([tee, sold, trashed, trashedGone], { gone: true }).map((i) => i.name)).toEqual(['Sold jacket']);
  });
  it('search hides gone things unless asked for them', () => {
    expect(matches(sold, { text: 'jacket' }, trees)).toBe(false);
    expect(matches(sold, { text: 'jacket', gone: true }, trees)).toBe(true);
    expect(matches(tee, { text: 'tee', gone: true }, trees)).toBe(false);
  });
});

describe('sizes: a brand holds several sizes', () => {
  const old = { id: 'b1', type: 'brand', name: "Levi's", value: '32 × 30', note: 'runs small', order: 0, updatedAt: 1 } as SizeRow & { note: string };
  it('turns an old brand row into a brand with one entry, keeping its size and note', () => {
    const r = sizeRowForward(old);
    expect(r).toEqual({ id: 'b1', type: 'brand', name: "Levi's", order: 0, updatedAt: 1, entries: [{ covers: '', size: '32 × 30', note: 'runs small' }] });
    expect('value' in r).toBe(false);
    expect('note' in r).toBe(false);
  });
  it('leaves measurements and rows already moved alone, so running it twice changes nothing', () => {
    const m: SizeRow = { id: 'm-chest', type: 'measure', name: 'Chest', value: '38', order: 0, updatedAt: 1 };
    expect(sizeRowForward(m)).toBe(m);
    const once = sizeRowForward(old);
    expect(sizeRowForward(once)).toBe(once);
  });
  it('a brand with neither size nor note gets an empty list', () => {
    expect(sizeRowForward({ id: 'b', type: 'brand', name: 'Zara', value: ' ', order: 1, updatedAt: 1 }).entries).toEqual([]);
  });
  it('moves the rows when a version 2 database opens as version 3', async () => {
    const v2 = new Dexie('inventory');
    v2.version(2).stores({ items: 'id', kinds: 'id', shades: 'id', places: 'id', photos: 'id', events: 'id', sizes: 'id, type', searches: 'id', settings: 'key', wears: 'id', outfits: 'id', wishes: 'id' });
    await v2.open();
    await v2.table('sizes').bulkAdd([old, { id: 'm-waist', type: 'measure', name: 'Waist', value: '32', order: 1, updatedAt: 1 }]);
    v2.close();
    const { db } = await import('../src/db/db');
    await db.open();
    const rows = await db.sizes.toArray();
    expect(rows.find((r) => r.id === 'b1')!.entries).toEqual([{ covers: '', size: '32 × 30', note: 'runs small' }]);
    expect(rows.find((r) => r.id === 'm-waist')!.value).toBe('32');
    db.close();
    await db.delete();
  });
});
