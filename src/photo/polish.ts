/**
 * Flat-lay polish. The piece is turned so its long axis sits square to the frame;
 * the soft shadow under it is drawn by the window (CSS drop-shadow), not baked in.
 */

/**
 * How far the piece is turned from square, in degrees, clamped to ±20; 0 under 3.
 * Finds the turn whose bounding box is smallest (a laid-flat garment's edges run square),
 * which holds for nearly square pieces where the long axis says little.
 */
export function tiltDegrees(mask: Uint8Array, w: number, h: number): number {
  const pts: number[] = [];
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] >= 128;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (on(x, y) && (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1))) pts.push(x, y);
  if (pts.length < 20) return 0;
  const step = Math.max(1, Math.floor(pts.length / 2 / 3000));
  const area = (deg: number) => {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2 * step) {
      const x = pts[i], y = pts[i + 1];
      const u = c * x + s * y, v = -s * x + c * y;
      if (u < x0) x0 = u;
      if (u > x1) x1 = u;
      if (v < y0) y0 = v;
      if (v > y1) y1 = v;
    }
    return (x1 - x0) * (y1 - y0);
  };
  let best = 0, bestA = area(0);
  for (let d = -20; d <= 20; d += 0.5) {
    const a = area(d);
    if (a < bestA - 1e-9) { bestA = a; best = d; }
  }
  for (let d = best - 0.5; d <= best + 0.5; d += 0.1) {
    const a = area(d);
    if (a < bestA - 1e-9) { bestA = a; best = d; }
  }
  // Only turn when squaring it up clearly tightens the box; otherwise the shape has no clear edges.
  if (bestA > area(0) * 0.97 || Math.abs(best) < 3) return 0;
  // A long piece (jeans, a scarf) must also agree with its long axis, or splayed legs would fool the box.
  const axis = principalAxis(mask, w, h);
  if (axis && axis.ratio > 1.6 && Math.abs(axis.deg - best) > 4) return 0;
  return Math.max(-20, Math.min(20, Math.round(best * 10) / 10));
}

/** The long axis of the piece, squared to the nearest frame axis, and how elongated it is. */
function principalAxis(mask: Uint8Array, w: number, h: number): { deg: number; ratio: number } | null {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] >= 128) { n++; sx += x; sy += y; }
  if (n < 10) return null;
  const mx = sx / n, my = sy / n;
  let xx = 0, yy = 0, xy = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x] >= 128) {
        const dx = x - mx, dy = y - my;
        xx += dx * dx; yy += dy * dy; xy += dx * dy;
      }
  const tr = xx + yy, det = xx * yy - xy * xy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc, l2 = Math.max(1e-9, tr / 2 - disc);
  let deg = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI;
  deg = ((((deg + 45) % 90) + 90) % 90) - 45;
  return { deg, ratio: Math.sqrt(l1 / l2) };
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
