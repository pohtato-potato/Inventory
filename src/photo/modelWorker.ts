// One model running in a web worker: load once (with download progress), send jobs by id, and recover
// from a crashed or stuck worker by failing its jobs as ModelUnavailable and starting afresh next time.
// Used by the cut-out model (RMBG) and the tap-to-fix model (SlimSAM).

/** The tool could not run at all (no download yet, worker crashed, a job stuck): the photo is fine, try again later. */
export class ModelUnavailable extends Error {
  constructor(why = 'The cut-out tool is not available yet') {
    super(why);
    this.name = 'ModelUnavailable';
  }
}

export type ModelState = 'missing' | 'loading' | 'ready';

/** What a worker sends back: progress, ready, an error (id -1 is the load), or a job's answer by id. */
type Reply = { type: string; id?: number; fraction?: number; message?: string; device?: string; [k: string]: unknown };

export interface ModelWorker {
  state(): ModelState;
  device(): string;
  /** Whether the model's files are already in Cache Storage (so loading needs no internet). */
  cached(): Promise<boolean>;
  load(onProgress?: (fraction: number) => void): Promise<void>;
  /** Sends one job and resolves with the worker's whole reply. Any load failure, crash or stuck job is ModelUnavailable. */
  request<R extends Reply>(msg: Record<string, unknown>, transfer?: Transferable[]): Promise<R>;
  onReady(cb: () => void): () => void;
  /** Throws the worker away (for leaving the screen that used it). */
  close(): void;
  /** Tests only. */
  _setFactory(f: () => Worker): void;
  _setTimeout(ms: number): void;
}

export function createModelWorker(opts: { make: () => Worker; name: string; timeout: number; cacheMatch: (url: string) => boolean }): ModelWorker {
  let make = opts.make;
  let timeout = opts.timeout;
  let state: ModelState = 'missing';
  let worker: Worker | null = null;
  let device = '';
  let nextId = 1;
  const waiting = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let loadPromise: Promise<void> | null = null;
  let rejectLoad: ((e: Error) => void) | null = null;
  const progressListeners = new Set<(f: number) => void>();
  const readyListeners = new Set<() => void>();

  function reset(why: Error) {
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
    const w = make();
    worker = w;
    const stopped = () => { if (worker === w) reset(new ModelUnavailable(`The ${opts.name} stopped`)); };
    w.onerror = stopped;
    w.onmessageerror = stopped;
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data as Reply;
      if (m.device) device = m.device;
      if (m.type === 'progress') {
        progressListeners.forEach((l) => l(m.fraction ?? 0));
        return;
      }
      if (m.id === undefined || m.id < 0) return; // load replies are handled by load()
      const job = waiting.get(m.id);
      if (!job) return;
      clearTimeout(job.timer);
      waiting.delete(m.id);
      if (m.type === 'error') job.reject(new Error(m.message));
      else job.resolve(m);
    };
    return w;
  }

  function load(onProgress: (fraction: number) => void = () => {}): Promise<void> {
    if (state === 'ready') return Promise.resolve();
    progressListeners.add(onProgress);
    loadPromise ??= new Promise<void>((resolve, reject) => {
      state = 'loading';
      rejectLoad = reject;
      const w = getWorker();
      const onMsg = (ev: MessageEvent) => {
        const m = ev.data as Reply;
        if (m.type === 'ready') {
          state = 'ready';
          rejectLoad = null;
          w.removeEventListener('message', onMsg);
          resolve();
          readyListeners.forEach((l) => l());
        } else if (m.type === 'error' && m.id === -1) {
          state = 'missing';
          loadPromise = null;
          rejectLoad = null;
          w.removeEventListener('message', onMsg);
          reject(new Error(m.message));
        }
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ type: 'load' });
    });
    return loadPromise.finally(() => progressListeners.delete(onProgress));
  }

  return {
    state: () => state,
    device: () => device,
    async cached() {
      try {
        const keys = await (await caches.open('transformers-cache')).keys();
        return keys.some((k) => opts.cacheMatch(k.url));
      } catch {
        return false;
      }
    },
    load,
    async request<R extends Reply>(msg: Record<string, unknown>, transfer: Transferable[] = []): Promise<R> {
      try {
        await load();
      } catch (e) {
        throw e instanceof ModelUnavailable ? e : new ModelUnavailable((e as Error)?.message);
      }
      const id = nextId++;
      const wk = getWorker();
      return new Promise<R>((resolve, reject) => {
        const timer = setTimeout(() => reset(new ModelUnavailable(`The ${opts.name} took too long`)), timeout);
        waiting.set(id, { resolve: resolve as (r: Reply) => void, reject, timer });
        wk.postMessage({ ...msg, id }, transfer);
      });
    },
    onReady(cb) {
      readyListeners.add(cb);
      return () => readyListeners.delete(cb);
    },
    close: () => reset(new ModelUnavailable(`The ${opts.name} was closed`)),
    _setFactory(f) {
      reset(new ModelUnavailable());
      make = f;
    },
    _setTimeout(ms) {
      timeout = ms;
    },
  };
}
