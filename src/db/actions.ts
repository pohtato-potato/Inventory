import type { EventType, Gone, Id, Item, ItemEvent, Kind, Lane, Outfit, Photo, Place, Rough, Shade, Wear, Wish } from '../domain/types';
import { UNSORTED } from '../domain/fields';
import { samePieces } from '../domain/outfit';
import { dayKey, dayStart } from '../domain/wearlog';
import { db, newId } from './db';
import { WITH_ME_ID } from './seed';

export const DAY = 24 * 60 * 60 * 1000;
export const TRASH_DAYS = 30;
const UNDO_DEPTH = 20;

export const NO_SPACE = 'Not enough space to save this photo';

// ---------- undo ----------

interface UndoStep {
  label: string;
  run: () => Promise<void>;
}
const undoStack: UndoStep[] = [];
const undoListeners = new Set<() => void>();

function pushUndo(label: string, run: () => Promise<void>) {
  undoStack.push({ label, run });
  if (undoStack.length > UNDO_DEPTH) undoStack.shift();
  undoListeners.forEach((l) => l());
}

/** Undoes the most recent action. Returns what was undone, or null when there is nothing. */
export async function undoLast(): Promise<string | null> {
  const step = undoStack.pop();
  if (!step) return null;
  await step.run();
  undoListeners.forEach((l) => l());
  return step.label;
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function clearUndo() {
  undoStack.length = 0;
}

export const pieces = (n: number) => `${n} piece${n === 1 ? '' : 's'}`;

// ---------- helpers ----------

function isQuota(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string }; message?: string } | undefined;
  return err?.name === 'QuotaExceededError' || err?.inner?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? '');
}

let lastAt = 0;
/** A timestamp that never repeats, so events keep their order. */
function stamp(): number {
  const t = Date.now();
  lastAt = t > lastAt ? t : lastAt + 1;
  return lastAt;
}

function event(itemId: Id, type: EventType, at: number, data?: Record<string, unknown>): ItemEvent {
  return data ? { id: newId(), itemId, at, type, data } : { id: newId(), itemId, at, type };
}

function blankItem(draft: Partial<Item>, now: number): Item {
  return {
    name: 'New piece',
    kindId: 'k-o-other',
    count: 1,
    currency: 'INR',
    tags: [],
    usualSpotIds: [],
    status: 'owned',
    needsDetails: false,
    extra: {},
    ...draft,
    id: draft.id ?? newId(),
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  };
}

/** Changes items in one transaction, records an event per item, and makes the change undoable. */
async function changeItems(
  ids: Id[],
  label: string,
  type: EventType,
  change: (item: Item) => Partial<Item>,
  data?: (before: Item) => Record<string, unknown>,
): Promise<void> {
  const before: Item[] = [];
  const eventIds: Id[] = [];
  await db.transaction('rw', db.items, db.events, async () => {
    const now = stamp();
    const items = (await db.items.bulkGet(ids)).filter((i): i is Item => !!i);
    for (const item of items) {
      before.push(item);
      await db.items.update(item.id, { ...change(item), updatedAt: now });
      const e = event(item.id, type, now, data?.(item));
      eventIds.push(e.id);
      await db.events.add(e);
    }
  });
  if (!before.length) return;
  pushUndo(label, async () => {
    await db.transaction('rw', db.items, db.events, async () => {
      const now = stamp();
      await db.items.bulkPut(before.map((b) => ({ ...b, updatedAt: now })));
      await db.events.bulkDelete(eventIds);
    });
  });
}

// ---------- items ----------

export async function createItemWithPhoto(
  draft: Partial<Item>,
  photos: { role: Photo['role']; blob: Blob; w: number; h: number }[],
): Promise<Id> {
  const now = stamp();
  const item = blankItem(draft, now);
  try {
    await db.transaction('rw', db.items, db.photos, db.events, async () => {
      await db.items.add(item);
      if (photos.length) {
        await db.photos.bulkAdd(photos.map((p) => ({ id: newId(), itemId: item.id, updatedAt: now, ...p })));
      }
      await db.events.add(event(item.id, 'added', now));
    });
  } catch (e) {
    if (isQuota(e)) throw new Error(NO_SPACE);
    throw e;
  }
  pushUndo(`Added ${item.name}`, () => hardDelete([item.id]));
  return item.id;
}

