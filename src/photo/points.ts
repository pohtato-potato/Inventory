// Tap to fix: the owner's taps, and which of the model's masks to use. Pure, so it is tested without the model.

/** A tap on the photo, in 0–1 photo coordinates. label 1 = keep this (part of the piece), 0 = remove this. */
export interface TapPoint {
  x: number;
  y: number;
  label: 0 | 1;
}
export type TapMode = 'keep' | 'remove';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Where a tap at (clientX, clientY) lands on the photo shown in `rect`. */
export function tapAt(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, mode: TapMode): TapPoint {
  return { x: clamp01((clientX - rect.left) / rect.width), y: clamp01((clientY - rect.top) / rect.height), label: mode === 'keep' ? 1 : 0 };
}

export const addPoint = (points: TapPoint[], p: TapPoint): TapPoint[] => [...points, p];
export const undoPoint = (points: TapPoint[]): TapPoint[] => points.slice(0, -1);

/** The model's prompt: x, y pairs in its resized frame ([height, width]) and the labels. */
export function promptFor(points: TapPoint[], resized: [number, number]): { coords: Float32Array; labels: number[] } {
  const [rh, rw] = resized;
  return { coords: Float32Array.from(points.flatMap((p) => [p.x * rw, p.y * rh])), labels: points.map((p) => p.label) };
}

/**
 * Which of the model's masks (any non-zero = in) to show. SlimSAM scores a mask of the whole frame highest
 * even when a smaller one is exactly the piece (measured: docs/superpowers/notes/2026-11-tap-to-fix.md), so:
 * never the whole frame (over 95 %); the smallest mask that holds every keep point and no remove point;
 * failing that, the one that agrees with the most points, then the best score. Only whole-frame masks: the best score.
 */
export function pickMask(masks: Uint8Array[], scores: number[], points: TapPoint[], w: number, h: number): number {
  const n = w * h;
  const at = (p: TapPoint) => Math.min(h - 1, Math.floor(p.y * h)) * w + Math.min(w - 1, Math.floor(p.x * w));
  const info = masks.map((m, i) => {
    let area = 0;
    for (let k = 0; k < n; k++) if (m[k]) area++;
    const agree = points.filter((p) => (m[at(p)] ? 1 : 0) === p.label).length;
    return { i, area, agree, score: scores[i] ?? 0 };
  });
  const bestScore = (list: typeof info) => list.reduce((a, b) => (b.score > a.score ? b : a)).i;
  const usable = info.filter((m) => m.area <= 0.95 * n);
  if (!usable.length) return bestScore(info);
  const fit = usable.filter((m) => m.agree === points.length).sort((a, b) => a.area - b.area);
  if (fit.length) return fit[0].i;
  const most = Math.max(...usable.map((m) => m.agree));
  return bestScore(usable.filter((m) => m.agree === most));
}
