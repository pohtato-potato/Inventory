import { describe, expect, it } from 'vitest';
import { hexToHsl, rollFrames, windowColour } from '../src/ui/light';

const lightness = (hex: string) => hexToHsl(hex)[2];

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

describe('windowColour', () => {
  it('gives a white piece a pool that is still visibly a light, not a glare', () => {
    expect(lightness(windowColour('#F2EFE8'))).toBeLessThanOrEqual(0.5);
  });
  it('keeps a black piece from being lost on the dark pane', () => {
    expect(lightness(windowColour('#0E0E10'))).toBeGreaterThanOrEqual(0.22);
  });
  it('keeps the hue of a coloured piece', () => {
    const [h] = hexToHsl(windowColour('#6D1A2B'));
    const [h0] = hexToHsl('#6D1A2B');
    expect(Math.abs(h - h0)).toBeLessThan(3);
  });
  it('returns hex', () => {
    expect(windowColour('#2F4E86')).toMatch(/^#[0-9A-F]{6}$/);
  });
});
