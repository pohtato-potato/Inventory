import { db, TABLES } from '../db/db';
import { getSetting } from '../db/actions';
import { BACKUP_VERSION, markBackup } from './file';
import { DRIVE_SCOPE, signIn } from './google';
import { authCall, authSend, OfflineError, type AuthCall, type AuthSend } from './http';

/* Drive backup, ported from Media's src/sync/drive.ts: a visible "Inventory" folder, resumable uploads a few MB at a time.
   With drive.file, Inventory sees only the files it made. One file per photo, named by its id and when it last changed,
   so a run sends only new or changed photos; data.json is replaced every run. Old photo versions stay in the folder. */
const API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files', FOLDER = 'application/vnd.google-apps.folder';
const CHUNK = 4 * 1024 * 1024;
export const CLIENT_ID_KEY = 'backup.clientId';
const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export interface BackupRemote {
  list(): Promise<Set<string>>;
  write(name: string, blob: Blob): Promise<void>;
}

export const photoFile = (p: { id: string; updatedAt: number }) => `${p.id}-${p.updatedAt}.webp`;

/** One run against any remote: changed photos first, then data.json naming each photo's file. */
export async function backupWith(remote: BackupRemote): Promise<{ uploaded: number }> {
  const have = await remote.list();
  let uploaded = 0; // photos sent this run
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) if (t !== 'photos') tables[t] = await db.table(t).toArray();
  const rows: unknown[] = [];
  for (const p of await db.photos.toArray()) {
    const { blob, ...meta } = p;
    const file = photoFile(p);
    if (!have.has(file)) {
      await remote.write(file, blob);
      uploaded++;
    }
    rows.push({ ...meta, type: blob.type || 'image/webp', file });
  }
  tables.photos = rows;
  const madeAt = Date.now();
  await remote.write('data.json', new Blob([JSON.stringify({ app: 'inventory', version: BACKUP_VERSION, madeAt, tables })], { type: 'application/json' }));
  await markBackup(madeAt);
  return { uploaded };
}

const find = async (call: AuthCall, query: string) => ((await call(`${API}?${new URLSearchParams({ q: query, fields: 'files(id,name)', spaces: 'drive', orderBy: 'createdTime' })}`)) as { files?: { id: string }[] }).files?.[0]?.id;
async function folder(call: AuthCall, name = 'Inventory'): Promise<string> {
  const query = `name='${q(name)}' and mimeType='${FOLDER}' and trashed=false`;
  const have = await find(call, query); if (have) return have;
  const made = ((await call(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER }) })) as { id: string }).id;
  return (await find(call, query)) ?? made;
}
async function listFolder(call: AuthCall, parent: string) {
  const out = new Map<string, string>(); let page = '';
  do {
    const r = (await call(`${API}?${new URLSearchParams({ q: `'${parent}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name)', pageSize: '1000', spaces: 'drive', ...(page ? { pageToken: page } : {}) })}`)) as { files?: { id: string; name: string }[]; nextPageToken?: string };
    for (const f of r.files ?? []) out.set(f.name, f.id);
    page = r.nextPageToken ?? '';
  } while (page);
  return out;
}
async function upload(send: AuthSend, parent: string, name: string, blob: Blob, id?: string) {
  const type = blob.type || 'application/octet-stream';
  const start = await send(id ? `${UP}/${id}?uploadType=resumable` : `${UP}?uploadType=resumable`, { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(blob.size) }, body: JSON.stringify(id ? { name } : { name, parents: [parent] }) });
  const session = start.headers.get('Location'); if (!session?.startsWith('https://www.googleapis.com/')) throw new OfflineError();
  let at = 0;
  for (;;) {
    const end = Math.min(at + CHUNK, blob.size), r = await send(session, { method: 'PUT', headers: { 'Content-Range': blob.size ? `bytes ${at}-${end - 1}/${blob.size}` : 'bytes */0' }, body: blob.slice(at, end) });
    if (r.status === 308) { const got = r.headers.get('Range'); at = got ? Number(got.split('-')[1]) + 1 : end; continue; }
    if (r.ok) return;
    throw new OfflineError();
  }
}

function driveRemote(token: string): BackupRemote {
  const call = authCall(token), send = authSend(token);
  let parent: string | undefined, known = new Map<string, string>();
  const dir = async () => (parent ??= await folder(call));
  return {
    async list() { known = await listFolder(call, await dir()); return new Set(known.keys()); },
    async write(name, blob) { await upload(send, await dir(), name, blob, known.get(name)); },
  };
}

export const NO_CLIENT = 'Drive backup is not set up on this phone yet.';
export const NOT_SIGNED_IN = 'Sign-in didn’t finish, so nothing was sent.';

/** Back up now: signs in if needed (drive.file only), then sends what changed. */
export async function backupToDrive(): Promise<{ uploaded: number }> {
  const clientId = await getSetting<string>(CLIENT_ID_KEY, '');
  if (!clientId) throw new Error(NO_CLIENT);
  const token = await signIn(clientId, [DRIVE_SCOPE]);
  if (!token) throw new Error(NOT_SIGNED_IN);
  return backupWith(driveRemote(token));
}
