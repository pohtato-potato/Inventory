# Cut-outs on patterned backgrounds

Measured 15 November 2026 on the Mac (Apple M3), using the real RMBG-1.4 model through the app's own worker (WebGPU fp16) in the dev build. This follows the owner's first S23 test: charcoal chinos photographed on a floral bedsheet with a pillow in frame came out as a tilted rectangle of bedsheet.

## Inputs

- **The owner's photo:** the photo area of the S23 screenshot (`docs/feedback/2026-11-15-s23-piece-chinos.webp`), cropped to 330 × 470.
- **Synthetic busy background:** a 900 × 1200 frame with a dark wine base and 260 saturated six-petal flowers, plus a pale pillow shape. A sample cut-out (`design/inventory-photos.js`) is laid on top, so the true outline is known.
- **Controls:** the same cut-outs on plain grey, off-white and near-black, at normal and tight framing.

## What the raw mask looks like

| Input | Mask ≥ 128 | Mid-grey (33–222) | Kept after cleaning | Box of the kept part | Edge pixels covered | Overlap with the real piece |
|---|---|---|---|---|---|---|
| Owner's photo | 83 % | 0.4 % | 83 % | 99 % of frame | 64 % | n/a |
| Chinos on floral | 78 % | 9.6 % | 79–85 % | 100 % | 41–48 % | 0.24 |
| Jeans on floral | 77 % | 10.5 % | 77 % | 99 % | n/a | 0.23 |
| Leather jacket on floral | 71 % | 27 % | 68 % | n/a | 32 % raw | 0.29 |
| Chinos on plain grey | 19 % | 0.3 % | 19 % | 25 % | 0 % | 1.00 |
| Jacket, tight on grey | 59–60 % | 1 % | 60 % | 94 % | 0–7 % | n/a |

In words: on a busy, saturated background, the model treats most of the sheet as part of the piece. Its average alpha outside the real piece was about 180 of 255; on plain grey it was 0. The mask is solid, not faint, so it looks like a confident cut, and the old check (refuse only under 2 % or over 95 %) let it through.

**Changing the threshold does not help.** Overlap with the real piece was 0.24 at 64, 0.24 at 128 and 0.25 at 200. The model is not unsure about the sheet; it is wrong about it.

**"Fills its own bounding box" (rectangularity) does not separate good from bad.** Plain chinos fill 77 % of their box; failed cut-outs fill 79–83 %.

## The rule chosen (`src/photo/mask.ts`, `cleanMask`)

The photo is kept uncut when any of these hold:
1. **More than 8 % of the raw mask is mid-grey** (the model was unsure). Plain shots: 1 % or less. The jacket on floral: 27 %.
2. **The kept part covers more than 75 % of the frame.** Plain shots, even framed tight: 60 % or less. Failures: 83–85 %.
3. **The kept part runs along more than a quarter of the frame's edge.** A piece laid flat in frame touches at most 7 %. Failures: 41–64 %.
4. As before, the kept part is under 2 % of the frame.

**Result with the real model:**
- The owner's photo was refused.
- 23 of 24 busy-background shots were refused: 12 sample pieces × 2 flower patterns.
- The one busy shot kept was a black leather jacket that the model had separated correctly (overlap 0.94).
- All 48 plain-surface shots were kept: 12 pieces × grey, off-white or near-black × normal or tight framing.

**Not tested:**
- Real phone photos beyond the owner's one screenshot.
- Fur, fringe or sheer fabric, which may have more mid-grey edges and could be refused. If that happens, the photo is kept as taken and Retake is offered, so nothing is lost.
- The S23's WASM q8 model, which may produce different masks.

## Could this model do better on patterned backgrounds?

**Honestly, not by much.**
- **Threshold:** shown above to make no difference.
- **Non-quantised weights:** these measurements already used fp16 on WebGPU, which is not quantised. The S23 runs fp16 too if it has WebGPU with shader-f16; otherwise it uses the q8 WASM model, which could only be worse. Higher precision is not the cause. RMBG-1.4 was trained mostly on product photos against fairly clean backgrounds, and a busy floral sheet looks to it like part of the object.
- **A bigger model:** BiRefNet or RMBG-2.0 might separate better. Neither was tested; both are several times larger to download and slower on a phone. RMBG-2.0's licence is non-commercial, which is fine for a personal app but worth knowing.
- **The practical fix is the photo:** a plain surface. The camera hint now says so, and a failed cut-out says so and offers Retake.

## What a tap-to-fix tool would take (not built)

A "tap the piece" fix needs a promptable segmentation model: SlimSAM or SAM through transformers.js, which take a tapped point and return the object under it.
- **Download:** a second model of roughly 50–100 MB, cached like RMBG.
- **Screen:** the photo full-size. A tap on the piece adds an include point, and a toggle switches taps to exclude. The mask previews live, with Done and Undo point.
- **Wiring:** the result goes through the same `cleanMask` → straighten → compose path, without the patterned-background refusals, since the owner chose it.
- **Size:** about one plan task of the size of Task 7: worker, screen, tests and a phone timing check. The phone timing is the main unknown, because SAM's image encoder is heavy.
