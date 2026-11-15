import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Id, Item, ItemEvent, Kind, Photo, Place, Shade, Wear } from '../domain/types';
import { dayStart, wearStats } from '../domain/wearlog';
import { db } from './db';

export interface Trees {
  kinds: Kind[];
  shades: Shade[];
  places: Place[];
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/** Live list of pieces that are not in the trash, optionally filtered. */
export function useItems(filter?: (i: Item) => boolean, deps: unknown[] = []): Item[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.items.filter((i) => i.deletedAt === undefined).toArray();
    return filter ? all.filter(filter) : all;
  }, deps);
}

export function useTrashed(): Item[] | undefined {
  return useLiveQuery(() => db.items.filter((i) => i.deletedAt !== undefined).toArray(), []);
}

export function useItem(id: Id | null | undefined): Item | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.items.get(id)) ?? null) : null), [id]);
}

export function useTrees(): Trees | undefined {
  return useLiveQuery(async () => {
    const [kinds, shades, places] = await Promise.all([db.kinds.toArray(), db.shades.toArray(), db.places.toArray()]);
    return {
      kinds: kinds.filter((k) => !k.deletedAt).sort(byOrder),
      shades: shades.filter((s) => !s.deletedAt).sort(byOrder),
      places: places.filter((p) => !p.deletedAt).sort(byOrder),
    };
  }, []);
}

export function useEvents(itemId: Id | null | undefined): ItemEvent[] | undefined {
  return useLiveQuery(async () => (itemId ? db.events.where('itemId').equals(itemId).sortBy('at') : []), [itemId]);
}

/** The last time each piece was worn (local midnight of that day), and on how many days. Read from the wear record. */
export function useWearLog(): { last: Map<Id, number>; count: Map<Id, number> } | undefined {
  return useLiveQuery(async () => {
    const s = wearStats(await db.wears.toArray());
    return { last: new Map([...s.last].map(([id, day]) => [id, dayStart(day)])), count: s.count };
  }, []);
}

/** Every wear, oldest day first. */
export function useWears(): Wear[] | undefined {
  return useLiveQuery(() => db.wears.orderBy('day').toArray(), []);
}

// Object URLs for stored photos, kept per photo version so tiles do not flicker.
const urls = new Map<string, string>();
function urlFor(p: Photo): string {
  const key = `${p.id}:${p.updatedAt}`;
  let u = urls.get(key);
  if (!u) {
    u = URL.createObjectURL(p.blob);
    urls.set(key, u);
  }
  return u;
}

/** The URL of a piece's photo in the given role (main falls back to the original). */
export function usePhoto(itemId: Id | null | undefined, role: Photo['role'] = 'main'): { url: string; photo: Photo } | null | undefined {
  return useLiveQuery(async () => {
    if (!itemId) return null;
    const list = await db.photos.where('itemId').equals(itemId).toArray();
    const p = list.find((x) => x.role === role) ?? (role === 'main' ? list.find((x) => x.role === 'original') : undefined);
    return p ? { url: urlFor(p), photo: p } : null;
  }, [itemId, role]);
}

/** Every photo of a piece, main first, then the original, then extras. */
export function usePhotos(itemId: Id | null | undefined): { url: string; photo: Photo }[] | undefined {
  return useLiveQuery(async () => {
    if (!itemId) return [];
    const rank: Record<Photo['role'], number> = { main: 0, original: 1, extra: 2, selfie: 3, wish: 4 };
    const list = await db.photos.where('itemId').equals(itemId).toArray();
    return list.sort((a, b) => rank[a.role] - rank[b.role] || a.updatedAt - b.updatedAt).map((p) => ({ url: urlFor(p), photo: p }));
  }, [itemId]);
}

export interface Thumb {
  url: string;
  /** true for a cut-out, false for an uncut photo */
  cut: boolean;
}

/** Main photos for many pieces at once (grids). Falls back to the uncut photo. */
export function useMainPhotos(): Map<Id, Thumb> | undefined {
  return useLiveQuery(async () => {
    const out = new Map<Id, Thumb>();
    const fallback = new Map<Id, Photo>();
    await db.photos.each((p) => {
      if (p.role === 'main') out.set(p.itemId, { url: urlFor(p), cut: true });
      else if (p.role === 'original') fallback.set(p.itemId, p);
    });
    for (const [id, p] of fallback) if (!out.has(id)) out.set(id, { url: urlFor(p), cut: false });
    return out;
  }, []);
}

export function useSetting<T>(key: string, fallback: T): T {
  const v = useLiveQuery(async () => (await db.settings.get(key))?.value as T | undefined, [key]);
  return v === undefined ? fallback : v;
}

/** True once the first query has run, for showing nothing instead of a flash of "empty". */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
