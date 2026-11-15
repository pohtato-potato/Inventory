# Inventory

A phone app holding everything one person owns, clothes first, built as an installable web app (PWA) for an Android phone. Pieces sit in lit shop windows, coloured by the clothes themselves.

- **Everything stays on the phone.** Pieces, photos and history live in the browser's IndexedDB. There is no server, account or analytics.
- **Works offline after the first run.** The background-removal model (RMBG-1.4) and the text reader for receipts download once and are kept on the phone.
- **The code holds no personal data or keys.** Drive backup needs a Google client id, which comes from the owner's private starter file (Settings › Set up Drive backup). Backups are a `.zip` saved from Settings, or a folder called "Inventory" in Google Drive (drive.file scope: the app sees only files it made). A spreadsheet (`.csv`) can be exported too.

## Develop

```bash
npm install
npm run dev        # http://localhost:5174
npm test           # domain, database, photo, receipt and backup tests
npm run typecheck
npm run build      # production build in dist/
npm run preview    # the built app on http://localhost:4174
npm run icons      # re-render the app icons
node scripts/seed-300.mjs   # prints the dev address that fills the app with 300 sample pieces
```

Stack: Vite, React, TypeScript, Dexie (IndexedDB), vite-plugin-pwa, @huggingface/transformers (RMBG-1.4 in a web worker, WebGPU or WASM), tesseract.js, fflate. Fonts (Archivo, Atkinson Hyperlegible) are bundled.

Publishing runs from `.github/workflows/deploy.yml` (GitHub Pages) once Pages is switched on for the repository.
