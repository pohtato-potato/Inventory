// Mirror photos as the face of an outfit or a wear day: the newest one stands in the window instead of the laid-out pieces.
import type { Id, Outfit, Photo, Wear } from './types';

type Shot = Pick<Photo, 'id' | 'itemId' | 'role' | 'updatedAt'>;

const newestFirst = <T extends Shot>(list: T[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? 1 : -1));

/** An outfit's mirror photos, newest first: those kept on the outfit and those taken on days it was worn. The first is its face. */
export function outfitPhotos<T extends Shot>(outfit: Outfit, wears: Wear[], photos: T[]): T[] {
  const owners = new Set<Id>([outfit.id, ...wears.filter((w) => w.outfitId === outfit.id).map((w) => w.id)]);
  return newestFirst(photos.filter((p) => p.role === 'selfie' && owners.has(p.itemId)));
}

/** A wear day's own mirror photos, newest first. */
export function wearPhotos<T extends Shot>(wear: Wear, photos: T[]): T[] {
  return newestFirst(photos.filter((p) => p.role === 'selfie' && p.itemId === wear.id));
}
