import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { clearUndo, createItemWithPhoto, letGo, logWear, removeWear, undoLast, wornToday } from '../src/db/actions';
import { dayKey, outfitCount, shiftDay, suggestWear, wearStats } from '../src/domain/wearlog';
import type { Outfit, Wear } from '../src/domain/types';

const wear = (day: string, itemIds: string[], outfitId?: string): Wear => ({ id: day, day, itemIds, outfitId, updatedAt: 0 });
const outfit = (id: string, itemIds: string[]): Outfit => ({ id, itemIds, dressCodes: [], createdAt: 0, updatedAt: 0 });

describe('days', () => {
  it('a wear at ten past midnight belongs to the new day (Review Focus 5)', () => {
    expect(dayKey(new Date(2026, 10, 15, 0, 10).getTime())).toBe('2026-11-15');
    expect(dayKey(new Date(2026, 10, 14, 23, 59).getTime())).toBe('2026-11-14');
  });
  it('steps across months, leap years and years', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDay('2024-03-01', -1)).toBe('2024-02-29');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay(dayKey(Date.now()), -1)).toBe(dayKey(new Date(new Date().setDate(new Date().getDate() - 1)).getTime()));
  });
});

describe('wearStats', () => {
  it('counts wears, the last day and pairs worn together', () => {
    const s = wearStats([wear('2026-11-01', ['tee', 'jeans']), wear('2026-11-03', ['jeans', 'tee', 'watch']), wear('2026-11-02', ['shirt'])]);
    expect(s.count.get('tee')).toBe(2);
    expect(s.last.get('tee')).toBe('2026-11-03');
    expect(s.together.get('jeans|tee')).toBe(2);
    expect(s.together.get('tee|watch')).toBe(1);
  });
});

describe('outfitCount and suggestWear', () => {
  const a = outfit('a', ['tee', 'jeans']), b = outfit('b', ['shirt', 'chinos']);
  const today = '2026-11-15';
  it('a wear counts for an outfit by its id or by holding all its pieces', () => {
    expect(outfitCount(a, [wear('2026-11-01', ['x'], 'a'), wear('2026-11-02', ['tee', 'jeans', 'watch']), wear('2026-11-03', ['tee'])])).toBe(2);
  });
  it('suggests the regular worn most in the last 60 days, unless it was worn yesterday', () => {
    const ws = [wear('2026-11-01', ['tee', 'jeans'], 'a'), wear('2026-11-05', ['tee', 'jeans'], 'a'), wear('2026-11-09', ['shirt', 'chinos'], 'b'), wear('2026-11-14', ['tee', 'jeans'], 'a')];
    expect(suggestWear([a, b], ws, today)!.outfitId).toBe('b');
    expect(suggestWear([a, b], ws.slice(0, 3), today)!.outfitId).toBe('a');
  });
  it('wears older than 60 days do not make a regular; then it offers the last wear', () => {
    const ws = [wear('2026-08-01', ['tee', 'jeans'], 'a'), wear('2026-11-10', ['tee', 'watch'])];
    expect(suggestWear([a], ws, today)).toEqual({ itemIds: ['tee', 'watch'] });
  });
  it('nothing to go on: no suggestion', () => {
    expect(suggestWear([], [], today)).toBeNull();
  });
});

describe('logging wears', () => {
  let tee: string, jeans: string;
  beforeEach(async () => {
    clearUndo();
    await db.delete();
    await db.open();
    await seedIfEmpty();
    tee = await createItemWithPhoto({ name: 'Navy tee', kindId: 'k-tees' }, []);
    jeans = await createItemWithPhoto({ name: 'Blue jeans', kindId: 'k-jeans' }, []);
    clearUndo();
  });

  it('keeps one wear a day: a second log replaces the first', async () => {
    await logWear('2026-11-15', [tee, jeans]);
    await logWear('2026-11-15', [tee]);
    expect(await db.wears.where('day').equals('2026-11-15').count()).toBe(1);
    expect((await db.wears.where('day').equals('2026-11-15').first())!.itemIds).toEqual([tee]);
  });
  it('keeps the story in step: a worn event per piece added, and none left for a piece taken off', async () => {
    await logWear('2026-11-15', [tee, jeans]);
    await logWear('2026-11-15', [tee]);
    const worn = await db.events.filter((e) => e.type === 'worn').toArray();
    expect(worn.map((e) => e.itemId)).toEqual([tee]);
    expect(dayKey(worn[0].at)).toBe('2026-11-15');
  });
  it('undo puts the day back as it was', async () => {
    await logWear('2026-11-15', [tee, jeans]);
    await logWear('2026-11-15', [tee]);
    expect(await undoLast()).toBe('Logged what you wore');
    expect((await db.wears.where('day').equals('2026-11-15').first())!.itemIds).toEqual([tee, jeans]);
    expect(await db.events.filter((e) => e.type === 'worn').count()).toBe(2);
    await undoLast();
    expect(await db.wears.count()).toBe(0);
    expect(await db.events.filter((e) => e.type === 'worn').count()).toBe(0);
  });
  it('clears a day, undoably', async () => {
    await logWear('2026-11-14', [tee]);
    await removeWear('2026-11-14');
    expect(await db.wears.count()).toBe(0);
    expect(await undoLast()).toBe('Cleared a day');
    expect(await db.wears.count()).toBe(1);
  });
  it('worn today adds the piece to today’s wear, once', async () => {
    await logWear(dayKey(Date.now()), [tee]);
    expect(await wornToday(jeans)).toBe(true);
    expect(await wornToday(jeans)).toBe(false);
    expect((await db.wears.where('day').equals(dayKey(Date.now())).first())!.itemIds).toEqual([tee, jeans]);
    expect(await undoLast()).toBe('Worn today');
    expect((await db.wears.where('day').equals(dayKey(Date.now())).first())!.itemIds).toEqual([tee]);
  });
  it('a piece let go keeps its wears (Review Focus 2)', async () => {
    await logWear('2026-11-15', [tee]);
    await letGo(tee, { on: '2026-11-16', how: 'donated' });
    expect(wearStats(await db.wears.toArray()).count.get(tee)).toBe(1);
    expect(await undoLast()).toBe('Let go of 1 piece');
  });
});
