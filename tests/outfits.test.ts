import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { addKind, clearUndo, createItemWithPhoto, removeOutfit, saveOutfit, setKindLane, setPairs, undoLast, updateOutfit } from '../src/db/actions';
import { DRESS_CODES, regulars } from '../src/domain/outfit';
import type { Outfit, Wear } from '../src/domain/types';

let tee: string, jeans: string, shirt: string;
beforeEach(async () => {
  clearUndo();
  await db.delete();
  await db.open();
  await seedIfEmpty();
  tee = await createItemWithPhoto({ name: 'Navy tee', kindId: 'k-tees' }, []);
  jeans = await createItemWithPhoto({ name: 'Blue jeans', kindId: 'k-jeans' }, []);
  shirt = await createItemWithPhoto({ name: 'White shirt', kindId: 'k-shirts' }, []);
  clearUndo();
});

describe('outfits', () => {
  it('saving the same pieces again gives the same outfit', async () => {
    const a = (await saveOutfit([tee, jeans])).id;
    const b = (await saveOutfit([jeans, tee])).id;
    expect(b).toBe(a);
    expect(await db.outfits.count()).toBe(1);
    expect((await saveOutfit([tee, jeans, shirt])).id).not.toBe(a);
  });
  it('saving pieces already saved says so and leaves no undo step behind (final review 2)', async () => {
    const a = (await saveOutfit([tee, jeans], 'Office')).id;
    clearUndo();
    expect(await saveOutfit([jeans, tee], 'Friday')).toEqual({ id: a, existed: true });
    expect(await undoLast()).toBeNull();
    expect((await db.outfits.get(a))!.name).toBe('Office');
  });
  it('keeps a name and dress codes, and edits are undoable', async () => {
    const a = (await saveOutfit([tee, jeans], 'Weekend', ['Casual'])).id;
    expect(await db.outfits.get(a)).toMatchObject({ name: 'Weekend', dressCodes: ['Casual'] });
    await updateOutfit(a, { name: 'Saturday' });
    expect(await undoLast()).toBe('Changed 1 outfit');
    expect((await db.outfits.get(a))!.name).toBe('Weekend');
  });
  it('removing is undoable', async () => {
    const a = (await saveOutfit([tee, jeans])).id;
    await removeOutfit(a);
    expect(await db.outfits.count()).toBe(0);
    expect(await undoLast()).toBe('Removed 1 outfit');
    expect(await db.outfits.get(a)).toBeDefined();
  });
  it('"pairs well" is kept on both pieces, and can be taken off', async () => {
    await setPairs(tee, jeans, true);
    expect((await db.items.get(jeans))!.pairs).toContain(tee);
    expect((await db.items.get(tee))!.pairs).toContain(jeans);
    await setPairs(tee, jeans, true);
    expect((await db.items.get(tee))!.pairs).toEqual([jeans]);
    await setPairs(jeans, tee, false);
    expect((await db.items.get(tee))!.pairs).toEqual([]);
    await undoLast();
    expect((await db.items.get(tee))!.pairs).toEqual([jeans]);
  });
});

describe('regulars', () => {
  const o = (id: string, ids: string[], createdAt: number): Outfit => ({ id, itemIds: ids, dressCodes: [], createdAt, updatedAt: 0 });
  const w = (day: string, outfitId: string): Wear => ({ id: day, day, itemIds: [], outfitId, updatedAt: 0 });
  it('most worn first, then newest', () => {
    const o1 = o('o1', ['a'], 1), o2 = o('o2', ['b'], 0), o3 = o('o3', ['c'], 5);
    expect(regulars([o1, o2, o3], [w('2026-11-01', 'o2'), w('2026-11-02', 'o2'), w('2026-11-03', 'o1')]).map((x) => x.id)).toEqual(['o2', 'o1', 'o3']);
  });
  it('has the usual dress codes', () => {
    expect(DRESS_CODES).toEqual(['Formal', 'Smart casual', 'Casual', 'Ethnic', 'Gym', 'Lounge']);
  });
});

describe('setKindLane', () => {
  it('gives an owner kind a lane with its usual size, and can take it away', async () => {
    const k = await addKind('Kurtas', null, true);
    await setKindLane(k, 'top');
    expect(await db.kinds.get(k)).toMatchObject({ lane: 'top', layer: 'over', baseScale: 1 });
    await setKindLane(k, 'wrist');
    expect((await db.kinds.get(k))!.layer).toBeUndefined();
    await setKindLane(k, undefined);
    expect((await db.kinds.get(k))!.lane).toBeUndefined();
  });
});
