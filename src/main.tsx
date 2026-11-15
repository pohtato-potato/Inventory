import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startPwa } from './pwa';

startPwa();

if (import.meta.env.DEV) {
  const n = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('devseed'));
  if (n) void import('./dev/sample').then((m) => m.devSeed(n));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