/** Adds or replaces photos on a piece (a cut-out landing, an extra photo). */
export async function savePhotos(itemId: Id, photos: { role: Photo['role']; blob: Blob; w: number; h: number; replace?: boolean }[]): Promise<void> {
  try {
    await db.transaction('rw', db.photos, db.items, async () => {
      const now = stamp();
      for (const { replace, ...p } of photos) {
        if (replace) {
          const old = await db.photos.where('itemId').equals(itemId).filter((x) => x.role === p.role).primaryKeys();
          await db.photos.bulkDelete(old);
        }
        await db.photos.add({ id: newId(), itemId, updatedAt: now, ...p });
      }
      await db.items.update(itemId, { updatedAt: now });
    });
  } catch (e) {
    if (isQuota(e)) throw new Error(NO_SPACE);
    throw e;
  }
}

/**
 * Tap to fix: the owner's new cut-out replaces the main photo (the original stays), the cut-out counts as done,
 * and the shades are re-guessed from it (none guessed: the old ones stay). One step for Undo.
 */
export async function replaceCutout(itemId: Id, main: { blob: Blob; w: number; h: number }, shades: { shadeMain?: Id; shadeSecond?: Id }): Promise<void> {
  const before = await db.items.get(itemId);
  if (!before) return;
  const oldMain = await db.photos.where('itemId').equals(itemId).filter((p) => p.role === 'main').toArray();
  const photoId = newId();
  const now = stamp();
  const e = event(itemId, 'edited', now, { fields: ['photo'] });
  const patch: Partial<Item> = { cutout: 'done', updatedAt: now };
  if (shades.shadeMain) {
    patch.shadeMain = shades.shadeMain;
    patch.shadeSecond = shades.shadeSecond;
  }
  try {
    await db.transaction('rw', db.photos, db.items, db.events, async () => {
      await db.photos.bulkDelete(oldMain.map((p) => p.id));
      await db.photos.add({ id: photoId, itemId, role: 'main', updatedAt: now, ...main });
      await db.items.update(itemId, patch);
      await db.events.add(e);
    });
  } catch (err) {
    if (isQuota(err)) throw new Error(NO_SPACE);
    throw err;
  }
  pushUndo(`Fixed the cut-out of ${before.name}`, async () => {
    await db.transaction('rw', db.photos, db.items, db.events, async () => {
      await db.photos.delete(photoId);
      await db.photos.bulkPut(oldMain);
      await db.items.put({ ...before, updatedAt: stamp() });
      await db.events.delete(e.id);
    });
  });
}

export async function removePhoto(photoId: Id): Promise<void> {
  const p = await db.photos.get(photoId);
  if (!p) return;
  await db.photos.delete(photoId);
  pushUndo('Removed a photo', async () => {
    await db.photos.put(p);
  });
}

export async function updatePhoto(photoId: Id, patch: Partial<Photo>): Promise<void> {
  await db.photos.update(photoId, { ...patch, updatedAt: stamp() });
}

export async function updateItem(id: Id, patch: Partial<Item>, type: EventType = 'edited'): Promise<void> {
  const item = await db.items.get(id);
  const told: Record<string, unknown> = { fields: Object.keys(patch) };
  for (const k of ['fit', 'condition'] as const) if (k in patch) told[k] = patch[k];
  await changeItems([id], `Edited ${item?.name ?? 'the piece'}`, type, () => patch, () => told);
}

export async function updateMany(ids: Id[], patch: Partial<Item>): Promise<void> {
  await changeItems(ids, `Edited ${pieces(ids.length)}`, 'edited', () => patch, () => ({ fields: Object.keys(patch) }));
}

export async function addTags(ids: Id[], tags: string[]): Promise<void> {
  await changeItems(ids, `Edited ${pieces(ids.length)}`, 'edited', (i) => ({ tags: [...new Set([...i.tags, ...tags])] }), () => ({ fields: ['tags'] }));
}

