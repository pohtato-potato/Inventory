import Dexie, { type EntityTable } from 'dexie';
import type { Item, ItemEvent, Kind, Photo, Place, SavedSearch, Setting, Shade, SizeRow } from '../domain/types';

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
  }
}

export const db = new InventoryDb();

export const TABLES = ['items', 'kinds', 'shades', 'places', 'photos', 'events', 'sizes', 'searches', 'settings'] as const;
export type TableName = (typeof TABLES)[number];

export function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
