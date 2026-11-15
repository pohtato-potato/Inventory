import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('service worker wiring', () => {
  it('registers the service worker by hand, since injectRegister is false', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toMatch(/startPwa\(\)/);
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/injectRegister:\s*false/);
  });
});
