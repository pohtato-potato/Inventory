// Renders the app icon to PNG: npm run icons
// A dark window lit from behind, with a tee standing in it.
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });

const G = '#0B0C0F';
const scene = (s = 1) => `
  <defs><radialGradient id="p" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#7A3A26"/><stop offset="1" stop-color="#15161A" stop-opacity="0"/></radialGradient></defs>
  <g transform="translate(100 100) scale(${s}) translate(-100 -100)">
    <rect x="30" y="30" width="140" height="140" rx="22" fill="#15161A"/>
    <rect x="30" y="30" width="140" height="140" rx="22" fill="url(#p)"/>
    <path d="M78 62 L62 70 L50 92 L66 100 L70 92 L70 142 L130 142 L130 92 L134 100 L150 92 L138 70 L122 62 Q100 76 78 62 Z" fill="#EEEAE4"/>
    <rect x="30" y="150" width="140" height="20" rx="0" fill="#000" opacity=".35"/>
  </g>`;
const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="${G}"/>${scene(1)}</svg>`;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${G}"/>${scene(0.8)}</svg>`;
const png = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();

writeFileSync(new URL('icon-192.png', out), png(appIcon, 192));
writeFileSync(new URL('icon-512.png', out), png(appIcon, 512));
writeFileSync(new URL('maskable-512.png', out), png(maskable, 512));
writeFileSync(new URL('apple-touch-icon.png', out), png(maskable, 180));
writeFileSync(new URL('../favicon.svg', out), appIcon);
console.log('Icons written to public/icons');
