/**
 * Cleans the model's alpha mask: threshold, open (radius 3), fill holes from outside,
 * keep the part nearest the centre, soften by a pixel. Returns null when the cut-out failed and the
 * photo is kept uncut: what is left is under 2 % of the frame, over 75 % of it, or runs along more
 * than a quarter of the frame's edge (the model took in a busy background with the piece), or the
 * model was unsure (mid-grey) about more than 8 % of the frame.
 * Limits measured on RMBG-1.4: docs/superpowers/notes/2026-11-cutout-patterned.md.
 */
export function cleanMask(alpha: Uint8Array, w: number, h: number): Uint8Array | null {
  const n = w * h;
  let bin: Uint8Array = new Uint8Array(n);
  let unsure = 0;
  for (let i = 0; i < n; i++) {
    bin[i] = alpha[i] >= 128 ? 1 : 0;
    if (alpha[i] > 32 && alpha[i] < 223) unsure++;
  }
  if (unsure > 0.08 * n) return null;

  bin = dilate(erode(bin, w, h, 3), w, h, 3);
  fillHoles(bin, w, h);
  const kept = keepNearestCentre(bin, w, h);
  if (!kept) return null;
  let area = 0;
  for (let i = 0; i < n; i++) area += kept[i];
  if (area < 0.02 * n || area > 0.75 * n) return null;
  if (edgeShare(kept, w, h) > 0.25) return null;
  return blur1(kept, w, h);
}

/** The share of the frame's edge pixels the mask covers. A piece laid flat in frame barely touches it. */
function edgeShare(m: Uint8Array, w: number, h: number): number {
  let on = 0, all = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && y !== 0 && x !== w - 1 && y !== h - 1) continue;
      all++;
      on += m[y * w + x];
    }
  }
  return all ? on / all : 0;
}

/** Separable min (erode) or max (dilate) filter over a square of the given radius. */
function rank(src: Uint8Array, w: number, h: number, r: number, max: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  const pick = max ? Math.max : Math.min;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = src[y * w + x];
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = pick(v, src[y * w + k]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x];
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = pick(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}
const erode = (a: Uint8Array, w: number, h: number, r: number) => rank(a, w, h, r, false);
const dilate = (a: Uint8Array, w: number, h: number, r: number) => rank(a, w, h, r, true);

/** Any background not reachable from the frame's edge is a hole inside the piece: fill it. */
function fillHoles(bin: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!bin[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  for (let i = 0; i < w * h; i++) if (!bin[i] && !outside[i]) bin[i] = 1;
}

/** Labels connected parts and keeps the one with a pixel closest to the centre. */
function keepNearestCentre(bin: Uint8Array, w: number, h: number): Uint8Array | null {
  const label = new Int32Array(w * h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2;
  let next = 0, best = -1, bestD = Infinity;
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || label[s]) continue;
    next++;
    label[s] = next;
    stack.push(s);
    let near = Infinity;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i - x) / w;
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < near) near = d;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && bin[j] && !label[j]) { label[j] = next; stack.push(j); }
    }
    if (near < bestD) { bestD = near; best = next; }
  }
  if (best < 0) return null;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0;
  return out;
}

/** A 3 × 3 box blur on a 0/1 mask, giving 0–255 alpha with a soft one-pixel edge. */
function blur1(bin: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += bin[yy * w + xx];
          cnt++;
        }
      }
      out[y * w + x] = Math.round((255 * sum) / cnt);
    }
  }
  return out;
}
