/** Long edge in pixels for stored photos: the original and the cut-out. */
export const LONG_EDGE = { original: 1600, cutout: 1000 } as const;

/** Scales a size down to fit a long edge; never enlarges. */
export function fitWithin(w: number, h: number, longEdge: number): { w: number; h: number } {
  const k = Math.min(1, longEdge / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** Encodes a canvas as WebP. */
export async function toWebp(canvas: HTMLCanvasElement | OffscreenCanvas, quality = 0.85): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/webp', quality });
  return new Promise((resolve, reject) =>
    (canvas as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo'))), 'image/webp', quality),
  );
}
