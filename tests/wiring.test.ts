import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('service worker wiring', () => {
  it('registers the service worker by hand, since injectRegister is false', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toMatch(/startPwa\(\)/);
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/injectRegister:\s*false/);
  });
});

describe('sharing in and the tabs (Task 7)', () => {
  it('declares a GET share target and reads it on start', () => {
    const cfg = readFileSync('vite.config.ts', 'utf8');
    expect(cfg).toMatch(/share_target/);
    expect(cfg).toMatch(/method:\s*'GET'/);
    expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/parseShare\(/);
  });
  it('has five tabs: Wardrobe, Things, +, Wishes, Home', async () => {
    const { TABS } = await import('../src/ui/TabBar');
    expect(TABS.map((t) => t.label)).toEqual(['Wardrobe', 'Things', 'Add a piece', 'Wishes', 'Home']);
  });
});
