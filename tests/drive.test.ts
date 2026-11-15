import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/db';
import { seedIfEmpty } from '../src/db/seed';
import { createItemWithPhoto } from '../src/db/actions';
import { backupWith, type BackupRemote } from '../src/backup/drive';
import { acceptReturn, authUrl, DRIVE_SCOPE, readTokenHash, usableToken } from '../src/backup/google';
import { lastBackup } from '../src/backup/file';
import { parseStarter } from '../src/backup/starter';

function fakeRemote() {
  const files = new Map<string, Blob>();
  const writes: string[] = [];
  const remote: BackupRemote = {
    async list() { return new Set(files.keys()); },
    async write(name, blob) { writes.push(name); files.set(name, blob); },
  };
  return { files, writes, remote };
}

const ph = (text: string) => ({ role: 'main' as const, blob: new Blob([text], { type: 'image/webp' }), w: 4, h: 3 });

beforeEach(async () => {
  await db.delete();
  await db.open();
  await seedIfEmpty();
});

describe('Drive backup', () => {
  it('uploads every photo once, then only what changed; data.json every run (uploaded counts photos)', async () => {
    const a = await createItemWithPhoto({ name: 'A', kindId: 'k-tees' }, [ph('a')]);
    await createItemWithPhoto({ name: 'B', kindId: 'k-tees' }, [ph('b')]);
    const r = fakeRemote();
    expect(await backupWith(r.remote)).toEqual({ uploaded: 2 });
    expect(r.writes.filter((n) => n.endsWith('.webp'))).toHaveLength(2);
    expect(r.writes).toContain('data.json');
    r.writes.length = 0;
    expect(await backupWith(r.remote)).toEqual({ uploaded: 0 });
    expect(r.writes).toEqual(['data.json']);
    const photo = (await db.photos.where('itemId').equals(a).first())!;
    await db.photos.update(photo.id, { updatedAt: photo.updatedAt + 5, blob: new Blob(['a2'], { type: 'image/webp' }) });
    r.writes.length = 0;
    expect(await backupWith(r.remote)).toEqual({ uploaded: 1 });
    expect(r.writes[0]).toBe(`${photo.id}-${photo.updatedAt + 5}.webp`);
    expect(await lastBackup()).toBeGreaterThan(0);
  });

  it('data.json names the photo file for each photo', async () => {
    await createItemWithPhoto({ name: 'A', kindId: 'k-tees' }, [ph('a')]);
    const r = fakeRemote();
    await backupWith(r.remote);
    const data = JSON.parse(await r.files.get('data.json')!.text());
    expect(data.app).toBe('inventory');
    expect(data.tables.items).toHaveLength(1);
    expect(r.files.has(data.tables.photos[0].file)).toBe(true);
  });
});

describe('Google sign-in', () => {
  it('reads a token or a refusal from the address', () => {
    expect(readTokenHash('#access_token=abc&expires_in=3600&scope=x%20y&state=s', 1000)).toEqual({ state: 's', token: 'abc', expiresAt: 1000 + 3600_000, scopes: ['x', 'y'] });
    expect(readTokenHash('#error=access_denied&state=s')).toEqual({ state: 's', error: 'access_denied' });
    expect(readTokenHash('#/wardrobe')).toBeNull();
  });
  it('uses a token only with a minute to spare, for its scopes', () => {
    const k = { token: 't', expiresAt: 100_000, scopes: [DRIVE_SCOPE] };
    expect(usableToken(k, [DRIVE_SCOPE], 30_000)).toBe('t');
    expect(usableToken(k, [DRIVE_SCOPE], 50_000)).toBeNull();
    expect(usableToken(k, ['other'], 0)).toBeNull();
  });
  it("keeps a returning token only when it answers Inventory's own request, within ten minutes", () => {
    const hash = '#access_token=abc&expires_in=3600&scope=s&state=st';
    expect(acceptReturn(hash, { state: 'st', at: 0, popup: true }, 60_000)).toMatchObject({ token: 'abc' });
    expect(acceptReturn(hash, { state: 'other', at: 0, popup: true }, 60_000)).toBeNull();
    expect(acceptReturn(hash, { state: 'st', at: 0, popup: true }, 11 * 60_000)).toBeNull();
    expect(acceptReturn(hash, null)).toBeNull();
  });
  it('asks Google for drive.file only', () => {
    const u = new URL(authUrl('cid', [DRIVE_SCOPE], 'https://example.test/inventory/', 'st'));
    expect(u.searchParams.get('scope')).toBe(DRIVE_SCOPE);
    expect(u.searchParams.get('response_type')).toBe('token');
  });
});

describe('starter file', () => {
  it('reads the Google client id from an Inventory starter file', () => {
    expect(parseStarter(JSON.stringify({ format: 'inventory-starter', version: 1, keys: { googleClientId: 'cid.apps' } }))).toEqual({ googleClientId: 'cid.apps' });
  });
  it("also takes the client id from a family app's starter file", () => {
    expect(parseStarter(JSON.stringify({ format: 'media-starter', version: 1, keys: { googleClientId: 'cid', tmdb: 'x' } }))).toEqual({ googleClientId: 'cid' });
  });
  it('refuses anything else, in plain words', () => {
    expect(() => parseStarter('nope')).toThrow('This file is not a starter file. Nothing was changed.');
    expect(() => parseStarter(JSON.stringify({ format: 'inventory-starter', version: 1, keys: {} }))).toThrow('This starter file has no Google client id. Nothing was changed.');
  });
});