/** Batch edit: field changes and added tags together, as one step for Undo. */
export async function editMany(ids: Id[], patch: Partial<Item>, tags: string[]): Promise<void> {
  const fields = [...Object.keys(patch), ...(tags.length ? ['tags'] : [])];
  if (!fields.length) return;
  await changeItems(ids, `Edited ${pieces(ids.length)}`, 'edited', (i) => (tags.length ? { ...patch, tags: [...new Set([...i.tags, ...tags])] } : patch), () => ({ fields }));
}

export async function moveItems(ids: Id[], spotId: Id | undefined): Promise<void> {
  await changeItems(ids, `Moved ${pieces(ids.length)}`, 'moved', () => ({ spotId }), (b) => ({ from: b.spotId ?? null, to: spotId ?? null }));
}

// ---------- wears ----------

/** A worn event's time for a day: now for today, else noon that day (so the story sorts it into the right day). */
function wornAt(day: string): number {
  return day === dayKey(Date.now()) ? stamp() : dayStart(day) + 12 * 3600_000;
}

/**
 * What was worn on a day: one wear per day, so this replaces the day's wear. Pieces newly on the day get a 'worn'
 * event (each piece's story); pieces taken off lose that day's. One step for Undo.
 */
async function setDay(day: string, itemIds: Id[], outfitId: Id | undefined, label: string): Promise<Id | null> {
  const ids = [...new Set(itemIds)];
  let before: Wear | undefined;
  let beforeEvents: ItemEvent[] = [];
  let wearId: Id | null = null;
  const added: Id[] = [];
  await db.transaction('rw', db.wears, db.events, async () => {
    before = await db.wears.where('day').equals(day).first();
    const old = new Set(before?.itemIds ?? []);
    const keep = new Set(ids);
    beforeEvents = await db.events.where('itemId').anyOf([...old]).filter((e) => e.type === 'worn' && dayKey(e.at) === day && !keep.has(e.itemId)).toArray();
    await db.events.bulkDelete(beforeEvents.map((e) => e.id));
    for (const id of ids) {
      if (old.has(id)) continue;
      const e = event(id, 'worn', wornAt(day), { day });
      added.push(e.id);
      await db.events.add(e);
    }
    if (!ids.length) {
      if (before) await db.wears.delete(before.id);
      return;
    }
    const w: Wear = { ...(before ?? {}), id: before?.id ?? newId(), day, itemIds: ids, updatedAt: stamp() };
    if (outfitId) w.outfitId = outfitId;
    else delete w.outfitId;
    wearId = w.id;
    await db.wears.put(w);
  });
  pushUndo(label, async () => {
    await db.transaction('rw', db.wears, db.events, async () => {
      await db.events.bulkDelete(added);
      await db.events.bulkPut(beforeEvents);
      const now = await db.wears.where('day').equals(day).first();
      if (now) await db.wears.delete(now.id);
      if (before) await db.wears.put(before);
    });
  });
  return wearId;
}

/** Logs what was worn on a day (replacing that day's wear). Returns the wear's id. */
export async function logWear(day: string, itemIds: Id[], outfitId?: Id): Promise<Id> {
  if (!itemIds.length) throw new Error('Nothing to log');
  return (await setDay(day, itemIds, outfitId, 'Logged what you wore'))!;
}

/** Clears a day's wear. */
export async function removeWear(day: string): Promise<void> {
  if (!(await db.wears.where('day').equals(day).count())) return;
  await setDay(day, [], undefined, 'Cleared a day');
}

/** Adds the piece to today's wear. False when it was already there. */
export async function wornToday(id: Id): Promise<boolean> {
  const day = dayKey(Date.now());
  const w = await db.wears.where('day').equals(day).first();
  if (w?.itemIds.includes(id)) return false;
  // An added piece makes it no longer exactly the outfit; outfitCount still finds the outfit by its pieces.
  await setDay(day, [...(w?.itemIds ?? []), id], undefined, 'Worn today');
  return true;
}

// ---------- outfits ----------

/** Saves an outfit. The same set of pieces again returns the outfit already saved. */
export async function saveOutfit(itemIds: Id[], name?: string, dressCodes: string[] = []): Promise<Id> {
  const ids = [...new Set(itemIds)];
  if (!ids.length) throw new Error('An outfit needs at least one piece');
  const same = (await db.outfits.toArray()).find((o) => samePieces(o.itemIds, ids));
  if (same) return same.id;
  const now = stamp();
  const o: Outfit = { id: newId(), itemIds: ids, dressCodes, createdAt: now, updatedAt: now };
  if (name?.trim()) o.name = name.trim();
  await db.outfits.add(o);
  pushUndo('Saved 1 outfit', async () => { await db.outfits.delete(o.id); });
  return o.id;
}

