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

// ---------- the redesign: item colours as whole pages ----------

/** Chalk: the app's text and primary-button colour. */
export const CHALK = '#F4F1EB';
/** Dark text on chalk. */
export const INK = '#16130F';

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return [h, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** A colour scaled toward black (k = 1 keeps it). */
export function darken(hex: string, k: number): string {
  return rgbToHex(hexToRgb(hex).map((v) => v * k) as RGB);
}

/**
 * A thing's colour as a whole page: its own hue, dark enough that chalk text reads at 4.5:1 or better,
 * and lifted off the graphite ground when it is nearly black, so a black thing still reads as a colour.
 */
export function itemColour(hex: string): string {
  let c = hex.toUpperCase();
  const [h, s, l] = toHsl(c);
  if (l < 0.16) c = fromHsl(h, Math.min(s, 0.5), 0.16);
  let k = 1;
  while (contrast(CHALK, c) < 4.5 && k > 0) {
    k -= 0.01;
    c = darken(hex, k);
  }
  return c;
}

/** Quiet text on an item colour: the colour lightened to about 88 %, raised further until it reads at 4.5:1. */
export function tintOf(hex: string): string {
  const base = itemColour(hex);
  const [h, s] = toHsl(base);
  let l = 0.88;
  let t = fromHsl(h, Math.min(s, 0.45), l);
  while (contrast(t, base) < 4.5 && l < 0.99) {
    l += 0.01;
    t = fromHsl(h, Math.min(s, 0.45), l);
  }
  return t;
}

/** A tile's ground: the item colour, darker, so the photo and the name on it stand out. */
export function tileColour(hex: string): string {
  return darken(itemColour(hex), 0.72);
}
