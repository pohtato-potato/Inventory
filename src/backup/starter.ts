/* The owner's private starter file holds the Google client id; it never lives in the repo.
   Inventory takes its own starter file, or a family app's (Health, Logbook, Media), and reads only keys.googleClientId. */
const FORMATS = ['inventory-starter', 'media-starter', 'logbook-starter', 'health-starter'];
const NOT_STARTER = 'This file is not a starter file. Nothing was changed.';

export function parseStarter(text: string): { googleClientId: string } {
  let s: { format?: unknown; keys?: { googleClientId?: unknown } };
  try { s = JSON.parse(text); } catch { throw new Error(NOT_STARTER); }
  if (!s || typeof s !== 'object' || !FORMATS.includes(String(s.format))) throw new Error(NOT_STARTER);
  const id = s.keys?.googleClientId;
  if (typeof id !== 'string' || !id.trim()) throw new Error('This starter file has no Google client id. Nothing was changed.');
  return { googleClientId: id.trim() };
}
