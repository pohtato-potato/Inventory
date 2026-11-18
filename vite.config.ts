import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  // Relative paths, so the same build works at any address or sub-folder.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Inventory',
        short_name: 'Inventory',
        description: 'Everything you own: clothes and everything else. It all stays on this phone.',
        start_url: './#/home',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0C0F',
        theme_color: '#0B0C0F',
        categories: ['lifestyle', 'productivity'],
        // A shop app's Share → Inventory opens the app with the product's title, text and link (main.tsx reads them).
        share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/*vietnamese*', '**/*cyrillic*', '**/*greek*', '**/*.wasm'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The first install takes over the open page, so the first model download is already cached.
        clientsClaim: true,
        runtimeCaching: [
          {
            // The engines for the cut-out and the text reader, and the reader's English data, are fetched
            // on first use and kept for offline. The cut-out model itself is kept by transformers.js in
            // its own cache ('transformers-cache'), so it is not stored twice.
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://tessdata.projectnaptha.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'models',
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    port: 5174,
    // The private folder holds the starter file; never serve it.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**'] },
  },
  preview: { port: 4174 },
});
