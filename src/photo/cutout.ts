import { cleanMask } from './mask';
import { createModelWorker, ModelUnavailable } from './modelWorker';
import { LONG_EDGE, fitWithin, toWebp } from './encode';
import { maskBounds, tiltDegrees } from './polish';

export interface CutResult {
  original: Blob;
  /** null means keep the uncut photo: the model found nothing, took the whole frame, or failed. */
  cutout: Blob | null;
  w: number;
  h: number;
  /** The cut-out's pixels, for guessing its shades. */
  pixels: Uint8ClampedArray | null;
  cutW?: number;
  cutH?: number;
  ms?: number;
}

export interface CutDeps {
  readPixels?: (bitmap: ImageBitmap, w: number, h: number) => Promise<Uint8ClampedArray>;
  encode?: (pixels: Uint8ClampedArray, w: number, h: number) => Promise<Blob>;
  runModel?: (pixels: Uint8ClampedArray, w: number, h: number) => Promise<Uint8Array>;
  compose?: (pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number) => Promise<{ pixels: Uint8ClampedArray; w: number; h: number }>;
}

// ---------- canvas helpers (browser only) ----------

function canvas(w: number, h: number): OffscreenCanvas {
  return new OffscreenCanvas(w, h);
}

export async function readPixels(bitmap: ImageBitmap, w: number, h: number): Promise<Uint8ClampedArray> {
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

function put(pixels: Uint8ClampedArray, w: number, h: number): OffscreenCanvas {
  const c = canvas(w, h);
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(pixels), w, h), 0, 0);
  return c;
}

export async function encode(pixels: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  return toWebp(put(pixels, w, h));
}

/** Applies the mask, turns the piece square, crops to it with a little room, and shrinks to 1000 px. */
export async function compose(pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number) {
  const px = new Uint8ClampedArray(pixels);
  for (let i = 0; i < w * h; i++) px[i * 4 + 3] = mask[i];
  let src = put(px, w, h);
  const tilt = tiltDegrees(mask, w, h);
  if (tilt) {
    const r = (-tilt * Math.PI) / 180;
    const W = Math.ceil(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r)));
    const H = Math.ceil(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
    const turned = canvas(W, H);
    const ctx = turned.getContext('2d')!;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(r);
    ctx.drawImage(src, -w / 2, -h / 2);
    src = turned;
  }
  const sw = src.width, sh = src.height;
  const all = src.getContext('2d')!.getImageData(0, 0, sw, sh).data;
  const alpha = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) alpha[i] = all[i * 4 + 3];
  const pad = Math.round(Math.max(sw, sh) * 0.03);
  const b = maskBounds(alpha, sw, sh, pad) ?? { x: 0, y: 0, w: sw, h: sh };
  const size = fitWithin(b.w, b.h, LONG_EDGE.cutout);
  const out = canvas(size.w, size.h);
  const octx = out.getContext('2d')!;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, size.w, size.h);
  return { pixels: octx.getImageData(0, 0, size.w, size.h).data, w: size.w, h: size.h };
}

// ---------- the model, in a worker ----------

export { ModelUnavailable } from './modelWorker';

/** A phone on WASM takes seconds per photo; two minutes means the worker is stuck. */
const rmbg = createModelWorker({
  make: () => new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' }),
  name: 'cut-out tool',
  timeout: 120_000,
  cacheMatch: (url) => url.includes('RMBG-1.4') && url.includes('.onnx'),
});
let lastMs = 0;

/** Tests only. */
export const _setWorkerFactory = (f: () => Worker): void => rmbg._setFactory(f);
export const _setJobTimeout = (ms: number): void => rmbg._setTimeout(ms);

/** Called once the model is loaded and ready (so pieces left waiting can be tried again). */
export const onModelReady = (cb: () => void): (() => void) => rmbg.onReady(cb);
export const modelState = () => rmbg.state();
export const modelDevice = () => rmbg.device();
/** Whether the model has been downloaded before (so loading needs no internet). */
export const modelCached = () => rmbg.cached();
export const loadModel = (onProgress?: (fraction: number) => void) => rmbg.load(onProgress);

/** One mask from the worker. Any failure to load, a crash, or a stuck job is ModelUnavailable. */
export async function runModel(pixels: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array> {
  const copy = new Uint8ClampedArray(pixels);
  const r = await rmbg.request<{ type: string; alpha: Uint8Array; ms?: number }>({ type: 'run', rgba: copy, w, h }, [copy.buffer]);
  lastMs = r.ms ?? 0;
  return r.alpha;
}

// ---------- the cut-out ----------

/** Shrinks the photo, cuts the piece out, and cleans and straightens it. Never loses the photo. */
export async function cutOut(bitmap: ImageBitmap, deps: CutDeps = {}): Promise<CutResult> {
  const d = { readPixels, encode, runModel, compose, ...deps };
  const { w, h } = fitWithin(bitmap.width, bitmap.height, LONG_EDGE.original);
  const pixels = await d.readPixels(bitmap, w, h);
  const original = await d.encode(pixels, w, h);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let alpha: Uint8Array;
  try {
    alpha = await d.runModel(pixels, w, h);
  } catch (e) {
    if (e instanceof ModelUnavailable) throw e; // the photo is fine; it waits for the tool
    return { original, cutout: null, w, h, pixels: null };
  }
  const mask = cleanMask(alpha, w, h);
  if (!mask) return { original, cutout: null, w, h, pixels: null };
  const cut = await d.compose(pixels, mask, w, h);
  const cutout = await d.encode(cut.pixels, cut.w, cut.h);
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { original, cutout, w, h, pixels: cut.pixels, cutW: cut.w, cutH: cut.h, ms: lastMs || ms };
}

// ---------- the queue ----------

export interface Queue<J, R> {
  add(job: J, id?: string): string;
  onDone(cb: (id: string, res: { value?: R; error?: unknown }) => void): () => void;
  pending(): number;
  has(id: string): boolean;
  /** Resolves once every job added so far has run and its listeners were told. */
  idle(): Promise<void>;
}

/** Runs jobs one at a time in the order added. `add` returns at once, so shooting never waits. */
export function createQueue<J, R>(run: (job: J) => Promise<R>): Queue<J, R> {
  const jobs: { id: string; job: J }[] = [];
  const listeners = new Set<(id: string, res: { value?: R; error?: unknown }) => void>();
  let busy = false;
  let n = 0;
  const idleWaiters: (() => void)[] = [];
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (jobs.length) {
      const { id, job } = jobs[0];
      let res: { value?: R; error?: unknown };
      try {
        res = { value: await run(job) };
      } catch (error) {
        res = { error };
      }
      jobs.shift();
      listeners.forEach((l) => l(id, res));
    }
    busy = false;
    idleWaiters.splice(0).forEach((r) => r());
  };
  return {
    add(job, id) {
      const jid = id ?? `job-${++n}`;
      jobs.push({ id: jid, job });
      void Promise.resolve().then(pump);
      return jid;
    },
    onDone(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    pending: () => jobs.length,
    has: (id) => jobs.some((j) => j.id === id),
    idle: () => (!busy && !jobs.length ? Promise.resolve() : new Promise<void>((r) => idleWaiters.push(r))),
  };
}


/** Shrinks a photo to a long edge and saves it as WebP (extra photos, receipts). */
export async function shrinkToWebp(bitmap: ImageBitmap, longEdge: number = LONG_EDGE.original): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = fitWithin(bitmap.width, bitmap.height, longEdge);
  const c = canvas(w, h);
  c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return { blob: await toWebp(c), w, h };
}
