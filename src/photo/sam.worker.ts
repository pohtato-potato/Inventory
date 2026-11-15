/// <reference lib="webworker" />
// Tap to fix: SlimSAM (a small Segment Anything) off the main thread. The photo is encoded once ("embed");
// each tap then only runs the small prompt decoder against that stored embedding ("decode"), so taps are quick.
import { AutoProcessor, SamModel, RawImage, Tensor, env, type Processor } from '@huggingface/transformers';
import { pickMask, promptFor, type TapPoint } from './points';
import { SAM_MODEL, samPlans } from './samPlan';

env.allowLocalModels = false;
env.useBrowserCache = true; // kept in Cache Storage after the first download, like the cut-out model

type In =
  | { type: 'load' }
  | { type: 'embed'; id: number; rgba: Uint8ClampedArray; w: number; h: number }
  | { type: 'decode'; id: number; points: TapPoint[] };
type Inputs = Record<string, unknown> & { original_sizes: [number, number][]; reshaped_input_sizes: [number, number][] };

const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

let loaded: { model: SamModel; processor: Processor; device: string } | null = null;
let loading: Promise<void> | null = null;
/** The current photo: its embedding and sizes, reused by every tap. */
let photo: { inputs: Inputs; emb: Record<string, Tensor>; w: number; h: number } | null = null;

async function load() {
  if (loaded) return;
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file || !p.total) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    let a = 0, b = 0;
    for (const f of files.values()) { a += f.loaded; b += f.total; }
    post({ type: 'progress', fraction: b ? a / b : 0, bytes: b });
  };
  let lastErr: unknown;
  for (const { device, dtype } of await samPlans()) {
    try {
      const model = (await SamModel.from_pretrained(SAM_MODEL, { device, dtype, progress_callback })) as SamModel;
      const processor = await AutoProcessor.from_pretrained(SAM_MODEL, { progress_callback });
      loaded = { model, processor, device: `${device} ${dtype}` };
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

self.onmessage = async (ev: MessageEvent<In>) => {
  const m = ev.data;
  try {
    loading ??= load();
    await loading;
    if (m.type === 'load') {
      post({ type: 'ready', device: loaded!.device });
      return;
    }
    const t0 = performance.now();
    if (m.type === 'embed') {
      photo = null;
      const inputs = (await loaded!.processor(new RawImage(m.rgba, m.w, m.h, 4).rgb())) as Inputs;
      const emb = (await loaded!.model.get_image_embeddings(inputs as never)) as unknown as Record<string, Tensor>;
      photo = { inputs, emb, w: m.w, h: m.h };
      post({ type: 'done', id: m.id, ms: performance.now() - t0 });
      return;
    }
    if (!photo) throw new Error('No photo is ready');
    const { w, h } = photo;
    const p = promptFor(m.points, photo.inputs.reshaped_input_sizes[0]);
    const input_points = new Tensor('float32', p.coords, [1, 1, m.points.length, 2]);
    const input_labels = new Tensor('int64', BigInt64Array.from(p.labels.map(BigInt)), [1, 1, m.points.length]);
    const out = (await loaded!.model({ ...photo.emb, input_points, input_labels } as never)) as unknown as { pred_masks: Tensor; iou_scores: Tensor };
    const [masks] = await (loaded!.processor as unknown as { post_process_masks: (...a: unknown[]) => Promise<Tensor[]> })
      .post_process_masks(out.pred_masks, photo.inputs.original_sizes, photo.inputs.reshaped_input_sizes);
    const n = w * h;
    const all = masks.data as Uint8Array;
    const scores = Array.from(out.iou_scores.data as Float32Array);
    const list = scores.map((_, k) => all.subarray(k * n, (k + 1) * n));
    const best = pickMask(list, scores, m.points, w, h);
    const alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) alpha[i] = list[best][i] ? 255 : 0;
    post({ type: 'done', id: m.id, alpha, score: scores[best], ms: performance.now() - t0 }, [alpha.buffer]);
  } catch (e) {
    if (m.type === 'load') loading = null;
    post({ type: 'error', id: m.type === 'load' ? -1 : m.id, message: e instanceof Error ? e.message : String(e) });
  }
};
