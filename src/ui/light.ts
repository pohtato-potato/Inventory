/** Pure helpers for the Shop Window look: the pool of light behind a piece, and rolling numbers. */

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * The colour of the light behind a piece: its own hue, with lightness held between 0.24 and 0.46
 * so a white piece still reads as a pool of light and a black one is not lost on the dark pane.
 */
export function windowColour(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  const L = 0.24 + Math.max(0, Math.min(1, l)) * 0.22;
  const S = Math.min(0.55, s * 0.85);
  return hslToHex(h, S, L);
}

/** Frames for a number rolling up to `to` with an exponential ease-out. Never counts down; ends on `to`. */
export function rollFrames(to: number, steps: number): number[] {
  const out: number[] = [];
  let prev = 0;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const v = i === steps ? to : Math.round(to * (1 - Math.pow(2, -10 * k)));
    prev = Math.max(prev, Math.min(v, to));
    out.push(prev);
  }
  return out;
}

/** A neutral pool for a piece whose colour is not known yet. */
export const UNKNOWN_LIGHT = '#4A4C55';