export async function updateOutfit(id: Id, patch: Partial<Omit<Outfit, 'id'>>): Promise<void> {
  const before = await db.outfits.get(id);
  if (!before) return;
  await db.outfits.put({ ...before, ...patch, updatedAt: stamp() });
  pushUndo('Changed 1 outfit', async () => { await db.outfits.put(before); });
}

/** Removes an outfit and its mirror photos. Its wear days stay. */
export async function removeOutfit(id: Id): Promise<void> {
  const before = await db.outfits.get(id);
  if (!before) return;
  const photos = await db.photos.where('itemId').equals(id).toArray();
  await db.transaction('rw', db.outfits, db.photos, async () => {
    await db.photos.bulkDelete(photos.map((p) => p.id));
    await db.outfits.delete(id);
  });
  pushUndo('Removed 1 outfit', async () => {
    await db.transaction('rw', db.outfits, db.photos, async () => {
      await db.outfits.put(before);
      await db.photos.bulkPut(photos);
    });
  });
}

/** Marks two pieces as going well together (or not), on both of them. */
export async function setPairs(a: Id, b: Id, on: boolean): Promise<void> {
  if (a === b) return;
  const before = (await db.items.bulkGet([a, b])).filter((i): i is Item => !!i);
  if (before.length < 2) return;
  const now = stamp();
  await db.transaction('rw', db.items, async () => {
    for (const [x, y] of [[a, b], [b, a]] as const) {
      const it = before.find((i) => i.id === x)!;
      const rest = (it.pairs ?? []).filter((p) => p !== y);
      await db.items.update(x, { pairs: on ? [...rest, y] : rest, updatedAt: now });
    }
  });
  pushUndo(on ? 'Marked as pairing well' : 'No longer pairing', async () => { await db.items.bulkPut(before); });
}

export async function copyItem(id: Id): Promise<Id> {
  const src = await db.items.get(id);
  if (!src) throw new Error('That piece is gone');
  const main = await db.photos.where('itemId').equals(id).filter((p) => p.role === 'main').first();
  const now = stamp();
  const { startWears: _sw, gone: _g, deletedAt: _d, ...rest } = src;
  void _sw; void _g; void _d;
  const copy = blankItem({ ...rest, id: newId(), name: `${src.name} copy`, status: 'owned', createdAt: now }, now);
  try {
    await db.transaction('rw', db.items, db.photos, db.events, async () => {
      await db.items.add(copy);
      if (main) await db.photos.add({ ...main, id: newId(), itemId: copy.id, updatedAt: now });
      await db.events.add(event(copy.id, 'added', now, { copyOf: id }));
    });
  } catch (e) {
    if (isQuota(e)) throw new Error(NO_SPACE);
    throw e;
  }
  pushUndo(`Copied ${src.name}`, () => hardDelete([copy.id]));
  return copy.id;
}

export async function letGo(id: Id, gone: Gone | undefined): Promise<void> {
  await changeItems([id], 'Let go of 1 piece', 'gone', () => ({ status: 'gone', gone }), () => ({ ...gone }));
}

export async function letGoMany(ids: Id[], gone: Gone): Promise<void> {
  await changeItems(ids, `Let go of ${pieces(ids.length)}`, 'gone', () => ({ status: 'gone', gone }), () => ({ ...gone }));
}

export async function bringBack(id: Id): Promise<void> {
  await changeItems([id], 'Brought back 1 piece', 'back', () => ({ status: 'owned', gone: undefined }));
}

export async function trash(ids: Id[]): Promise<void> {
  const now = Date.now();
  await changeItems(ids, `Deleted ${pieces(ids.length)}`, 'edited', () => ({ deletedAt: now }), () => ({ trashed: true }));
}

export async function restore(ids: Id[]): Promise<void> {
  await changeItems(ids, `Restored ${pieces(ids.length)}`, 'edited', () => ({ deletedAt: undefined }), () => ({ restored: true }));
}

