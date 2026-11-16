// The head-to-toe outfit stage: where each piece stands and how big, at true proportions.
import type { Id, Item, Kind, Lane, Layer, Outfit, Wear } from './types';
import { outfitCount, pairKey } from './wearlog';

/** One piece on the stage. x is its centre and y its top, w its width and h its height, all fractions of the box. */
export interface Placed {
  itemId: Id;
  lane: Lane;
  layer: Layer;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  gone: boolean;
}

/** The stage's shape, width ÷ height (the board's regular windows are 128 × 240). */
export const STAGE_ASPECT = 0.53;
/** A tee (base scale 1) fills this much of the stage's width. */
const TEE_WIDTH = 0.7;
/** Where each lane's pieces start, down the box. */
const TOP_OF: Record<Lane, number> = { head: 0.0, neck: 0.05, top: 0.08, wrist: 0.38, waist: 0.46, hand: 0.48, bottom: 0.44, carry: 0.5, feet: 0.86 };
/** Where the body lanes end, down the box: a top reaches just past the waist, trousers stop above the shoes. */
const END_OF: Partial<Record<Lane, number>> = { top: 0.5, bottom: 0.88, feet: 1 };
/** Drawn on top of each other in this order (tops by layer: under 1, over 2, outer 3). */
const Z_OF: Record<Lane, number> = { bottom: 0, feet: 0, head: 1, top: 1, neck: 4, waist: 5, wrist: 6, hand: 6, carry: 6 };
const LAYER_Z: Record<Layer, number> = { under: 1, over: 2, outer: 3 };
/** Under layers sit a little higher so their neckline shows. */
const LAYER_DY: Record<Layer, number> = { under: -0.02, over: 0, outer: 0.01 };
/** Lanes that hold two pieces (two wrists, two hands). */
const PAIRED: Lane[] = ['wrist', 'hand'];

/** A lane's default width (× a tee's), for a lane chosen by hand. */
export const LANE_SCALE: Record<Lane, number> = { head: 0.45, neck: 0.6, top: 1, waist: 0.7, bottom: 0.8, feet: 0.45, wrist: 0.16, hand: 0.08, carry: 0.6 };

/** The lanes in plain words, head to toe. */
export const LANE_WORDS: [Lane, string][] = [['head', 'Head'], ['neck', 'Neck'], ['top', 'Top'], ['waist', 'Waist'], ['bottom', 'Bottom'], ['feet', 'Feet'], ['wrist', 'Wrist'], ['hand', 'Hand'], ['carry', 'Carried']];

type LaneSpot = { lane: Lane; layer: Layer; baseScale: number };

/** A kind's own lane, else its parent's; null when neither has one. */
function kindLane(kindId: Id, kinds: Kind[]): LaneSpot | null {
  const k = kinds.find((x) => x.id === kindId);
  const p = k?.parentId ? kinds.find((x) => x.id === k.parentId) : undefined;
  const src = k?.lane ? k : p?.lane ? p : null;
  return src ? { lane: src.lane!, layer: src.layer ?? 'over', baseScale: src.baseScale ?? 1 } : null;
}

/** A kind's lane; a kind with none stands at the side until its piece is told where it is worn. */
export function laneOf(kindId: Id, kinds: Kind[]): LaneSpot {
  return kindLane(kindId, kinds) ?? { lane: 'carry', layer: 'over', baseScale: 0.6 };
}

/** A piece's lane: where the owner said it is worn, else its kind's. */
export function laneFor(item: Item, kinds: Kind[]): LaneSpot {
  if (item.outfitLane) return { lane: item.outfitLane, layer: 'over', baseScale: LANE_SCALE[item.outfitLane] };
  return laneOf(item.kindId, kinds);
}

/** True when neither the piece nor its kind says where it is worn: ask "Where is this worn?" once. */
export function needsLane(item: Item, kinds: Kind[]): boolean {
  return !item.outfitLane && !kindLane(item.kindId, kinds);
}

const isGone = (i: Item) => i.status === 'gone' || i.deletedAt !== undefined;

