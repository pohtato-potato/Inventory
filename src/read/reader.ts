import workerPath from 'tesseract.js/dist/worker.min.js?url';
import type { Worker } from 'tesseract.js';

/**
 * Reads the text in a photo on the phone with tesseract.js. Loaded only when first used.
 * The worker script ships with the app; the engine and English data come from jsDelivr once
 * and are kept by the service worker (and tesseract's own store) for offline use.
 */
let worker: Promise<Worker> | null = null;

function getWorker(onProgress?: (f: number) => void): Promise<Worker> {
  worker ??= import('tesseract.js').then(({ createWorker }) =>
    createWorker('eng', 1, {
      workerPath,
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => onProgress?.(m.progress),
    }),
  );
  worker.catch(() => { worker = null; });
  return worker;
}

export async function readImage(blob: Blob, onProgress?: (f: number) => void): Promise<string> {
  const w = await getWorker(onProgress);
  const { data } = await w.recognize(blob);
  return data.text;
}
