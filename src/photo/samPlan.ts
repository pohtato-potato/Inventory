// How the tap-to-fix model runs on this device, and how much it downloads. Shared by the worker and the screen,
// so the size the owner is told is the size that is fetched. Measured on the Mac:
// docs/superpowers/notes/2026-11-tap-to-fix.md.

export const SAM_MODEL = 'Xenova/slimsam-77-uniform';

export type SamPlan = { device: 'webgpu' | 'wasm'; dtype: 'fp16' | 'q8' };

/** The encoder plus the prompt decoder, in bytes (Hugging Face file sizes). */
export const SAM_BYTES: Record<SamPlan['dtype'], number> = { fp16: 12_170_657 + 8_550_118, q8: 8_882_165 + 4_903_810 };

/**
 * WebGPU with half floats (prepare ~1–2.5 s, taps ~0.2 s on the Mac), else WASM with the 8-bit model.
 * WebGPU without half floats is skipped: the full-precision model is twice the download and was slower.
 */
export async function samPlans(): Promise<SamPlan[]> {
  const out: SamPlan[] = [];
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
  try {
    const adapter = gpu ? await gpu.requestAdapter() : null;
    if (adapter?.features.has('shader-f16')) out.push({ device: 'webgpu', dtype: 'fp16' });
  } catch {
    /* no WebGPU */
  }
  out.push({ device: 'wasm', dtype: 'q8' });
  return out;
}

/** "about 21 MB": what the first try on this device downloads. */
export async function samDownloadText(): Promise<string> {
  const [first] = await samPlans();
  return `about ${Math.round(SAM_BYTES[first.dtype] / 1e6)} MB`;
}
