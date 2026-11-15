# Inventory: design

Written 15 November 2026. This replaces the October spec, which was lost with the Windows laptop. It is built from the owner's answers on 14–15 November and the feature board picks (https://claude.ai/artifact/WTJC3hkt83SgEmczL8dzsV).

Lines marked **(my call)** are choices Claude made that the owner has not explicitly agreed to. Everything else is the owner's decision.

## 1. What this is and why

A phone app that holds everything the owner owns, with clothes first. It came back to life because the owner tried to remember which clothes they had and could not.

It is a **reference app**. Health is opened every day; Inventory is opened when there is a question: what do I own, where is it, what goes with what, do I already have one of these, what should I buy.

Success: every fact about owned things and planned buys is in one place, with a proper clothing part.

## 2. Goals, non-goals, anti-goals

**Goals**
- See and recall the whole wardrobe quickly, by kind, colour and place.
- Add 100–300 items in a bulk afternoon without it becoming a chore, then one at a time.
- Put together and save outfits from real pieces at true proportions.
- Know what fits now, as the owner's body changes with training.
- Keep planned buys, and stop duplicate or badly timed buys.

**Non-goals (first version)**
- Packing and trips, the Health measurements link, shuffle, planning outfits on dates, and everything else marked Later on the board (section 12).
- Any link to Logbook. The owner does not use it.
- Tablet or desktop layouts. Imports from other apps.

**Anti-goals**
- Daily logging pressure. Wear logging is for the days the owner feels like it; nothing nags.
- Showing prices of owned things while browsing. Prices live on the item page and the Numbers page only.
- Colour used for decoration. Colour comes from the owner's things, plus one accent for the main action.
- A reduced-motion or battery-saver mode. The owner does not want these in any of their apps.

## 3. Constraints

- **Device:** Samsung S23, installed as a web app. Check every screen at 360 × 745 and 340 × 700. Nothing pinned to the bottom may cover content.
- **Offline:** everything works without internet after the first run, except saving from a shop page and Drive backup.
- **Storage:** all data and photos live on the phone.
- **Stack (my call):** the same as Health: Vite, React, TypeScript, Dexie over IndexedDB, vite-plugin-pwa, Vitest. Repo `pohtato-potato/inventory`, served at `pohtato-potato.github.io/inventory/`.
- **Legibility:** no accessibility features were asked for. Keep a quiet baseline anyway: body text 16 px or larger, nothing below 14 px, text contrast 4.5:1 or better, no thin or handwriting fonts, touch targets 44 px.
- **Money:** ₹ by default, with a currency per item.
- **Scale:** 100–300 items. Lists need no paging tricks, but photos must be stored small (section 6).

## 4. Approaches

Three ways to build were considered.

- **One build of everything, then one review.** Simple to run, but the owner could not start photographing until all 67 features were done, and the outfit builder would be judged on stock photos.
- **Two builds (chosen).** Build 1 is the catalogue. The owner starts adding pieces while Build 2 (outfits, wearing, wishes, numbers) is made. Each build gets one full review at its end. The builder's proportions are then tuned on the owner's real pieces.
- **Many small releases.** Rejected: the owner prefers to build everything and review once, not review at every stage.

## 5. The two builds

### Build 1: the catalogue

| Area | Features |
|---|---|
| Wardrobe | Photo grid; counts by kind; kinds tree; colour tree; grid, list and by-colour views with sorting; search and saved searches; count per entry (×N); copy a piece; piece page; basic details; extra photos and close-ups; condition; starting wears; accessories; tags |
| Adding | Camera-first conveyor with "needs details"; burst capture; cut-out on the phone; flat-lay polish; batch edit; fields by kind; read receipts; read order screenshots |
| Fit | My sizes; fit now; fit notes |
| Places | Places; usual place and where it is now; move many; browse by place; throw to a place |
| Other belongings | Things that are not clothes; item history |
| Letting go | Gone, with history |
| App | Offline install; backup; export; trash; undo; select many; motion |

### Build 2: using it

