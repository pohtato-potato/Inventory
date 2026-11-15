import { db } from '../db/db';
import { createItemWithPhoto, getSetting, savePhotos } from '../db/actions';
import { guessShades } from '../domain/colour';
import type { Id, Item } from '../domain/types';
import { createQueue, cutOut, ModelUnavailable, onModelReady, shrinkToWebp, type CutResult } from './cutout';

/**
 * The adding conveyor. Each shot becomes a piece at once (needs details, the last kind used),
 * with the photo as taken; its cut-out lands later, one at a time, and fills in its shades.
 */

/** Puts a finished cut-out on its piece. Quiet: it is not an action the owner can undo. */
export async function landCutout(itemId: Id, r: CutResult): Promise<void> {
  const item = await db.items.get(itemId);
  if (!item) return;
  if (!r.cutout || !r.pixels) {
    await db.items.update(itemId, { cutout: 'uncut', updatedAt: Date.now() });
    return;
  }
  await savePhotos(itemId, [{ role: 'main', blob: r.cutout, w: r.cutW ?? r.w, h: r.cutH ?? r.h, replace: true }]);
  const patch: Partial<Item> = { cutout: 'done', updatedAt: Date.now() };
  if (!item.shadeMain) {
    try {
      const shades = (await db.shades.toArray()).filter((s) => !s.deletedAt);
      const g = guessShades(r.pixels, shades);
      patch.shadeMain = g.main.id;
      if (g.second) patch.shadeSecond = g.second.id;
    } catch {
      /* no visible colour: the owner picks it */
    }
  }
  await db.items.update(itemId, patch);
}

/** Cuts one stored photo out. Swappable in tests (Node has no canvas or model). */
let cutter = async (photo: Blob): Promise<CutResult> => {
  const bitmap = await createImageBitmap(photo);
  try {
    return await cutOut(bitmap);
  } finally {
    bitmap.close?.();
  }
};

/** Tests only. */
export function _setCutter(f: (photo: Blob) => Promise<CutResult>): void {
  cutter = f;
}

/**
 * The app's one cut-out queue. Jobs are piece ids: the stored 1600 px original is read and decoded
 * only when its turn comes, so a long batch never holds more than one decoded photo.
 */
const queue = createQueue<Id, CutResult | null>(async (id) => {
  const item = await db.items.get(id);
  if (!item || item.deletedAt !== undefined || item.cutout !== 'pending') return null;
  const p = await db.photos.where('itemId').equals(id).filter((x) => x.role === 'original').first();
  if (!p) return null;
  return cutter(p.blob);
});

let started = false;
const doneListeners = new Set<(id: Id, ok: boolean) => void>();

export function onCutoutLanded(cb: (id: Id, ok: boolean) => void): () => void {
  doneListeners.add(cb);
  return () => doneListeners.delete(cb);
}

/** Queues every piece still waiting for its cut-out that is not already in the queue, oldest first. */
export async function requeuePending(): Promise<void> {
  const waiting = await db.items.filter((i) => i.cutout === 'pending' && i.deletedAt === undefined).toArray();
  for (const i of waiting.sort((a, b) => a.createdAt - b.createdAt)) if (!queue.has(i.id)) queue.add(i.id, i.id);
}

/** Starts listening to the queue, and re-queues pieces whose cut-out never finished (the app was closed, or the tool was not ready). */
export async function startConveyor(): Promise<void> {
  if (started) return;
  started = true;
  queue.onDone(async (id, res) => {
    // The tool itself was unavailable: the piece stays waiting and is tried again once the model loads.
    if (res.error instanceof ModelUnavailable) return;
    try {
      if (res.value) await landCutout(id, res.value);
      else if (res.error) await db.items.update(id, { cutout: 'uncut', updatedAt: Date.now() });
      else return; // deleted or already done meanwhile
    } catch {
      return; // e.g. phone full: it stays waiting and is tried again next time
    }
    doneListeners.forEach((l) => l(id, !!res.value?.cutout));
  });
  onModelReady(() => void requeuePending());
  await requeuePending();
}

/** One shot: saves it as a new piece straight away and queues its cut-out. Returns the new piece's id. */
export async function addShot(
  bitmap: ImageBitmap,
  scope: 'clothing' | 'things' = 'clothing',
  shrink: (b: ImageBitmap) => Promise<{ blob: Blob; w: number; h: number }> = shrinkToWebp,
): Promise<Id> {
  let original: { blob: Blob; w: number; h: number };
  try {
    original = await shrink(bitmap);
  } finally {
    bitmap.close?.(); // the full-size frame is not kept; the queue reads the saved original
  }
  const kindId = await getSetting<string>(scope === 'things' ? 'add.lastThingKind' : 'add.lastKind', scope === 'things' ? 'k-o-other' : 'k-tees');
  const kind = await db.kinds.get(kindId);
  const id = await createItemWithPhoto(
    { name: 'New piece', kindId: kind && !kind.deletedAt ? kindId : scope === 'things' ? 'k-o-other' : 'k-tees', needsDetails: true, cutout: 'pending' },
    [{ role: 'original', ...original }],
  );
  queue.add(id, id);
  return id;
}

/** Retake after a failed cut-out: the new photo replaces the old one (and any cut-out), and the piece is cut again. */
export async function retakeShot(
  itemId: Id,
  bitmap: ImageBitmap,
  shrink: (b: ImageBitmap) => Promise<{ blob: Blob; w: number; h: number }> = shrinkToWebp,
): Promise<void> {
  let original: { blob: Blob; w: number; h: number };
  try {
    original = await shrink(bitmap);
  } finally {
    bitmap.close?.();
  }
  await savePhotos(itemId, [{ role: 'original', ...original, replace: true }]);
  await db.transaction('rw', db.photos, db.items, async () => {
    await db.photos.where('itemId').equals(itemId).filter((p) => p.role === 'main').delete();
    await db.items.update(itemId, { cutout: 'pending', updatedAt: Date.now() });
  });
  if (!queue.has(itemId)) queue.add(itemId, itemId);
}

/** Keep as it is: the owner accepts the photo as taken, so the app stops offering a retake. */
export async function keepUncut(itemId: Id): Promise<void> {
  await db.items.update(itemId, { cutout: 'kept', updatedAt: Date.now() });
}

export function pendingCutouts(): number {
  return queue.pending();
}
