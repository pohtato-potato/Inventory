import { cleanMask } from './mask';
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

async function readPixels(bitmap: ImageBitmap, w: number, h: number): Promise<Uint8ClampedArray> {
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

async function encode(pixels: Uint8ClampedArray, w: number, h: number): Promise<Blob> {
  return toWebp(put(pixels, w, h));
}

/** Applies the mask, turns the piece square, crops to it with a little room, and shrinks to 1000 px. */
async function compose(pixels: Uint8ClampedArray, mask: Uint8Array, w: number, h: number) {
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

type State = 'missing' | 'loading' | 'ready';

/** The cut-out tool could not run at all (no download yet, worker crashed, a job stuck): the photo is fine, try again later. */
export class ModelUnavailable extends Error {
  constructor(why = 'The cut-out tool is not available yet') {
    super(why);
    this.name = 'ModelUnavailable';
  }
}

let state: State = 'missing';
let worker: Worker | null = null;
let device = '';
let nextId = 1;
const waiting = new Map<number, { resolve: (a: Uint8Array) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let loadPromise: Promise<void> | null = null;
let rejectLoad: ((e: Error) => void) | null = null;
const progressListeners = new Set<(f: number) => void>();
const readyListeners = new Set<() => void>();
let lastMs = 0;
let makeWorker = (): Worker => new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' });
/** A phone on WASM takes seconds per photo; two minutes means the worker is stuck. */
let jobTimeout = 120_000;

/** Tests only. */
export function _setWorkerFactory(f: () => Worker): void {
  resetWorker(new ModelUnavailable());
  makeWorker = f;
}
export function _setJobTimeout(ms: number): void {
  jobTimeout = ms;
}

/** Called once the model is loaded and ready (so pieces left waiting can be tried again). */
export function onModelReady(cb: () => void): () => void {
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/** The worker died or hung: fail everything it held as "unavailable" and start afresh next time. */
function resetWorker(why: Error) {
  const w = worker;
  worker = null;
  state = 'missing';
  loadPromise = null;
  const rl = rejectLoad;
  rejectLoad = null;
  rl?.(why);
  for (const [id, job] of waiting) {
    clearTimeout(job.timer);
    job.reject(why);
    waiting.delete(id);
  }
  try {
    w?.terminate();
  } catch {
    /* already gone */
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = makeWorker();
  worker = w;
  w.onerror = () => { if (worker === w) resetWorker(new ModelUnavailable('The cut-out tool stopped')); };
  w.onmessageerror = () => { if (worker === w) resetWorker(new ModelUnavailable('The cut-out tool stopped')); };
  w.onmessage = (ev: MessageEvent) => {
    const m = ev.data as { type: string; id?: number; alpha?: Uint8Array; fraction?: number; message?: string; ms?: number; device?: string };
    if (m.type === 'progress') progressListeners.forEach((l) => l(m.fraction ?? 0));
    else if (m.type === 'mask' && m.id) {
      lastMs = m.ms ?? 0;
      const job = waiting.get(m.id);
      if (job) {
        clearTimeout(job.timer);
        job.resolve(m.alpha!);
        waiting.delete(m.id);
      }
    } else if (m.type === 'error') {
      const job = m.id !== undefined ? waiting.get(m.id) : undefined;
      if (job) {
        clearTimeout(job.timer);
        job.reject(new Error(m.message));
        waiting.delete(m.id!);
      }
    }
    if (m.device) device = m.device;
  };
  return w;
}

export function modelState(): State {
  return state;
}

export function modelDevice(): string {
  return device;
}

/** Whether the model has been downloaded before (so loading needs no internet). */
export async function modelCached(): Promise<boolean> {
  try {
    const c = await caches.open('transformers-cache');
    const keys = await c.keys();
    return keys.some((k) => k.url.includes('RMBG-1.4') && k.url.includes('.onnx'));
  } catch {
    return false;
  }
}

export function loadModel(onProgress: (fraction: number) => void = () => {}): Promise<void> {
  progressListeners.add(onProgress);
  if (state === 'ready') {
    progressListeners.delete(onProgress);
    return Promise.resolve();
  }
  loadPromise ??= new Promise<void>((resolve, reject) => {
    state = 'loading';
    rejectLoad = reject;
    const w = getWorker();
    const onMsg = (ev: MessageEvent) => {
      if (ev.data.type === 'ready') {
        state = 'ready';
        rejectLoad = null;
        w.removeEventListener('message', onMsg);
        resolve();
        readyListeners.forEach((l) => l());
      } else if (ev.data.type === 'error' && ev.data.id === -1) {
        state = 'missing';
        loadPromise = null;
        rejectLoad = null;
        w.removeEventListener('message', onMsg);
        reject(new Error(ev.data.message));
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage({ type: 'load' });
  });
  return loadPromise.finally(() => progressListeners.delete(onProgress));
}

/** One mask from the worker. Any failure to load, a crash, or a stuck job is ModelUnavailable. */
export async function runModel(pixels: Uint8ClampedArray, w: number, h: number): Promise<Uint8Array> {
  try {
    await loadModel();
  } catch (e) {
    throw e instanceof ModelUnavailable ? e : new ModelUnavailable((e as Error)?.message);
  }
  const id = nextId++;
  const wk = getWorker();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resetWorker(new ModelUnavailable('The cut-out tool took too long')), jobTimeout);
    waiting.set(id, { resolve, reject, timer });
    const copy = new Uint8ClampedArray(pixels);
    wk.postMessage({ type: 'run', id, rgba: copy, w, h }, [copy.buffer]);
  });
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
}

/** Runs jobs one at a time in the order added. `add` returns at once, so shooting never waits. */
export function createQueue<J, R>(run: (job: J) => Promise<R>): Queue<J, R> {
  const jobs: { id: string; job: J }[] = [];
  const listeners = new Set<(id: string, res: { value?: R; error?: unknown }) => void>();
  let busy = false;
  let n = 0;
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
  };
}


/** Shrinks a photo to a long edge and saves it as WebP (extra photos, receipts). */
export async function shrinkToWebp(bitmap: ImageBitmap, longEdge: number = LONG_EDGE.original): Promise<{ blob: Blob; w: number; h: number }> {
  const { w, h } = fitWithin(bitmap.width, bitmap.height, longEdge);
  const c = canvas(w, h);
  c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  return { blob: await toWebp(c), w, h };
}
