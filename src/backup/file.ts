import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { db, TABLES } from '../db/db';
import { clearUndo, getSetting, setSetting } from '../db/actions';
import type { Photo } from '../domain/types';

export const BACKUP_VERSION = 1;
export const NOT_A_BACKUP = 'This file is not an Inventory backup';
export const TOO_NEW = 'This backup was made by a newer version of Inventory';
const LAST_KEY = 'backup.last';

type PhotoRow = Omit<Photo, 'blob'> & { type: string };
interface BackupData {
  app: 'inventory';
  version: number;
  madeAt: number;
  tables: Record<string, unknown[]>;
}

/** Everything as a zip: data.json plus photos/<id>.webp. */
export async function exportAll(): Promise<Blob> {
  const madeAt = Date.now();
  await setSetting(LAST_KEY, madeAt);
  const files: Zippable = {};
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    if (t === 'photos') continue;
    tables[t] = await db.table(t).toArray();
  }
  const rows: PhotoRow[] = [];
  for (const p of await db.photos.toArray()) {
    const { blob, ...meta } = p;
    rows.push({ ...meta, type: blob.type || 'image/webp' });
    files[`photos/${p.id}.webp`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
  }
  tables.photos = rows;
  const data: BackupData = { app: 'inventory', version: BACKUP_VERSION, madeAt, tables };
  files['data.json'] = strToU8(JSON.stringify(data));
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

const REQUIRED = ['items', 'kinds', 'shades', 'places'] as const;

/** Every table present is a list of rows with an id (settings: a key); the trees and pieces must be there. */
function checkTables(t: unknown): t is Record<string, unknown[]> {
  if (!t || typeof t !== 'object') return false;
  const tables = t as Record<string, unknown>;
  if (REQUIRED.some((k) => !Array.isArray(tables[k]))) return false;
  if (!(tables.kinds as unknown[]).length) return false;
  for (const name of TABLES) {
    const rows = tables[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) return false;
    const key = name === 'settings' ? 'key' : 'id';
    if (rows.some((r) => !r || typeof r !== 'object' || typeof (r as Record<string, unknown>)[key] !== 'string')) return false;
  }
  return true;
}

/** Replaces everything with the backup. Checks the whole file before touching the database. */
export async function importAll(zip: Blob): Promise<{ items: number; photos: number }> {
  let files: Record<string, Uint8Array>;
  let data: BackupData;
  try {
    files = unzipSync(new Uint8Array(await zip.arrayBuffer()));
    data = JSON.parse(strFromU8(files['data.json']));
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!data || typeof data !== 'object' || data.app !== 'inventory' || typeof data.version !== 'number') throw new Error(NOT_A_BACKUP);
  if (data.version > BACKUP_VERSION) throw new Error(TOO_NEW);
  if (!checkTables(data.tables)) throw new Error(NOT_A_BACKUP);
  const photoRows = (data.tables.photos ?? []) as PhotoRow[];
  const photos: Photo[] = [];
  for (const { type, ...row } of photoRows) {
    const bytes = files[`photos/${row.id}.webp`];
    if (!bytes) throw new Error(NOT_A_BACKUP); // a photo named but missing: the file is incomplete
    photos.push({ ...row, blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: type || 'image/webp' }) });
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (t === 'photos') await db.photos.bulkPut(photos);
      else if (Array.isArray(data.tables[t])) await db.table(t).bulkPut(data.tables[t]);
    }
  });
  clearUndo();
  return { items: (data.tables.items ?? []).length, photos: photos.length };
}

export async function lastBackup(): Promise<number | null> {
  return getSetting<number | null>(LAST_KEY, null);
}

export async function markBackup(at = Date.now()): Promise<void> {
  await setSetting(LAST_KEY, at);
}