/** Where each piece stands. `aspect` is each photo's height ÷ width (1.2 when unknown). */
export function layout(items: Item[], kinds: Kind[], aspect: Map<Id, number>): Placed[] {
  const seen = new Map<Lane, number>();
  return items.map((it) => {
    const { lane, layer, baseScale } = laneFor(it, kinds);
    const nth = seen.get(lane) ?? 0;
    seen.set(lane, nth + 1);
    const y = TOP_OF[lane] + (lane === 'top' ? LAYER_DY[layer] : 0);
    const ratio = STAGE_ASPECT * (aspect.get(it.id) ?? 1.2);
    // A piece taller than its band shrinks to fit it, keeping its shape; the owner's size correction applies after.
    const end = END_OF[lane];
    const fit = end === undefined ? TEE_WIDTH * baseScale : Math.min(TEE_WIDTH * baseScale, (end - Math.max(0, y)) / ratio);
    const w = Math.min(1, fit * (it.outfitScale ?? 1));
    const h = w * ratio;
    let x = 0.5;
    if (lane === 'wrist' || lane === 'hand') x = nth % 2 === 0 ? w / 2 + 0.03 : 1 - w / 2 - 0.03;
    else if (lane === 'carry') x = 1 - w / 2 - 0.02;
    const z = lane === 'top' ? LAYER_Z[layer] : Z_OF[lane];
    return { itemId: it.id, lane, layer, x, y: Math.max(0, y), w, h, z, gone: isGone(it) };
  });
}

/**
 * Adds a piece to an outfit being built. It replaces the piece in the same lane and layer (wrists and hands hold two;
 * a third replaces the oldest). A piece already in is taken out.
 */
export function placeIn(current: Id[], add: Item, items: Item[], kinds: Kind[]): Id[] {
  if (current.includes(add.id)) return current.filter((id) => id !== add.id);
  const byId = new Map(items.map((i) => [i.id, i]));
  const a = laneFor(add, kinds);
  const same = current.filter((id) => {
    const it = byId.get(id);
    if (!it) return false;
    const b = laneFor(it, kinds);
    return b.lane === a.lane && b.layer === a.layer;
  });
  const room = PAIRED.includes(a.lane) ? 2 : 1;
  const drop = new Set(same.slice(0, Math.max(0, same.length - room + 1)));
  return [...current.filter((id) => !drop.has(id)), add.id];
}

/** How well a piece goes with the chosen ones: marked "pairs well" counts most, then days worn together. */
export function pairScore(c: Item, chosen: Id[], together: Map<string, number>): number {
  let s = 0;
  for (const id of chosen) {
    if (id === c.id) continue;
    if (c.pairs?.includes(id)) s += 1000;
    s += together.get(pairKey(c.id, id)) ?? 0;
  }
  return s;
}

/** Candidates that go with the chosen pieces first; otherwise in their given order. */
export function pairedFirst(candidates: Item[], chosen: Id[], together: Map<string, number>): Item[] {
  return candidates
    .map((c, i) => ({ c, i, s: pairScore(c, chosen, together) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

/** The piece whose colour lights the stage: the outermost top still owned, else any piece still owned. */
export function lightPiece(placed: Placed[]): Id | undefined {
  const live = placed.filter((p) => !p.gone);
  const tops = live.filter((p) => p.lane === 'top').sort((a, b) => b.z - a.z);
  return (tops[0] ?? live[0])?.itemId;
}

export const DRESS_CODES = ['Formal', 'Smart casual', 'Casual', 'Ethnic', 'Gym', 'Lounge'];

/** Saved outfits, most worn first, then newest. */
export function regulars(outfits: Outfit[], wears: Wear[]): Outfit[] {
  return outfits
    .map((o) => ({ o, n: outfitCount(o, wears) }))
    .sort((a, b) => b.n - a.n || b.o.createdAt - a.o.createdAt)
    .map((x) => x.o);
}

/** "Your regulars" are outfits worn at least once, most worn first; the rest are "saved, not worn yet", newest first. */
export function splitRegulars(outfits: Outfit[], wears: Wear[]): { worn: Outfit[]; saved: Outfit[] } {
  const all = regulars(outfits, wears);
  return { worn: all.filter((o) => outfitCount(o, wears) > 0), saved: all.filter((o) => outfitCount(o, wears) === 0) };
}

/** The same set of pieces, in any order. */
export function samePieces(a: Id[], b: Id[]): boolean {
  const s = new Set(a);
  return s.size === new Set(b).size && b.every((id) => s.has(id));
}