async function hardDelete(ids: Id[]): Promise<void> {
  await db.transaction('rw', db.items, db.photos, db.events, async () => {
    await db.photos.where('itemId').anyOf(ids).delete();
    await db.events.where('itemId').anyOf(ids).delete();
    await db.items.bulkDelete(ids);
  });
}

/** Removes everything deleted more than 30 days before `now`. Returns how many pieces went. */
export async function sweepTrash(now: number): Promise<number> {
  const cutoff = now - TRASH_DAYS * DAY;
  const ids = (await db.items.where('deletedAt').below(cutoff).primaryKeys()) as Id[];
  if (ids.length) await hardDelete(ids);
  await db.transaction('rw', db.kinds, db.shades, db.places, db.searches, db.sizes, async () => {
    for (const t of [db.kinds, db.shades, db.places, db.searches, db.sizes] as const) {
      const old = (await t.filter((r) => r.deletedAt !== undefined && r.deletedAt < cutoff).primaryKeys()) as Id[];
      await t.bulkDelete(old);
    }
  });
  return ids.length;
}

/** Empties the trash now (the owner asked for it). */
export async function emptyTrash(): Promise<number> {
  const ids = (await db.items.filter((i) => i.deletedAt !== undefined).primaryKeys()) as Id[];
  if (ids.length) await hardDelete(ids);
  return ids.length;
}

// ---------- kinds, shades, places ----------

/** Removes a tree node that pieces may use: re-points them, soft-deletes the node, and is undoable. */
async function removeNode<T extends Kind | Shade | Place>(
  table: typeof db.kinds | typeof db.shades | typeof db.places,
  node: T,
  extraNodes: T[],
  reparent: { ids: Id[]; patch: Partial<T> },
  itemPatch: (item: Item) => Partial<Item> | null,
  type: EventType,
): Promise<void> {
  const tbl = table as unknown as import('dexie').Table<T, Id>;
  const beforeNodes: T[] = [node, ...extraNodes];
  const beforeKids = (await tbl.bulkGet(reparent.ids)).filter((x): x is T => !!x);
  const beforeItems: Item[] = [];
  const eventIds: Id[] = [];
  await db.transaction('rw', [table, db.items, db.events], async () => {
    const now = stamp();
    for (const n of beforeNodes) await tbl.update(n.id, { deletedAt: now, updatedAt: now } as never);
    for (const k of beforeKids) await tbl.update(k.id, { ...reparent.patch, updatedAt: now } as never);
    const all = await db.items.toArray();
    for (const item of all) {
      const patch = itemPatch(item);
      if (!patch) continue;
      beforeItems.push(item);
      await db.items.update(item.id, { ...patch, updatedAt: now });
      const e = event(item.id, type, now, { because: `removed ${node.name}` });
      eventIds.push(e.id);
      await db.events.add(e);
    }
  });
  pushUndo(`Removed ${node.name}`, async () => {
    await db.transaction('rw', [table, db.items, db.events], async () => {
      const now = stamp();
      await tbl.bulkPut([...beforeNodes, ...beforeKids].map((n) => ({ ...n, updatedAt: now })));
      await db.items.bulkPut(beforeItems.map((i) => ({ ...i, updatedAt: now })));
      await db.events.bulkDelete(eventIds);
    });
  });
}

export const OTHER_KIND = 'k-o-other';

/** Pieces of this kind move to its parent; its child kinds move up too. A top kind's pieces go to Other. */
export async function removeKind(id: Id): Promise<void> {
  const kind = await db.kinds.get(id);
  if (!kind) return;
  if (id === OTHER_KIND) throw new Error('"Other" holds everything without a kind and cannot be removed');
  const kinds = await db.kinds.toArray();
  const to = kind.parentId ?? OTHER_KIND;
  const children = kinds.filter((k) => k.parentId === id && !k.deletedAt).map((k) => k.id);
  await removeNode(db.kinds, kind, [], { ids: children, patch: { parentId: kind.parentId } }, (i) => (i.kindId === id ? { kindId: to } : null), 'edited');
}

