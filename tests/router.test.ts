import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/router';

describe('parseHash', () => {
  it('opens on the wardrobe when the hash is empty', () => {
    expect(parseHash('')).toMatchObject({ path: '/wardrobe' });
    expect(parseHash('#/')).toMatchObject({ path: '/wardrobe' });
  });
  it('reads the path and its params', () => {
    const r = parseHash('#/piece?id=abc');
    expect(r.path).toBe('/piece');
    expect(r.params.get('id')).toBe('abc');
  });
});
