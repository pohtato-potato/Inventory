import Dexie, { type EntityTable } from 'dexie';
import { wearsFromEvents, withStarterLane } from './migrate';
import type { Item, ItemEvent, Kind, Outfit, Photo, Place, SavedSearch, Setting, Shade, SizeRow, Wear, Wish } from '../domain/types';

export class InventoryDb extends Dexie {
  items!: EntityTable<Item, 'id'>;
  kinds!: EntityTable<Kind, 'id'>;
  shades!: EntityTable<Shade, 'id'>;
  places!: EntityTable<Place, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  events!: EntityTable<ItemEvent, 'id'>;
  sizes!: EntityTable<SizeRow, 'id'>;
  searches!: EntityTable<SavedSearch, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  wears!: EntityTable<Wear, 'id'>;
  outfits!: EntityTable<Outfit, 'id'>;
  wishes!: EntityTable<Wish, 'id'>;

  constructor() {
    super('inventory');
    this.version(1).stores({
      items: 'id, name, kindId, status, spotId, shadeMain, deletedAt, *tags',
      kinds: 'id, parentId',
      shades: 'id, familyId',
      places: 'id, homeId, role',
      photos: 'id, itemId, role',
      events: 'id, itemId, at',
      sizes: 'id, type',
      searches: 'id',
      settings: 'key',
    });
    // Build 2: what was worn moves from 'worn' events into one wear per day; starter kinds get their outfit lanes.
    // Nothing is deleted: the events stay for each piece's story.
    this.version(2)
      .stores({ wears: 'id, day, outfitId, *itemIds', outfits: 'id', wishes: 'id, tier, status' })
      .upgrade(async (tx) => {
        const worn = await tx.table('events').filter((e: ItemEvent) => e.type === 'worn').toArray();
        await tx.table('wears').bulkAdd(wearsFromEvents(worn));
        await tx.table('kinds').toCollection().modify((k: Kind) => { Object.assign(k, withStarterLane(k)); });
      });
  }
}

export const db = new InventoryDb();

export const TABLES = ['items', 'kinds', 'shades', 'places', 'photos', 'events', 'sizes', 'searches', 'settings', 'wears', 'outfits', 'wishes'] as const;
export type TableName = (typeof TABLES)[number];

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
