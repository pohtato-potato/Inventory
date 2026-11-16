import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import archivoLatin from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url';
import { App } from './App';
import { handleAuthReturn } from './backup/google';
import { startPwa } from './pwa';
import { parseShare } from './domain/wish';
import { go } from './router';

// Body text is Atkinson Hyperlegible, whose zero is slashed (hard to read small: "₹2,000" looked like "₹2,ØØØ").
// Its digits alone are swapped for Archivo's plain ones: the same bundled file the numerals already use.
document.fonts.add(new FontFace('Body digits', `url(${archivoLatin}) format('woff2')`, { unicodeRange: 'U+0030-0039', weight: '100 900', stretch: '62% 125%', display: 'swap' }));

// Google sending the owner back: take the token out of the address before anything reads it.
handleAuthReturn();
startPwa();

// Shared in from a shop app: open the wish form with what came, and take the query out of the address.
const shared = parseShare(location.search);
if (shared) {
  history.replaceState(null, '', location.pathname);
  go('/wish-new', { ...shared, source: 'share' }, { replace: true });
}

if (import.meta.env.DEV) {
  // On load, and when only the address's hash changes (typing ?devseed= into an open tab does not reload the page).
  const seed = () => {
    const n = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('devseed'));
    if (n) void import('./dev/sample').then((m) => m.devSeed(n));
  };
  seed();
  addEventListener('hashchange', seed);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
