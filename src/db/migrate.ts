// Moving older data forward: the version 1 → 2 database upgrade and version 1 backups both use these.
import { dayKey } from '../domain/wearlog';
import type { ItemEvent, Kind, Lane, Layer, Wear } from '../domain/types';
import { newId } from './db';

/** Where each starter kind sits on the outfit stage, by its starter name. Kinds the owner adds get none until chosen. */
export const STARTER_LANES: Record<string, { lane: Lane; layer?: Layer; baseScale: number }> = {
  Tees: { lane: 'top', layer: 'under', baseScale: 1 },
  Innerwear: { lane: 'top', layer: 'under', baseScale: 1 },
  Shirts: { lane: 'top', layer: 'over', baseScale: 1 },
  Knitwear: { lane: 'top', layer: 'over', baseScale: 1 },
  Jackets: { lane: 'top', layer: 'outer', baseScale: 1.1 },
  Jeans: { lane: 'bottom', baseScale: 0.8 },
  Trousers: { lane: 'bottom', baseScale: 0.8 },
  Shorts: { lane: 'bottom', baseScale: 0.8 },
  Shoes: { lane: 'feet', baseScale: 0.45 },
  Socks: { lane: 'feet', layer: 'under', baseScale: 0.45 },
  Watches: { lane: 'wrist', baseScale: 0.16 },
  Bracelets: { lane: 'wrist', baseScale: 0.16 },
  Rings: { lane: 'hand', baseScale: 0.08 },
  Belts: { lane: 'waist', baseScale: 0.7 },
  Caps: { lane: 'head', baseScale: 0.45 },
  Bags: { lane: 'carry', baseScale: 0.6 },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** Starter kind ids are `k-<slug of the starter name>`; a renamed starter kind keeps its id, so it keeps its lane. */
const BY_ID = new Map(Object.entries(STARTER_LANES).map(([name, v]) => [`k-${slug(name)}`, v]));

/** The kind with its starter lane, if it is a starter kind and has no lane yet. */
export function withStarterLane(k: Kind): Kind {
  const v = BY_ID.get(k.id);
  if (!v || k.lane) return k;
  const out: Kind = { ...k, lane: v.lane, baseScale: v.baseScale };
  if (v.layer) out.layer = v.layer;
  return out;
}

/** One wear per local day from the old 'worn' events, pieces merged and de-duplicated, oldest day first. */
export function wearsFromEvents(events: ItemEvent[]): Wear[] {
  const days = new Map<string, { ids: Set<string>; at: number }>();
  for (const e of events) {
    if (e.type !== 'worn') continue;
    const day = dayKey(e.at);
    const d = days.get(day) ?? { ids: new Set<string>(), at: 0 };
    d.ids.add(e.itemId);
    d.at = Math.max(d.at, e.at);
    days.set(day, d);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, d]) => ({ id: newId(), day, itemIds: [...d.ids], updatedAt: d.at }));
}
