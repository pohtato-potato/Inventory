/// <reference lib="webworker" />
// Runs RMBG-1.4 off the main thread. Loading follows the October S23 test page (bg-test/index.html, b3f507b).
import { AutoModel, AutoProcessor, RawImage, env, type PreTrainedModel, type Processor } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true; // the model is kept in Cache Storage after the first download

const MODEL = 'briaai/RMBG-1.4';
let loaded: { model: PreTrainedModel; processor: Processor; device: string } | null = null;
let loading: Promise<void> | null = null;

type In = { type: 'load' } | { type: 'run'; id: number; rgba: Uint8ClampedArray; w: number; h: number };

const post = (m: unknown, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

async function pickDevice(): Promise<{ device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'fp32' | 'q8' }[]> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  const out: { device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'fp32' | 'q8' }[] = [];
  if (gpu) {
    try {
      const adapter = await gpu.requestAdapter();
      if (adapter) out.push({ device: 'webgpu', dtype: adapter.features.has('shader-f16') ? 'fp16' : 'fp32' });
    } catch {
      /* no WebGPU */
    }
  }
  out.push({ device: 'wasm', dtype: 'q8' });
  return out;
}

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
  for (const { device, dtype } of await pickDevice()) {
    try {
      const model = await AutoModel.from_pretrained(MODEL, { config: { model_type: 'custom' } as never, device, dtype, progress_callback });
      const processor = await AutoProcessor.from_pretrained(MODEL, {
        config: {
          do_normalize: true, do_pad: false, do_rescale: true, do_resize: true,
          image_mean: [0.5, 0.5, 0.5], feature_extractor_type: 'ImageFeatureExtractor',
          image_std: [1, 1, 1], resample: 2, rescale_factor: 0.00392156862745098,
          size: { width: 1024, height: 1024 },
        } as never,
      });
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
    if (m.type === 'load') {
      loading ??= load();
      await loading;
      post({ type: 'ready', device: loaded!.device });
      return;
    }
    loading ??= load();
    await loading;
    const t0 = performance.now();
    const image = new RawImage(m.rgba, m.w, m.h, 4);
    const { pixel_values } = await loaded!.processor(image);
    const { output } = await loaded!.model({ input: pixel_values });
    const mask = await RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(m.w, m.h);
    const alpha = new Uint8Array(mask.data as Uint8Array);
    post({ type: 'mask', id: m.id, alpha, ms: performance.now() - t0, device: loaded!.device }, [alpha.buffer]);
  } catch (e) {
    loading = null;
    post({ type: 'error', id: m.type === 'run' ? m.id : -1, message: e instanceof Error ? e.message : String(e) });
  }
};
