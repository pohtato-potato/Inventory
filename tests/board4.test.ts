import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty, STARTER_KINDS, STARTER_PLACES } from '../src/db/seed';
import { yearRooms } from '../src/domain/home';
import { laneFor, layout, needsLane, splitRegulars } from '../src/domain/outfit';
import type { Item, Kind, Outfit, Wear } from '../src/domain/types';
import { dayStart, msToNextDay } from '../src/domain/wearlog';

let n = 0;
const piece = (p: Partial<Item> = {}): Item => ({
  id: `i${++n}`, name: `Piece ${n}`, kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: dayStart('2026-03-01'), updatedAt: 1, ...p,
});
const css = readFileSync('src/styles/base.css', 'utf8');
const rule = (sel: string) => {
  const at = css.indexOf(`\n${sel} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('a. a tall cut-out fits inside its tile', () => {
  it('the piece is drawn in a fixed box inside the window, scaled to fit at any aspect', () => {
    const r = rule('.tile .pc');
    expect(r).toMatch(/position:\s*absolute/);
    expect(r).toMatch(/object-fit:\s*contain/);
    expect(r).toMatch(/height:\s*\d+%/);
    expect(r).not.toMatch(/max-height/);
  });
});

describe('b. the year in review keeps pieces with no spot', () => {
  const spot = { id: 'p-rail', homeId: 'p-home', name: 'Rail', role: 'spot' as const, order: 0, updatedAt: 0 };
  const places = [...STARTER_PLACES, spot];
  it('ends with a "No spot yet" room when pieces with no spot were added or worn that year', () => {
    const kept = piece({ spotId: spot.id });
    const loose = piece();
    const wears: Wear[] = [{ id: 'w', day: '2026-05-01', itemIds: [kept.id, loose.id], updatedAt: 0 }];
    const rooms = yearRooms([kept, loose], wears, places, 2026);
    expect(rooms.at(-1)!.place.name).toBe('No spot yet');
    expect(rooms.at(-1)).toMatchObject({ added: 1, wears: 1, mostWorn: loose });
  });
  it('has no such room when every piece has a spot', () => {
    const rooms = yearRooms([piece({ spotId: spot.id })], [], places, 2026);
    expect(rooms.map((r) => r.place.name)).not.toContain('No spot yet');
  });
});

describe('c. regulars are outfits actually worn', () => {
  const o = (id: string, itemIds: string[], createdAt = 0): Outfit => ({ id, itemIds, dressCodes: [], createdAt, updatedAt: 0 });
  it('worn ones most worn first; never-worn ones apart, newest first', () => {
    const a = o('a', ['x']), b = o('b', ['y']), c = o('c', ['z'], 2), d = o('d', ['q'], 5);
    const wears: Wear[] = [{ id: '1', day: '2026-11-01', itemIds: ['x'], updatedAt: 0 }, { id: '2', day: '2026-11-02', itemIds: ['y'], updatedAt: 0 }, { id: '3', day: '2026-11-03', itemIds: ['y'], updatedAt: 0 }];
    const s = splitRegulars([a, b, c, d], wears);
    expect(s.worn.map((x) => x.id)).toEqual(['b', 'a']);
    expect(s.saved.map((x) => x.id)).toEqual(['d', 'c']);
  });
});

describe('d. lanes for Ethnic and the root kinds', () => {
  const kinds = STARTER_KINDS;
  it('Tops and Bottoms have lanes; Ethnic has Kurtas (top, over) and Ethnic bottoms (bottom)', () => {
    expect(laneFor(piece({ kindId: 'k-tops' }), kinds)).toMatchObject({ lane: 'top', layer: 'over' });
    expect(laneFor(piece({ kindId: 'k-bottoms' }), kinds)).toMatchObject({ lane: 'bottom' });
    const kurtas = kinds.find((k) => k.name === 'Kurtas')!;
    const eb = kinds.find((k) => k.name === 'Ethnic bottoms')!;
    expect(kurtas.parentId).toBe('k-ethnic');
    expect(eb.parentId).toBe('k-ethnic');
    expect(laneFor(piece({ kindId: kurtas.id }), kinds)).toMatchObject({ lane: 'top', layer: 'over' });
    expect(laneFor(piece({ kindId: eb.id }), kinds)).toMatchObject({ lane: 'bottom' });
  });
  it('a piece with no lane from its kind needs asking; its own answer then wins', () => {
    const p = piece({ kindId: 'k-ethnic' });
    expect(needsLane(p, kinds)).toBe(true);
    expect(needsLane(piece({ kindId: 'k-accessories' }), kinds)).toBe(true);
    expect(needsLane(piece({ kindId: 'k-tees' }), kinds)).toBe(false);
    const told = { ...p, outfitLane: 'bottom' as const };
    expect(needsLane(told, kinds)).toBe(false);
    expect(laneFor(told, kinds).lane).toBe('bottom');
    expect(layout([told], kinds, new Map())[0].lane).toBe('bottom');
  });

  beforeEach(async () => {
    await db.delete();
    await db.open();
  });
  it('a database from Build 2 gets the new kinds and root lanes on start; existing Ethnic pieces stay valid', async () => {
    // Build 2's starter kinds: no Kurtas or Ethnic bottoms, no lanes on the roots.
    const old: Kind[] = STARTER_KINDS.filter((k) => k.id !== 'k-kurtas' && k.id !== 'k-ethnic-bottoms').map((k) => {
      if (k.id !== 'k-tops' && k.id !== 'k-bottoms') return k;
      const { lane: _l, layer: _y, baseScale: _b, ...rest } = k;
      return rest;
    });
    await db.kinds.bulkAdd(old);
    await db.items.add(piece({ id: 'kurta', kindId: 'k-ethnic' }));
    await seedIfEmpty();
    expect(await db.kinds.get('k-kurtas')).toMatchObject({ parentId: 'k-ethnic', lane: 'top' });
    expect(await db.kinds.get('k-ethnic-bottoms')).toMatchObject({ parentId: 'k-ethnic', lane: 'bottom' });
    expect((await db.kinds.get('k-tops'))!.lane).toBe('top');
    expect((await db.items.get('kurta'))!.kindId).toBe('k-ethnic');
    await seedIfEmpty();
    expect(await db.kinds.where('parentId').equals('k-ethnic').count()).toBe(2);
  });
  it('leaves alone a root lane the owner cleared, and a Kurtas kind the owner already made', async () => {
    await db.kinds.bulkAdd(STARTER_KINDS.filter((k) => k.id !== 'k-kurtas').map((k) => (k.id === 'k-tops' ? { ...k, lane: undefined, layer: undefined, updatedAt: 5 } : k)));
    await db.kinds.add({ id: 'mine', parentId: 'k-ethnic', name: 'kurtas', clothing: true, fields: [], order: 50, updatedAt: 5 });
    await seedIfEmpty();
    expect((await db.kinds.get('k-tops'))!.lane).toBeUndefined();
    expect(await db.kinds.get('k-kurtas')).toBeUndefined();
  });
});

describe('the wear log follows the clock past midnight', () => {
  it('knows how long until the next local day', () => {
    expect(msToNextDay(new Date(2026, 10, 16, 23, 59, 0).getTime())).toBe(60_000);
    expect(msToNextDay(new Date(2026, 10, 16, 0, 0, 0).getTime())).toBe(864e5);
  });
});

describe('the "gone" label under a stage piece', () => {
  it('sits inside the piece, so the window never cuts it off', () => {
    const r = rule('.stage-gone');
    expect(r).not.toMatch(/top:\s*100%/);
    expect(r).toMatch(/bottom:\s*\d/);
  });
});
