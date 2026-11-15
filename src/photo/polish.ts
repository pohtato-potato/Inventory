/**
 * Flat-lay polish. The piece is turned so its long axis sits square to the frame;
 * the soft shadow under it is drawn by the window (CSS drop-shadow), not baked in.
 */

/** How far the piece is turned from square, in degrees (principal axis), clamped to ±20; 0 under 3. */
export function tiltDegrees(mask: Uint8Array, w: number, h: number): number {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] >= 128) { n++; sx += x; sy += y; }
  if (n < 10) return 0;
  const mx = sx / n, my = sy / n;
  let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x] >= 128) {
        const dx = x - mx, dy = y - my;
        xx += dx * dx; yy += dy * dy; xy += dx * dy;
      }
  if (Math.abs(xx - yy) < 1e-6 && Math.abs(xy) < 1e-6) return 0; // round: no axis
  let deg = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;
  // Square to the nearest axis: a piece standing upright counts the same as one lying flat.
  deg = ((((deg + 45) % 90) + 90) % 90) - 45;
  if (Math.abs(deg) < 3) return 0;
  return Math.max(-20, Math.min(20, Math.round(deg * 10) / 10));
}

/** The box around the piece, with padding, or null for an empty mask. */
export function maskBounds(mask: Uint8Array, w: number, h: number, pad: number): { x: number; y: number; w: number; h: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x] >= 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return null;
  const X = Math.max(0, x0 - pad), Y = Math.max(0, y0 - pad);
  return { x: X, y: Y, w: Math.min(w, x1 + 1 + pad) - X, h: Math.min(h, y1 + 1 + pad) - Y };
}