| Area | Features |
|---|---|
| Outfits | Saved outfits; builder with regulars on top and pieces below; true proportions; pairs well with; dress codes; layer lanes; mirror selfies |
| Wearing | Quick wear log; last worn and times worn; cost per wear |
| Wishes | Wish-list board; do I already own this?; wait to buy until; save from a shop; wish from a photo; gap hints; 30 wears question; glad you bought it? |
| Numbers | Numbers page; spend breakdown; best and worst value; favourite brands; on this day; item anniversaries; year in review |
| App | Home page |

## 6. How the main parts behave

### 6.1 Items

One record type covers clothes and everything else. A kind decides whether an item is clothing and which fields it shows.

Fields: name, kind, main colour, second colour, count (×N), brand, size, bought on, shop, price and currency, condition (new, good, worn, needs replacing), starting wears, fit (tight, fits, loose) and a fit note, tags, usual places (up to three), where it is now, status (owned or gone), main photo, extra photos, close-up spots, a "needs details" flag.

- **Variants are out.** A tee in another colour is a different item. "Copy a piece" makes a new item from an existing one.
- **Count per entry** is for bulk buys such as socks ×4. Splitting a count across places is Later **(my call)**.
- **Gone:** status, date, how (sold, donated, given, thrown away), and optionally who and how much. The item stays on record and leaves the normal views.

### 6.2 Kinds and colours are trees, and items show at every level

