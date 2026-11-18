/** Rolling numbers. */

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
