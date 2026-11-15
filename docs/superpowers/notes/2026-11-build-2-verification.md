# Build 2 verification

Run 15 November 2026 on branch `feat/build-2` by Claude (Opus 5.5) in the Claude desktop app.

**Environment:** MacBook (Apple M3), macOS 27, Node 26, local time zone IST. Browser checks ran in the desktop app's built-in Chromium pane, with the viewport emulated at 360 × 745 and 340 × 700. The pane was hidden for most of the run. **Nothing here ran on the Samsung S23.**

## Automated checks (step 1)

| Command | Result |
|---|---|
| `TZ=UTC npm test` | 33 files, 296 tests passed |
| `npm test` (IST) | 33 files, 296 tests passed |
| `npm run typecheck` | no errors |
| `npm run build` | built. The service worker precaches 23 files (2,756.6 KiB; Build 1's note said 1,793.5 KiB, and the tap-to-fix worker came in between). Main script 546.6 KB (169.9 KB gzip). CSS 26.6 KB. |
| `dist/manifest.webmanifest` | holds `share_target`: `{"action":"./","method":"GET","params":{"title":"title","text":"text","url":"url"}}` |

The migration tests (`tests/migrate.test.ts`) write a version 1 database with the **Build 1 code itself**, frozen from `4f49307` in `tests/fixtures/build1/`. It holds 3 pieces, 5 photos, 3 worn events and an owner's own kind. The tests then open that database with the current code and restore a Build 1 backup file into it. Nothing is lost, and the worn events become wear days.

## Layout and legibility (step 2)

Audited in the **built preview** (`npm run preview`, port 4174) with a script run in the page. It checks every visible text node and every button, link and input on the whole page, not just the first screen.

**Data:** a backup made by the Build 1 code (12 pieces with photos, one let go, a week of wears; see step 4), plus 4 wishes (one bought 45 days ago, one waiting, one for someone) and 2 outfits.

**Screens (19):**
- Wardrobe, Outfits, an outfit page.
- The wear log, for today and for a past day.
- Wishes: Now and Soon.
- An open wish and a bought wish.
- The new-wish form.
- Do I already own this? (prefilled).
- Numbers, Home and the year in review.
- Pieces: owned, bought from a wish (glad answer) and gone.
- Edit details, with the outfit size control.
- Settings, with staples and lanes.

**Sheets (4):** add a wish, "Will you wear it 30 times?", Bought, and Move to….

The empty state of every new screen was audited too, at 360 px.

| Check | 360 × 745 | 340 × 700 |
|---|---|---|
| Text under 14 px | 0 | 0 |
| Tap targets under 44 px | 0 (after fix 2) | 0 (after fix 2) |
| Text contrast under 4.5:1, including text over lit windows | 0 (after fix 1) | 0 |
| Horizontal scroll | none | none |
| Content under the tab bar or a bottom bar, scrolled to the end | none | none |

**How contrast over a lit window was measured.** The script reads each window's light from its stylesheet: the radial glow's position, size, fade and opacity, the light colour, and the dark band along the bottom. It computes that light at the lightest and the darkest point of each text's box. Each text must reach 4.5:1 against both points. This is a model of the CSS gradient, not a reading of rendered pixels. Disabled buttons are exempt, as WCAG allows.

**Fixed during the audit:**
1. **Wishes header.** With a white wish in the window, "on the list" measured 2.80:1 and "In the window" 4.44:1. The glow was centred behind the words. The wish stands on the right, so its window's light now sits behind it (at 76 % across instead of 50 %). Both now pass.
2. **Glad card at 340 px.** The seven 1–7 buttons were 43.9 px wide. The card now uses a little more of the width; each button is 45.1 px.

The audit first flagged Home's last row as under the tab bar. It was a tall cut-out overflowing its tile, clipped by the tile itself, so nothing was really covered (see "Found while verifying"). The script now accounts for the clipping.

### Outfits against the approved board

Compared at 360 px with "Outfits (second build)" in `design/inventory-look-board-3.html`.
- **Matches the board:** the regulars row of tall lit windows, "Worn N times" under each, and "or start from a piece".
- **Differs from the board:**
  - A **Pieces / Outfits switch** under the header (my call).
  - **Chips by lane** (All, Tops, Bottoms, Shoes, Accessories) over the piece grid.
  - The grid is **three across with names**, as the plan says; the board drew four across without names.
  - **Save is on the builder**, which sticks to the top while you pick, rather than in the header.
  - The board's header has no switch.
- **The regulars windows are lit.** Measured: opacity 0.9, coloured by the lit piece, e.g. `#81765E` for a white tee. Lit by a black jacket, a window is dim by design.

### Components with no board (look at these first)

Built from the Shop Window kit (Window, Piece, Tile, Seg, Chips, Sheet, Numeral, `.li` rows, `.acc` / `.ghost` / `.link`). These are new:
1. **Wish tile:** a two-across tile, taller (4:5), with the shop's photo uncut, and name, shop and price under it. With no photo, the wish's name is set large in an unlit window. Waiting wishes are dimmed, with "Waiting until 1 Dec" or the note.
2. **Wish page:** the actions stacked full width. "Bought" is blue; then "Open the shop page", "Do I already own this?", "Move to…", "Not any more".
3. **Gap hints:** "You have none of these" rows, each with two blue links ("Add to wishes", "Not for me").
4. **Bar rows on Numbers:** label, amount, and a thin blue bar under each.
5. **Large money totals on Numbers:** one per currency, with a small "about" when any price is a guess.
6. **Value tiles:** the wardrobe tile with "₹70 a wear" under it.
7. **Home cards:**
   - A rounded pane holding "What did you wear today?" with a small stage, "Log it" (blue) and "Something else".
   - A card row with a numeral: "7 pieces need details".
   - "On this day" lines and anniversary lines.
8. **Glad card:** the piece in a small window, and a **segmented 1–7 scale** with "not at all" and "very" under its ends.
9. **Year in review:** full-width slides swiped sideways (scroll snap), each a tall lit window with the room's most worn piece, then three numerals. "1 of 5" sits in the header and a hint line sits at the foot.
10. **Home header:** the date as the large numeral, with the weekday and the month under it, and a "Numbers" link.
11. **Wear log** (Task 5):
    - the day header: a large day numeral, Today or Yesterday, the long date, ‹ › and a calendar;
    - the "Logged" card;
    - the mirror-photo strip.

## Sharing in (step 3, Review Focus 3)

In the built preview, `./?title=Linen%20Shirt&url=https%3A%2F%2Fwww.myntra.com%2Fx` opened the new-wish form prefilled: name "Linen Shirt", shop "Myntra", link `https://www.myntra.com/x`. The address became `#/wish-new?…` with **no query left** (`location.search` empty).

**Server stopped**, the same address reloaded:
- A fetch to the server failed ("Failed to fetch").
- The form still opened prefilled the same way, and the query was cleared.

**Sharing from the Myntra app itself can only be checked on the installed phone app.** Android lists a web app as a share target only once it is installed from Chrome.

Unit tests cover:
- a link inside the shared text;
- a share with no link;
- `javascript:` and `data:` links (dropped);
- the shop named from the host (Myntra, Amazon, Ajio, else the host's first label).

## Restoring a Build 1 backup (step 4, Review Focus 1)

The backup was made by the **Build 1 code** (the frozen copy of `4f49307`, the deployed version) under Node: 12 pieces with real photos (the look board's samples), one piece let go, and a week of wears recorded the Build 1 way, as 21 worn events. The `.zip` was 169,672 bytes. It was restored into the built preview through **Settings › Restore from a file** (the file handed to the app's own file input, then "Replace" confirmed).

The app said "Restored 12 pieces and 12 photos." In the database afterwards:
- 12 pieces, 1 of them gone;
- 12 photos, 163,210 bytes;
- 21 worn events kept;
- **7 wear days**, of 3 pieces each (8 to 14 November);
- outfit lanes on the 16 starter kinds that have one.

**Not done:** a backup saved by hand from the live site on the phone. The file came from the same code run under Node, not from the deployed page in a browser.

## Three states (step 5)

- **Nothing at all** (built preview, empty database). Each screen reads sensibly:
  - Wishes: "0 on the list · Nothing wished for yet · Add a wish". Each tier says "Share a product from a shop app, or tap + to add a wish."
  - Home: the date, and "What did you wear today?" with "Log it".
  - Numbers: each section says what would fill it ("Add prices to your pieces…", "Log a few wears to see best and worst value.", "Add brands…").
  - Year: one slide, "No wears logged this year".
  - Outfits: "Add a few pieces first, then put them together here."
  - Wear log: "Add a few pieces first; then log what you wore here."
- **A dozen pieces with a week of wears:** the restored Build 1 backup above; every screen was audited.
- **300 pieces with a year of wears** (dev server, `?devseed=300`):
  - 290 wear days over the last 365 days, 3 pieces a day; 8 outfits; 40 wishes, 4 of them bought.
  - Time from changing the address to the screen filled: Home 65 ms, Numbers 210 ms, Wishes 237 ms, Outfits 131 ms, wear log 275 ms, year in review 40 ms, Do I already own this? 45 ms, Wardrobe 96 ms. These are dev-server times on the Mac, not the phone.
  - The year in review's numbers agree with the data. Home: 225 pieces added and 500 wears, which is its three spots' 128 + 171 + 201. The whole year: 299 added, 260 days logged, spend ₹7,44,211.

## Not verified

- **Anything on the S23:** speed, touch, the share sheet, installed-app behaviour.
- **Sharing from a shop app** (Myntra, Amazon, Ajio) into the installed app.
- **Motion:** the numerals rolling up and the windows lighting. The pane was hidden, which pauses animation frames, so numerals read 0 mid-roll in scripted checks. Their final values were checked against the data instead.
- **Aeroplane mode:** only the app's server was stopped; the Mac stayed online.
- **The camera:** blocked in the pane. Mirror photos and "Photo from a shop" were not tried with real files from a phone.
- **Contrast against photo pixels:** the audit models window light, not the photos inside windows. Text was kept off the photos: hero words sit left of the picture.
- **Drive backup:** unchanged from Build 1 and still not run.

## Found while verifying (not fixed; outside Build 2's tasks)

- **Tall cut-outs overflow a tile** (Build 1's Tile). A very tall cut-out (the sample cargo trousers, 151 × 420) is drawn taller than its tile and cropped top and bottom by the window. `max-height: 80%` does not resolve inside the aspect-ratio box.
- **The year in review's rooms leave out pieces with no spot.** Their wears count in the year's totals, but no room shows them. With the 300 seed, 280 of 780 piece-wears belonged to pieces with no spot.
- **"Your regulars" lists every saved outfit,** even ones worn 0 times, most worn first.
- **Wardrobe's own window has the same contrast risk** that the Wishes header had. It is Build 1's design: text on the left, glow centred. It passed with this data, but a white piece in the window may push "pieces" under 4.5:1. Not changed: it is Build 1's approved look.

## Final review and fixes

One full review of `4f49307..27989a7` (Opus): **ready to merge with fixes**, 0 Critical, 3 Important, 9 Minor. The reviewer ran the suite in five time zones (all 296 passed). The three Important findings are fixed, each with a test that failed first:
1. **A wear could be logged for a piece let go or deleted**, through a saved outfit ("Wore this today") or "Same as last time?". Only owned pieces are now added to a day; a piece already on a past day stays; the outfit is dropped from the wear when any of its pieces were. The wear log's suggestion leaves such pieces out, as Home's did.
2. **Saving an outfit already saved** showed "Outfit saved" with an Undo that undid the step before. It now says "You already have this outfit", with no Undo.
3. **A double tap on "Add to my things"** made two pieces. The wish is checked again inside the save, and the button waits.

After the fixes: `TZ=UTC npm test` and `npm test` 33 files, **301 tests passed**; typecheck clean; build fine (precache 2,757.5 KiB). The layout audit was not re-run; the only visible change is the Bought button greying while it saves, and two toast texts.

The 9 Minor findings are listed in `progress.md` as deferred. The one to settle first: **Ethnic has no outfit lane**, so ethnic pieces stand at the side of an outfit.