/** Pieces in this shade move to its family. Families cannot be removed. */
export async function removeShade(id: Id): Promise<void> {
  const shade = await db.shades.get(id);
  if (!shade) return;
  if (!shade.familyId) throw new Error('A colour family cannot be removed; rename it instead');
  const fam = shade.familyId;
  await removeNode(db.shades, shade, [], { ids: [], patch: {} }, (i) => {
    if (i.shadeMain !== id && i.shadeSecond !== id) return null;
    const p: Partial<Item> = {};
    if (i.shadeMain === id) p.shadeMain = fam;
    if (i.shadeSecond === id) p.shadeSecond = fam;
    return p;
  }, 'edited');
}

/** Pieces in this spot (or any spot of this home) go to "No spot". "With me" is fixed. */
export async function removePlace(id: Id): Promise<void> {
  const place = await db.places.get(id);
  if (!place) return;
  if (place.role === 'withme' || id === WITH_ME_ID) throw new Error('"With me" is always there');
  const spots = place.role === 'home' ? await db.places.where('homeId').equals(id).filter((p) => !p.deletedAt).toArray() : [];
  const gone = new Set([id, ...spots.map((s) => s.id)]);
  await removeNode(db.places, place, spots, { ids: [], patch: {} }, (i) => {
    const inSpot = i.spotId !== undefined && gone.has(i.spotId);
    const usual = i.usualSpotIds.filter((s) => !gone.has(s));
    if (!inSpot && usual.length === i.usualSpotIds.length) return null;
    return { ...(inSpot ? { spotId: undefined } : {}), usualSpotIds: usual };
  }, 'moved');
}

async function nextOrder(table: typeof db.kinds | typeof db.shades | typeof db.places): Promise<number> {
  const all = await (table as unknown as import('dexie').Table<{ order: number }, Id>).toArray();
  return all.reduce((m, r) => Math.max(m, r.order), -1) + 1;
}

export async function addPlace(name: string, homeId: Id | null): Promise<Id> {
  const id = newId();
  await db.places.add({ id, homeId, name: name.trim(), role: homeId ? 'spot' : 'home', order: await nextOrder(db.places), updatedAt: stamp() });
  return id;
}

export async function addKind(name: string, parentId: Id | null, clothing: boolean): Promise<Id> {
  const id = newId();
  await db.kinds.add({ id, parentId, name: name.trim(), clothing, fields: [], order: await nextOrder(db.kinds), updatedAt: stamp() });
  return id;
}

export async function addShade(name: string, familyId: Id, hex: string): Promise<Id> {
  const id = newId();
  const order = (await db.shades.where('familyId').equals(familyId).count());
  await db.shades.add({ id, familyId, name: name.trim(), hex: hex.toUpperCase(), order, updatedAt: stamp() });
  return id;
}

export async function rename(table: 'kinds' | 'shades' | 'places', id: Id, name: string): Promise<void> {
  const t = db[table] as unknown as import('dexie').Table<{ name: string; updatedAt: number }, Id>;
  const before = await t.get(id);
  if (!before) return;
  await t.update(id, { name: name.trim(), updatedAt: stamp() });
  pushUndo(`Renamed ${before.name}`, async () => {
    await t.update(id, { name: before.name, updatedAt: stamp() });
  });
}

export async function setKindHidden(id: Id, hide: boolean): Promise<void> {
  await db.kinds.update(id, { hideFromWindow: hide, updatedAt: stamp() });
}

/** Where a kind stands in outfits. Each lane brings its usual size; tops sit as an over layer. */
const LANE_SCALE: Record<Lane, number> = { head: 0.45, neck: 0.6, top: 1, waist: 0.7, bottom: 0.8, feet: 0.45, wrist: 0.16, hand: 0.08, carry: 0.6 };
export async function setKindLane(id: Id, lane: Lane | undefined): Promise<void> {
  const k = await db.kinds.get(id);
  if (!k) return;
  const next: Kind = { ...k, updatedAt: stamp() };
  delete next.lane; delete next.layer; delete next.baseScale;
  if (lane) Object.assign(next, { lane, baseScale: LANE_SCALE[lane] }, lane === 'top' ? { layer: 'over' } : {});
  await db.kinds.put(next);
}

// ---------- wishes ----------

