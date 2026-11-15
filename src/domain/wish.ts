// Wishes: what a shared link brings in, whether a wish is waiting, and the order the board shows them.
import type { Tier, Wish } from './types';

const SHOPS: Record<string, string> = { myntra: 'Myntra', amazon: 'Amazon', ajio: 'Ajio' };

/** Only http and https links are kept; anything else (javascript:, data:) is dropped. */
function safeUrl(s: string | null | undefined): URL | null {
  if (!s) return null;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** The shop's name from a link's host: known shops by name, else the host's first label capitalised. */
function shopOf(u: URL): string {
  const labels = u.hostname.replace(/^www\./, '').split('.');
  const known = labels.find((l) => SHOPS[l]);
  if (known) return SHOPS[known];
  const first = labels[0] === 'shop' || labels[0] === 'm' ? labels[1] ?? labels[0] : labels[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Reads what a shop app shared into the app (the manifest's share target sends title, text and url).
 * Returns null when nothing was shared. Shop apps often put the link inside `text`, so it is looked for there too.
 */
export function parseShare(search: string): { name?: string; url?: string; shop?: string } | null {
  const q = new URLSearchParams(search);
  const title = q.get('title')?.trim() ?? '';
  const text = q.get('text')?.trim() ?? '';
  const rawUrl = q.get('url')?.trim() ?? '';
  if (!title && !text && !rawUrl) return null;
  const inText = text.match(/https?:\/\/\S+/i)?.[0];
  const u = safeUrl(rawUrl) ?? safeUrl(inText);
  const words = (inText ? text.replace(inText, '') : text).replace(/\s+/g, ' ').trim();
  const out: { name?: string; url?: string; shop?: string } = {};
  const name = title || (safeUrl(words) || /^[a-z]+:/i.test(words) ? '' : words);
  if (name) out.name = name;
  if (u) {
    out.url = u.href;
    out.shop = shopOf(u);
  }
  return out;
}

/** A wish is waiting until its date comes (that day it stops waiting), or until its note is cleared by hand. */
export function isWaiting(w: Wish, today: string): boolean {
  const wait = w.waitUntil;
  if (!wait) return false;
  if (wait.date) return wait.date > today;
  return !!wait.note?.trim();
}

const TIER_ORDER: Record<Tier, number> = { now: 0, soon: 1, someday: 2 };
const STATUS_ORDER: Record<Wish['status'], number> = { open: 0, bought: 1, dropped: 2 };

/** Open wishes first, by tier; within a tier the waiting ones go last; newest first. */
export function sortWishes(ws: Wish[], today: string): Wish[] {
  return [...ws].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      Number(isWaiting(a, today)) - Number(isWaiting(b, today)) ||
      b.createdAt - a.createdAt,
  );
}
