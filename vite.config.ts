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
        description: 'Everything you own, clothes first. Everything stays on this phone.',
        start_url: './#/wardrobe',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0C0F',
        theme_color: '#0B0C0F',
        categories: ['lifestyle', 'productivity'],
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
        runtimeCaching: [
          {
            // The cut-out model, the text reader and their engines are fetched on first use, then kept for offline.
            urlPattern: ({ url }) => url.origin === 'https://huggingface.co' || url.origin === 'https://cdn.jsdelivr.net' || url.hostname.endsWith('.hf.co') || url.hostname.endsWith('huggingface.co'),
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
