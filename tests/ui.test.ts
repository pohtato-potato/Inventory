import { describe, expect, it } from 'vitest';
import { rollFrames } from '../src/ui/light';

describe('rollFrames', () => {
  it('ends on the number', () => {
    expect(rollFrames(47, 5).at(-1)).toBe(47);
    expect(rollFrames(0, 5).at(-1)).toBe(0);
  });
  it('never counts down', () => {
    expect(rollFrames(47, 5)).toEqual([...rollFrames(47, 5)].sort((a, b) => a - b));
    expect(rollFrames(300, 60)).toEqual([...rollFrames(300, 60)].sort((a, b) => a - b));
  });
  it('slows down at the end (ease-out)', () => {
    const f = rollFrames(100, 10);
    expect(f[0]).toBeGreaterThan(30);
    expect(f.length).toBe(10);
  });
});
