// Tap to fix: the owner taps the piece and the model (SlimSAM, in its own worker) finds it.
// The model is fetched only when the fix screen is first opened, and is cached for offline use after that.
import { db } from '../db/db';
import { replaceCutout } from '../db/actions';
import { guessShades } from '../domain/colour';
import type { Id } from '../domain/types';
import { compose, encode } from './cutout';
import { refusalText, trustMask } from './mask';
import { createModelWorker } from './modelWorker';
import type { TapPoint } from './points';

const sam = createModelWorker({
  make: () => new Worker(new URL('./sam.worker.ts', import.meta.url), { type: 'module' }),
  name: 'fix tool',
  // A phone on WASM may take a while to prepare a photo; three minutes means the worker is stuck.
  timeout: 180_000,
  cacheMatch: (url) => url.includes('slimsam') && url.includes('.onnx'),
});
/** Which photo the worker holds an embedding for. */
let prepared: string | null = null;

/** Tests only. */
export function _setFixWorkerFactory(f: () => Worker): void {
  prepared = null;
  sam._setFactory(f);
}

export const fixModelState = () => sam.state();
export const fixModelCached = () => sam.cached();
export const loadFixModel = (onProgress?: (fraction: number) => void) => sam.load(onProgress);

/** Encodes the photo once ("Getting the photo ready…"); the same photo again is instant. Returns the time taken. */
export async function prepareFix(key: string, rgba: Uint8ClampedArray, w: number, h: number): Promise<number> {
  if (prepared === key && sam.state() === 'ready') return 0;
  prepared = null;
  const copy = new Uint8ClampedArray(rgba);
  const r = await sam.request<{ type: string; ms: number }>({ type: 'embed', rgba: copy, w, h }, [copy.buffer]);
  prepared = key;
  return r.ms;
}

/** The mask for the taps so far, at the photo's size (0 or 255). */
export async function tapFix(points: TapPoint[]): Promise<{ alpha: Uint8Array; ms: number }> {
  const r = await sam.request<{ type: string; alpha: Uint8Array; ms: number }>({ type: 'decode', points });
  return { alpha: r.alpha, ms: r.ms };
}

/** Leaving the fix screen: frees the model's memory (it loads again from the cache next time). */
export function closeFix(): void {
  prepared = null;
  sam.close();
}

export interface FixDeps {
  compose?: (pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number) => Promise<{ pixels: Uint8ClampedArray; w: number; h: number }>;
  encode?: (pixels: Uint8ClampedArray, w: number, h: number) => Promise<Blob>;
}

/**
 * Saves the owner's mask as the piece's cut-out: cleaned, straightened and cropped like any cut-out, but without the
 * busy-background refusals, because the owner chose it. Empty or whole-photo masks are refused with a plain message.
 */
export async function saveFix(
  itemId: Id,
  f: { pixels: Uint8ClampedArray; alpha: Uint8Array; w: number; h: number; points: TapPoint[] },
  deps: FixDeps = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const d = { compose, encode, ...deps };
  const keepAt = f.points
    .filter((p) => p.label === 1)
    .map((p) => Math.min(f.h - 1, Math.floor(p.y * f.h)) * f.w + Math.min(f.w - 1, Math.floor(p.x * f.w)));
  const r = trustMask(f.alpha, f.w, f.h, keepAt);
  if ('refused' in r) return { ok: false, message: refusalText(r.refused) };
  const cut = await d.compose(f.pixels, r.mask, f.w, f.h);
  const blob = await d.encode(cut.pixels, cut.w, cut.h);
  let shades: { shadeMain?: Id; shadeSecond?: Id } = {};
  try {
    const g = guessShades(cut.pixels, (await db.shades.toArray()).filter((s) => !s.deletedAt));
    shades = { shadeMain: g.main.id, shadeSecond: g.second?.id };
  } catch {
    /* no visible colour: the old shades stay */
  }
  await replaceCutout(itemId, { blob, w: cut.w, h: cut.h }, shades);
  return { ok: true };
}
