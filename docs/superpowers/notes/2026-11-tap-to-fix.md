# Tap to fix: measurements

Measured 15 November 2026 on the Mac (Apple M3, Chromium in the Claude desktop app's browser pane), on branch `feat/tap-to-fix`. **Phone timing is unmeasured until the owner tries it on the S23.**

## Which model

SlimSAM (`Xenova/slimsam-77-uniform`), the smallest Segment Anything that transformers.js 3.8.1 runs. It was the first model tried and gave a usable mask, so no larger one was tested. The photo is encoded once; each tap only runs the small prompt decoder against that stored encoding.

Every precision on the same 1200 × 1600 photo, run in the app's worker:

| Device and precision | Download | Load (warm) | Prepare one photo (cold / warm) | One tap |
|---|---|---|---|---|
| **WebGPU fp16 (chosen with WebGPU)** | **20.7 MB** | 2.9 s | 2.5 s / 1.0 s | 150–190 ms (first ~0.9 s) |
| WebGPU fp32 | 39.8 MB | 1.0 s | 9.8 s / 5.6 s | 170–190 ms (first ~1.6 s) |
| **WASM q8 (chosen without WebGPU half floats)** | **13.8 MB** | 5.7 s | 6.3 s / 10.5 s | 210–270 ms |
| WASM fp16 | 20.7 MB | 1.3 s | 21.7 s / 8.1 s | 240–350 ms (first ~1.3 s) |

WebGPU fp32 was skipped: twice the download and slower to prepare than fp16. `src/photo/samPlan.ts` holds the choice and the sizes, so the size the screen states is the size that is fetched. The ONNX runtime files are the same ones the cut-out model already caches, so they are not counted.

## Which of the three masks

SlimSAM answers each tap with three masks and a score for each. On the test photos, **the top-scoring mask was always the whole frame** (scores 0.96–0.99, covering 93–99 % of it). The piece was always the smallest of the three (about 20 %), scored lower (0.70–0.95). So the app never takes a mask over 95 % of the frame. It takes the smallest mask that holds every keep point and no remove point (`pickMask` in `src/photo/points.ts`).

The cost: one tap on a large piece can find only part of it. On the chinos below, one tap found the upper half (overlap 0.70); a second tap on the leg found all of it (0.95). The screen's hint after the first tap says "Tap any part it missed."

## Build check (step 6 of the brief)

**Test photo:** the sample chinos cut-out (`design/inventory-photos.js`) laid on a busy, saturated floral sheet, 1200 × 1600. This is the case the automatic cut-out refuses: RMBG's overlap with the real piece was 0.24 on this kind of background (`2026-11-cutout-patterned.md`).

In the dev build, through the real screen at 360 × 745:
- **Before downloading:** the screen said "This needs a one-time download of about 21 MB; after that it works offline." Nothing was fetched until "Download it".
- **Download:** 4.3 s on the Mac's connection (the cached SlimSAM files were deleted first).
- **Prepare one 1200 × 1600 photo** ("Getting the photo ready…"): 1.6 s just after the download; 2.9 s when opened again from the cache, plus 1.2 s to load the tool.
- **One tap:** 95–175 ms, round trip from the screen. One outlier of 0.84 s on the first tap with three points (the GPU compiling for a new size).
- **Mask quality:** one keep tap, overlap 0.70; two keep taps, **0.95**; adding a remove tap on the sheet, 0.95.
- **Done:** the cut-out replaced the main photo, the original stayed ("1 of 2"), the shade was re-guessed (Charcoal), and the toast offered Undo. Undo put the old photo, the old shades and the "Couldn't separate" message back.

In the built app (`npm run preview`, port 4174, a fresh origin with nothing cached):
- The screen stated "about 21 MB" and downloaded on request in **6.7 s** (this included the ONNX runtime, because this origin had never run the cut-out model). The progress line ran to 100 %.
- Afterwards, `transformers-cache` held the two fp16 ONNX files and the configs, and `models` held the runtime `.mjs`/`.wasm`. The SlimSAM worker (`sam.worker-*.js`) is in the service-worker precache.
- **Server stopped:** a fetch to the server failed (unreachable). The app still opened on the fix screen, loaded the tool, prepared the photo, and answered taps (first tap 0.8 s). Three taps found a dark pair of trousers on the floral sheet exactly. **Done saved it offline:** cut-out marked done, a 408 × 1000 cut-out of 8 KB, the 1200 × 1600 original kept, shade Graphite.

## Layout

The fix screen with two points, checked by script and by eye:

| Check | 360 × 745 | 340 × 700 |
|---|---|---|
| Text under 14 px | 0 | 0 |
| Tap targets under 44 px | 0 | 0 |
| Horizontal scroll | none | none |
| Photo's lower edge above the pinned bar | yes | yes (photo ends at 450, controls at 601, bar starts at 627) |

The photo is sized to fit above the controls and the pinned bar (Cancel, Done), so nothing pinned covers it. Undo point and Start again sit under the photo, not in the pinned bar. Points are 44 px circles with a white ring and a dark outer ring, so they show on light and dark photos alike. They are marked + (keep, blue) and − (remove, coral), not by colour alone. Tapping a point takes it away.

## Not verified

- **Phone timing.** Nothing ran on the S23. On WASM q8 (if its WebGPU lacks half floats), preparing a photo took 6–10 s on the Mac, so on a phone it may take longer. The tool's time limit is three minutes before it counts as stuck.
- **Real phone photos.** Tested on synthetic floral sheets with one real sample piece; not on the owner's photos.
- **Aeroplane mode.** As in Build 1, the Mac's own internet stayed on; only the app's server was stopped.
- **Memory.** The fix tool is closed when the screen is left, but its peak memory beside the cut-out model on a phone was not measured.
- **The refusal messages on screen.** The empty and whole-photo refusals are covered by unit tests, not by a walk through the screen.
- The page was opened with the tab hidden for some timings, which can slow GPU work; the numbers above are the slower runs where repeats differed.
