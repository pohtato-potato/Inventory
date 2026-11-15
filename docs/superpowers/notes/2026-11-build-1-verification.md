# Build 1 verification

Run 15 November 2026 on branch `feat/build-1`, by Claude (Opus 5.5) in the Claude desktop app.

**Environment:** MacBook (Apple M3), macOS 27.0.1, Node 26.11.1, local time zone IST. Browser checks ran in the desktop app's built-in Chromium pane with the viewport emulated at 360 × 745 and 340 × 700. **Nothing here ran on the Samsung S23.**

## Automated checks

| Command | Result |
|---|---|
| `TZ=UTC npm test` | 21 files, 143 tests passed |
| `npm test` (IST) | 21 files, 143 tests passed |
| `npm run typecheck` | no errors |
| `npm run build` | built; service worker precaches 22 files (1,793.5 KiB); main script 457 KB (146 KB gzip) |

## Layout and legibility (step 2)

Audited with a script run in the page (every visible text node and every button, link and input, whole page, not just the first screen).
Screens: Wardrobe by kind, by colour, by place; Things; Search (empty and with a query); a piece page; Details; My sizes; Settings. The empty wardrobe was checked in the built preview.

| Check | 360 × 745 | 340 × 700 |
|---|---|---|
| Text under 14 px | 0 | 0 |
| Tap targets under 44 px | 0 | 0 |
| Text contrast under 4.5:1 (on solid backgrounds) | 0 | not re-run |
| Horizontal scroll | none | none |
| Last content under the tab bar, scrolled to the bottom | none | none |

Limits of this audit:
- Contrast was only measured where the text sits on a solid colour. Text over a lit window (a gradient) was skipped by the script and was checked by eye only.
- The populated screens were audited on the dev server (sample data), because the built preview has its own, empty database. The CSS is the same in both.
- Not audited: the gone-piece page (the sample had no gone pieces), the Camera screen (camera access is blocked in the pane), and open sheets.

Each screen was compared by eye with `design/inventory-look-board-3.html` at 360 px while it was built (Tasks 8–14).

## Offline after the first run (step 3, Review Focus 1)

In the built preview (`npm run preview`, port 4174):
1. Loaded the cut-out model in the app's own worker and ran it on a test image: **WebGPU fp16**. The first load, with the download, took **4,993 ms**. One 400 × 500 cut-out took **506 ms**, and the mask covered 30 %, exactly the shape drawn.
2. Read a receipt image with the app's own reader in **248 ms** ("Order total Rs 1,299 / Delivered on 4 Oct 2026", read correctly).
3. Confirmed the caches:
   - The service-worker precache holds the app.
   - `transformers-cache` holds `model_fp16.onnx` and its config.
   - `models` holds the ONNX runtime `.mjs`/`.wasm`, the tesseract core and `eng.traineddata`.
4. **Stopped the preview server** and reloaded. A request to the server failed (unreachable), yet:
   - the app opened on the Wardrobe;
   - the model loaded from cache in **663 ms**;
   - a cut-out ran in **527 ms** (30 % mask);
   - a new receipt image was read ("Paid 2,450 at Zara").

**Not verified:**
- The Mac's own internet was still on during this test. The model, runtime and language files are served cache-first, so they should not touch the network, but full aeroplane mode was not tested.
- The cut-out and reader were driven from a script calling the app's own built worker and reader, not by tapping through the Camera screen, because the pane blocks the camera.
- On the S23, the WASM path (q8 model) would be cached only if it is ever used there.

Earlier dev measurements (Task 7, same Mac): one 1200 × 1600 photo cut out in 2.0 s on WebGPU fp16. The original saved as a 21 KB WebP; the cut-out as a 24 KB WebP at 624 × 1000. The reader read a rendered Myntra order screen in 1.2 s.

## Empty, one piece, 300 pieces (step 4)

- **Empty:** "0 pieces · Nothing here yet · Add your first piece", with the tab bar clear of content (built preview).
- **One piece and a dozen:** walked during Tasks 9–14 on the dev sample.
- **300 pieces** (`?devseed=300`, dev server): every count agrees.
  - Wardrobe hero: 250.
  - "All" chip: 250. Kind chips: Tops 125 (Tees 75, Shirts 25, Jackets 25), Bottoms 50, Shoes 50, Accessories 25, Watches 25.
  - Colour families add up to 250: Black 75, White 50, and 25 each for Grey, Brown, Red, Green and Blue.
  - By place: Home 200 + No spot yet 50 = 250.
  - Things hero: 50.
- **Scroll smoothness at 300 pieces: not measured.** The browser pane was hidden, which pauses animation frames, so frame times could not be read. Check it on the phone.

## Owner steps still open

- **Task 7 step 5:** cut-out speed on the S23 over Wi-Fi. Waiting for the owner; the result goes in `2026-11-cutout-s23.md`.
- **Task 15 step 5:** Drive sign-in. It needs the Google client id from the owner's private starter file, and the address the app is served from must be one of that client's allowed origins and redirect addresses. Not run. If it cannot be made to work, the file backup stands alone.

## Found while verifying

The build also writes `dist/assets/ort-wasm-simd-threaded.jsep-*.wasm` (21.6 MB). The app never fetches it, because the runtime comes from the CDN and is cached. It only makes the published site larger. Listed as a minor.