export type WishDraft = Partial<Omit<Wish, 'id' | 'status' | 'createdAt' | 'updatedAt'>> & Pick<Wish, 'name' | 'tier'>;

/** Adds a wish, with its picture when there is one. */
export async function addWish(draft: WishDraft, photo?: { blob: Blob; w: number; h: number }): Promise<Id> {
  const now = stamp();
  const w: Wish = { currency: 'INR', source: 'hand', ...draft, id: newId(), status: 'open', createdAt: now, updatedAt: now };
  try {
    await db.transaction('rw', db.wishes, db.photos, async () => {
      await db.wishes.add(w);
      if (photo) await db.photos.add({ id: newId(), itemId: w.id, role: 'wish', updatedAt: now, ...photo });
    });
  } catch (e) {
    if (isQuota(e)) throw new Error(NO_SPACE);
    throw e;
  }
  pushUndo('Added 1 wish', async () => {
    await db.transaction('rw', db.wishes, db.photos, async () => {
      await db.photos.where('itemId').equals(w.id).delete();
      await db.wishes.delete(w.id);
    });
  });
  return w.id;
}

async function changeWish(id: Id, patch: Partial<Wish>, label: string): Promise<void> {
  const before = await db.wishes.get(id);
  if (!before) return;
  await db.wishes.put({ ...before, ...patch, id, updatedAt: stamp() });
  pushUndo(label, async () => { await db.wishes.put({ ...before, updatedAt: stamp() }); });
}

export function updateWish(id: Id, patch: Partial<Omit<Wish, 'id'>>): Promise<void> {
  return changeWish(id, patch, 'Changed 1 wish');
}

/** "Not any more": the wish stays in the record as dropped. */
export function dropWish(id: Id): Promise<void> {
  return changeWish(id, { status: 'dropped' }, 'Dropped 1 wish');
}

/** "Glad you bought it?": 1 (not at all) to 7 (very), or a skip. */
export function answerGlad(id: Id, score: number | 'skip'): Promise<void> {
  if (score !== 'skip' && !(Number.isInteger(score) && score >= 1 && score <= 7)) return Promise.reject(new Error('A score from 1 to 7'));
  return changeWish(id, score === 'skip' ? { gladSkipped: true } : { glad: score, gladSkipped: undefined }, 'Answered');
}

/**
 * Bought: a new piece that needs details, carrying what the wish knew (name, kind, shade, price, shop) and its
 * picture as an extra photo. The wish is kept as bought, pointing at the piece. One step for Undo.
 */
export async function buyWish(id: Id, opts: { boughtOn: string; price?: Rough<number> }): Promise<Id> {
  const wish = await db.wishes.get(id);
  if (!wish) throw new Error('No such wish');
  const now = stamp();
  const draft: Partial<Item> = {
    name: wish.name,
    kindId: wish.kindId ?? UNSORTED.clothing,
    currency: wish.currency,
    needsDetails: true,
    boughtOn: { value: opts.boughtOn, estimate: false },
  };
  if (wish.shadeId) draft.shadeMain = wish.shadeId;
  if (wish.shop) draft.shop = wish.shop;
  const price = opts.price ?? wish.price;
  if (price) draft.price = price;
  const item = blankItem(draft, now);
  const wishPhotos = (await db.photos.where('itemId').equals(id).toArray()).filter((p) => p.role === 'wish');
  try {
    await db.transaction('rw', [db.items, db.photos, db.events, db.wishes], async () => {
      await db.items.add(item);
      await db.photos.bulkAdd(wishPhotos.map((p) => ({ id: newId(), itemId: item.id, role: 'extra' as const, blob: p.blob, w: p.w, h: p.h, updatedAt: now })));
      await db.events.add(event(item.id, 'added', now));
      await db.wishes.put({ ...wish, status: 'bought', itemId: item.id, boughtOn: opts.boughtOn, updatedAt: now });
    });
  } catch (e) {
    if (isQuota(e)) throw new Error(NO_SPACE);
    throw e;
  }
  pushUndo('Bought 1 wish', async () => {
    await hardDelete([item.id]);
    await db.wishes.put({ ...wish, updatedAt: stamp() });
  });
  return item.id;
}

// ---------- settings ----------

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