- **Kinds:** a starter tree the owner can edit (for example Tops → Tees, Shirts, Knitwear). A tee is listed under Tees and under Tops, and counted in both.
- **Colours:** about 12 families and 60 shades, weighted toward deep colours. Red holds burgundy, maroon, oxblood, wine, crimson; blue holds navy, midnight, ink, and so on. The owner can add and rename shades. Filtering by a family shows every shade under it.
- The app guesses the main and second shade (colour only; the kind defaults to the last one used, since nothing on the phone can recognise a garment's kind) from the cut-out's pixels and the owner corrects it in one tap. Near-identical shades in one photo (three close blacks) are merged before guessing.
- **Counts by kind** sit at the top of the wardrobe ("14 tees · 5 jeans · 3 jackets"). Each count opens that group.

### 6.3 Adding

- **Conveyor:** the camera opens first. Shoot piece after piece, in bursts if wanted; each becomes an item flagged "needs details". Details are filled later, one by one or with batch edit.
- **Photos:** the owner photographs each garment flat, whole, one per photo.
- **Cut-out:** done on the phone with the RMBG-1.4 model through transformers.js. The model is fetched from Hugging Face on first run and cached; it is never bundled in the repo. After the model: threshold, open, fill holes from outside, keep the piece at the centre, slight blur.
- **Flat-lay polish:** straighten the cut-out and give it a soft shadow.
- **A bad cut-out:** retake, keep the uncut photo, or fix it by tapping.
- **Tap to fix:** a second, promptable model (SlimSAM, `Xenova/slimsam-77-uniform`, through transformers.js) finds the piece from the owner's taps. It is fetched from Hugging Face only when the fix screen is first opened, after the screen states its size (about 21 MB with WebGPU, about 14 MB without), and is cached for offline use; it is never bundled. The screen shows the photo as taken at full size; a tap adds a keep point, a Keep/Remove switch makes taps remove instead, and the found piece previews as a tint. Undo point, Start again, Done and Cancel. Offered on the "Couldn't separate this piece" message (beside Retake and Keep as it is) and in a piece's Edit, for any piece. The result goes through the same clean, straighten and crop as any cut-out, without the busy-background refusals, since the owner chose it; an empty or whole-photo result is refused with a plain message. Saving replaces the cut-out, keeps the original, re-guesses the shades, and is one step for Undo. The brush for painting a cut-out by hand is still Later.
- **Storage:** original and cut-out saved as WebP, long edge about 1600 px for the original and 1000 px for the cut-out **(my call)**.
- **Receipts and order screenshots:** text is read on the phone and offered as a best guess for shop, date, price, name and size. The owner confirms or edits every value. Nothing is saved unread. The reader is loaded only when used.
- **Price and date on the details step:** the details screen offers "when bought" and "price", each of which can be an estimate (a year or month, a rough amount). Estimates are marked as such and flow into cost per wear as "about".
- **Starting wears:** when adding something already owned, pick a range (never, 1–5, 5–20, 20–50, 50+) or type an exact number. Wear-log entries add on top.

### 6.4 Places

Settled on Look Board 3: **two levels**. Each home holds a flat list of spots the owner names ("Cupboard, left rail"), and "with me" is a fixed third group. A spot is shown as a shelf: its count, its name, and a few of the pieces standing on it. Free nesting was rejected.

An item has up to three usual spots and one current spot; many items can be moved at once; a spot page lists what is in it; an item can be flicked toward a spot to move it. Store spots with a pointer to their home.

### 6.5 Fit and sizes

- **My sizes:** one page laid out like a tailor's book, with body measurements and the owner's size per brand. Typed in by hand in the first version; the Health link is Later.
- **Fit now:** each piece is tight, fits or loose. The wardrobe can be filtered to what fits today.

### 6.6 Outfits (Build 2)

- The owner picks outfits two ways: starting from one piece they feel like wearing, or repeating a few known combinations. The builder shows **regulars on top** (saved outfits, most worn first) and **pieces below**. Tapping pieces composes an outfit head to toe; saving it makes a regular.
- **True proportions:** each kind has a default scale and each item can be adjusted, so shoes are smaller than jeans. Bracelets and rings sit at wrists and hands; other accessories at their real positions.
- **Layer lanes:** under and over layers (tee under shirt, jacket over).
- **Pairs well with** links two pieces. **Dress codes** tag pieces and outfits (formal, smart casual, ethnic, gym, lounge, and the owner's own).
- **Mirror selfie:** a photo of the owner wearing it, kept on the outfit or on a wear entry.
- Later: start-from-a-piece flow, change one piece, shuffle with locks, never together, weather filter, planning on dates.

### 6.7 Wearing (Build 2)

- **Quick wear log:** opens prefilled with the most likely outfit (the most worn regulars and recently worn pieces) and is confirmed in a few taps. Any day can be logged or edited later.
- Each piece shows last worn and times worn (starting wears plus logged wears).
- **Cost per wear** = price ÷ wears, shown on the piece page only, never per outfit. From a range it uses the middle of the range and says "about"; from "50+" it says "under ₹X".

### 6.8 Wishes (Build 2)

- An image board with three tiers: now, soon, someday.
- **Add a wish** by sharing a product page into the app (Android share target), from a photo taken in a shop, or by hand.
- **Wait to buy until:** a date or a line of text ("when my waist is under 32"). Waiting wishes are dimmed until the owner clears the wait.
- **Do I already own this?** Pick a kind and a colour and see matching pieces. Reachable from the wish-list and from the add button.
- **Gap hints:** suggested wishes for kinds the owner has none of, from a short starter checklist the owner can edit **(my call on the mechanism)**.
- **Bought:** turns a wish into an item. For clothes it first asks the 30 wears question. Thirty days later Home asks "glad you bought it?" on the 1–7 scale. Keeping the wish's price history on the item is Later.

### 6.9 Numbers and Home (Build 2)

- **Numbers:** counts by kind and place, total spend, spend by kind, shop and brand, best and worst cost per wear, the brands owned most.
- **Year in review:** late December, the year shown as rooms.
- **Home:** items that need details, "glad you bought it?" checks, on this day, item anniversaries, recently added.
- The app **opens on the wardrobe**. Home is a tab.

### 6.10 App-wide

- **Tabs (shown on Look Board 3 and liked):** Wardrobe · Things · + · Wishes · Home. Places are reached through a "browse by" switch (kind, colour, place) on Wardrobe and Things. In Build 1 the Wishes and Home tabs are absent.
- **Trash:** deleted items are kept 30 days. **Undo** on every action. **Select many** on every list.
- **Export:** a spreadsheet (CSV) and a full backup file with photos.
- **Backup to Drive:** incremental, photos included. The Google sign-in has never been tested for this app. If it cannot be made to work in Build 1, the fallback is the full backup file saved to Drive through the share sheet, and the owner is told **(my call)**.
- **Motion:** numbers roll, pieces move with weight, a flicked piece travels to its place. Take the good motion habits from Health.

## 7. Data

Dexie tables **(my call)**: `items`, `kinds`, `colours`, `places`, `photos` (blobs), `events` (item history: added, edited, moved, worn, gone), `outfits`, `wears`, `wishes`, `sizes`, `settings`. Deletion sets `deletedAt`; a sweep removes rows older than 30 days. Shape every record with an id and `updatedAt` so sync could be added later.

## 8. The look

Settled: **Shop Window** (Look Boards 2 and 3; reference `design/inventory-look-board-3.html`, https://claude.ai/artifact/FmATEZXU89y1ZHMPzphwkW).

- A near-black app. Every piece stands in a "window": a dark panel lit from behind by a soft pool of that piece's own colour, with a darker floor. The windows light up when a screen opens, and counts roll up.
- **In the window:** Wardrobe and Things open with one piece shown large, with the reason it was picked: not worn lately, just added, or a random favourite. An item, or a whole kind such as socks, can be marked "don't show in the window".
- Type: condensed medium-weight numerals (never thin), widely spaced capitals for labels, a plain legible sans for everything else.
- Colour: only from the owner's things, plus one blue for the main action. Green, amber and blue-grey are used only for fit.
- Grids are three across.
- By colour: each family is a lit window; the open one shows its shades, deepest first.
- A piece that is gone: the light goes out, it is stamped "Gone", and its story stays.
- Built screens are compared side by side with the board at 360 px before review.

## 9. Testing and review

- Unit tests for logic: tree counts at every level, nearest-shade matching and merging, cost per wear from exact and ranged wears, gap hints, trash sweep, backup round trip.
- Check the built app, not only the dev server, at both S23 sizes.
- One full review at the end of each build. No per-task reviews.
- Design happens in this chat; coding runs in a forked chat on Opus.

## 10. Left to the builder

File layout, component breakdown, the exact starter kinds and shade lists (the owner can edit both), the on-phone text reader, the straightening method, and the test split.

## 11. Open

1. Drive sign-in for backup: needs a test early in Build 1.
2. Cut-out speed on the S23: never measured. Test early in Build 1; the laptop took about 7 seconds per photo.

## 12. Later and out

**Later:** a brush for painting cut-outs by hand (tap to fix is built, 6.3); say-it search; wardrobe palette; care symbols; photo check; duplicate hint; barcode scan; Health measurements link; fit re-check; size history; will fit again; other people's sizes; start from a piece; change one piece; shuffle with locks; never together; weather filter; plan outfits on dates; outfit notes; capsule builder; lookbook; compare two looks; not-worn nudges; wear next; wardrobe in use; repairs and tailoring; season swap; upkeep schedules; place codes; place photos; can't find it; lost or stolen; recently moved; the locker; item story; memory box; receipts, warranty and return windows; documents with expiry; manuals; expiry on anything; subscriptions; sets and parts; running low; lent, borrowed and gifts; lending history; price log and target price; wish history on the item; gift ideas; alternatives; cooling-off; wishes by shop; sharing a wish-list; all packing and trips; let-go flag; declutter session; coming up; low-space warning; share a card; your own fields.

**Out:** variants; first load from the Mac; in the wash; dry-cleaner; QR labels; thank-you flag; Logbook links; physical media; voice add; rating outfits; shoe distance; repair costs; batteries and cables; value now and insurance list; returns and claims in progress; vehicles, spares and shared ownership; stocktake; moving house; spot on a shelf photo; gifts given per person and gift dates; one in, one out; budget and sale seasons; bag weight; selling, donations and "miss it?"; owned over time; app lock and hide prices; comparing wishes.
