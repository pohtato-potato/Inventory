import type { Shade } from './types';

type RGB = [number, number, number];
type Lab = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToLab([r, g, b]: RGB): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(hexToRgb(hex));
}

/** ΔE76: straight-line distance in Lab. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** The closest shade (never a family) to a colour. */
export function nearestShade(rgb: RGB, shades: Shade[]): Shade {
  const lab = rgbToLab(rgb);
  let best: Shade | undefined;
  let bestD = Infinity;
  for (const s of shades) {
    if (s.familyId === null || s.deletedAt) continue;
    const d = deltaE(lab, hexToLab(s.hex));
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) throw new Error('No shades to match against');
  return best;
}

/**
 * The main colours of a cut-out, largest first. Transparent pixels are skipped,
 * and colours closer than ΔE 12 are merged so three worn blacks count as one.
 */
export function dominant(pixels: Uint8ClampedArray, opts: { mergeBelow?: number } = {}): { rgb: RGB; share: number }[] {
  const mergeBelow = opts.mergeBelow ?? 12;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) {
      bin.n++; bin.r += r; bin.g += g; bin.b += b;
    } else bins.set(key, { n: 1, r, g, b });
    total++;
  }
  if (!total) return [];
  const list = [...bins.values()]
    .map((b) => ({ n: b.n, r: b.r, g: b.g, b: b.b, lab: rgbToLab([b.r / b.n, b.g / b.n, b.b / b.n]) }))
    .sort((a, b) => b.n - a.n);
  const clusters: typeof list = [];
  for (const bin of list) {
    const home = clusters.find((c) => deltaE(c.lab, bin.lab) < mergeBelow);
    if (home) {
      home.n += bin.n; home.r += bin.r; home.g += bin.g; home.b += bin.b;
    } else clusters.push({ ...bin });
  }
  return clusters
    .sort((a, b) => b.n - a.n)
    .map((c) => ({ rgb: [Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)] as RGB, share: c.n / total }));
}

/** Guesses the main shade and, when it covers at least a fifth of the piece, a second. */
export function guessShades(pixels: Uint8ClampedArray, shades: Shade[]): { main: Shade; second?: Shade } {
  const d = dominant(pixels);
  if (!d.length) throw new Error('No visible colour in the photo');
  const main = nearestShade(d[0].rgb, shades);
  const next = d.slice(1).find((c) => c.share >= 0.2);
  if (!next) return { main };
  const second = nearestShade(next.rgb, shades);
  return second.id === main.id ? { main } : { main, second };
}
