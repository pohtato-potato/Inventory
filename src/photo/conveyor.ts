import { db } from '../db/db';
import { createItemWithPhoto, getSetting, savePhotos } from '../db/actions';
import { guessShades } from '../domain/colour';
import type { Id, Item } from '../domain/types';
import { queue, shrinkToWebp, type CutResult } from './cutout';

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

let started = false;
const doneListeners = new Set<(id: Id, ok: boolean) => void>();

export function onCutoutLanded(cb: (id: Id, ok: boolean) => void): () => void {
  doneListeners.add(cb);
  return () => doneListeners.delete(cb);
}

/** Starts listening to the queue, and re-queues pieces whose cut-out never finished (the app was closed). */
export async function startConveyor(): Promise<void> {
  if (started) return;
  started = true;
  queue.onDone(async (id, res) => {
    const r = res.value;
    if (r) await landCutout(id, r);
    else await db.items.update(id, { cutout: 'uncut', updatedAt: Date.now() });
    doneListeners.forEach((l) => l(id, !!r?.cutout));
  });
  const waiting = await db.items.filter((i) => i.cutout === 'pending' && i.deletedAt === undefined).toArray();
  for (const i of waiting.sort((a, b) => a.createdAt - b.createdAt)) {
    const p = await db.photos.where('itemId').equals(i.id).filter((x) => x.role === 'original').first();
    if (!p) continue;
    try {
      queue.add(await createImageBitmap(p.blob), i.id);
    } catch {
      await db.items.update(i.id, { cutout: 'uncut' });
    }
  }
}

/** One shot: saves it as a new piece straight away and queues its cut-out. Returns the new piece's id. */
export async function addShot(bitmap: ImageBitmap, scope: 'clothing' | 'things' = 'clothing'): Promise<Id> {
  const original = await shrinkToWebp(bitmap);
  const kindId = await getSetting<string>(scope === 'things' ? 'add.lastThingKind' : 'add.lastKind', scope === 'things' ? 'k-o-other' : 'k-tees');
  const kind = await db.kinds.get(kindId);
  const id = await createItemWithPhoto(
    { name: 'New piece', kindId: kind && !kind.deletedAt ? kindId : scope === 'things' ? 'k-o-other' : 'k-tees', needsDetails: true, cutout: 'pending' },
    [{ role: 'original', ...original }],
  );
  queue.add(bitmap, id);
  return id;
}

export function pendingCutouts(): number {
  return queue.pending();
}
