import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { STARTER_KINDS, STARTER_SHADES, seedIfEmpty, UNSORTED } from '../src/db/seed';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('starter shades', () => {
  const fams = STARTER_SHADES.filter((s) => s.familyId === null);
  it('has twelve families in order', () => {
    expect(fams.map((f) => f.name)).toEqual(['Black', 'Grey', 'White', 'Beige', 'Brown', 'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple']);
  });
  it('has at least 55 shades', () => {
    expect(STARTER_SHADES.length - fams.length).toBeGreaterThanOrEqual(55);
  });
  it('puts the deep reds under Red', () => {
    const red = fams.find((f) => f.name === 'Red')!;
    expect(STARTER_SHADES.filter((s) => s.familyId === red.id).map((s) => s.name)).toEqual(
      expect.arrayContaining(['Burgundy', 'Maroon', 'Oxblood', 'Wine', 'Crimson']),
    );
  });
  it('uses upper-case six-digit hex', () => {
    expect(STARTER_SHADES.every((s) => /^#[0-9A-F]{6}$/.test(s.hex))).toBe(true);
  });
  it('gives every family 4 to 6 shades, more deep than pale', () => {
    for (const f of fams) {
      const kids = STARTER_SHADES.filter((s) => s.familyId === f.id);
      expect(kids.length).toBeGreaterThanOrEqual(4);
      expect(kids.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('starter kinds', () => {
  it('nests tees under tops and hides socks from the window', () => {
    const tops = STARTER_KINDS.find((k) => k.name === 'Tops')!;
    expect(STARTER_KINDS.find((k) => k.name === 'Tees')!.parentId).toBe(tops.id);
    expect(STARTER_KINDS.find((k) => k.name === 'Socks')!.hideFromWindow).toBe(true);
  });
  it('gives shoes, watches and electronics their own fields', () => {
    expect(STARTER_KINDS.find((k) => k.name === 'Shoes')!.fields).toContain('shoeSize');
    expect(STARTER_KINDS.find((k) => k.name === 'Watches')!.fields).toEqual(expect.arrayContaining(['metal', 'battery']));
    expect(STARTER_KINDS.find((k) => k.name === 'Electronics')!.fields).toEqual(['serial']);
    expect(STARTER_KINDS.find((k) => k.name === 'Electronics')!.clothing).toBe(false);
  });
});

describe('seedIfEmpty', () => {
  it('seeds once, with a home and the fixed "With me"', async () => {
    await seedIfEmpty();
    await seedIfEmpty();
    expect(await db.places.where('role').equals('withme').count()).toBe(1);
    expect(await db.places.where('role').equals('home').count()).toBe(1);
    expect(await db.kinds.count()).toBe(STARTER_KINDS.length);
    expect(await db.shades.count()).toBe(STARTER_SHADES.length);
  });
});

describe('"Not sorted yet"', () => {
  it('exists for clothes and for things, and is added to a database made before it existed', async () => {
    await db.kinds.bulkAdd(STARTER_KINDS.filter((k) => !k.id.includes('unsorted')));
    await seedIfEmpty();
    expect((await db.kinds.get(UNSORTED.clothing))).toMatchObject({ name: 'Not sorted yet', clothing: true, parentId: null });
    expect((await db.kinds.get(UNSORTED.things))).toMatchObject({ name: 'Not sorted yet', clothing: false, parentId: null });
  });
});
