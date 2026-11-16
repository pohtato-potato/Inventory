# Board 4 polish: verification (16 Nov 2026)

Branch `feat/board-4-polish`, cut from `main` at 6f99129. Not pushed; no PR.

Commits:
- e4a7376 docs: look board 4 (the board and its photos)
- b442d0a fix: tall cut-outs fit their tile, the no-spot room, worn regulars, lanes for Ethnic and the roots
- 9e1a2d2 feat: board 4 polish (Home, wear log, wishes, wish page, own, numbers, year, mirror faces, three minors, dev seed)

## Checks

| Check | Result |
|---|---|
| `TZ=UTC npm test` | 37 files, 328 tests pass |
| `npm test` (IST) | 37 files, 328 tests pass |
| `npm run typecheck` | clean |
| `npm run build` | JS 560.41 kB (173.79 kB gzip); precache 23 entries, 2774.28 KiB |
| Audit, 360 × 745, 17 routes | 0 text under 14 px, 0 targets under 44 px, 0 contrast under 4.5:1, no sideways scroll, nothing under the tab bar |
| Audit, 340 × 700, 17 routes | same, all zero |
| Wear log editing, 360 × 745 | the bottom bar starts at 672 px; the last row ends at 649 px |

The 17 routes: Home, wear log (today and a past day), wishes (Now and Soon), three wish pages (open, waiting, bought), "Do I own this?" (white tees and jackets), Numbers (by kind and by shop), the year, Outfits, an outfit page, the wardrobe, and a bought piece.

The first pass at 360 px reported three contrast readings: Home "Monday" 2.69, the year's "Most worn piece" 3.12, and the own-jackets chips 1.76. All three read 0 on a re-run of the same routes. They were taken while the window light was still fading in, so nothing was changed for them.

The dev seed works again: `#/wardrobe?devseed=12` gives 13 items, 53 wears, 4 outfits, 7 wishes and 22 photos, including 3 mirror photos. The bug was that a hash change doesn't reload the page, so the seed is now also read on `hashchange`.

## What changed, by screen

- **Home:** the date numeral sits in a window lit by today's top, with the Numbers link. The log card shows the suggestion as small windows, worded by `suggestWords`, with "Yes, this" and "Something else". Then the glad-you-bought card with seven buttons, the "N pieces need details" row, and "Worn a year ago today" with a small window. The card order is unchanged and nothing was added.
- **Wear log:** the day numeral with Today, back and calendar; the suggestion as one tall Stage (or its mirror photo); "Same as last Monday?" naming the pieces; "Yes, this" and "Mirror photo"; regulars as small stages; "Pick pieces one by one".
- **Wishes:** the header gives the open count, "about ₹N" and a "Do I own this?" link. Then Now / Soon / Someday with counts. The tiles are two across on the light `#D5D2CA` ground, with name, then shop · price · "added 2 Nov". A waiting wish is dimmed and tagged "Waiting until …".
- **Wish page:** a large photo on the light ground; the price numeral with the shop; kind · colour · added; "You own N like this / See", hidden at 0 or when the wish has no kind. Then "Bought" and four secondary buttons.
- **Do I own this?:** a lit window with the count, "white tees already yours" style words, and a line per piece. The "You have none of these" rows sit under it.
- **Numbers:** each bar is made of its pieces' shades (one segment per distinct main shade, deepest first, six at most, faint outline), on By kind, By shop and By brand. The amount sits on the label line. "Best value" is three small windows with cost per wear.
- **Year in review:** one room per screen, with the spot name in spaced capitals, the most worn piece and three numerals, plus a dot pager. The whole-year screen shows the most worn piece with its days, four numerals and the spend total.
- **Mirror faces:** regulars, stages and wear days with a mirror photo show the newest one, cover-cropped and lit by the top's colour. The outfit page has a large photo with the pieces along its bottom edge, "Show the pieces" / "Show the photo", "N mirror photos / Add another", and swipes to older photos.

## Fixes, each with a test that failed first

- a. A very tall cut-out fits inside its tile at any aspect.
- b. The year gets a last room, "No spot yet", when any piece has no spot.
- c. Outfits worn at least once show under "Your regulars"; never-worn ones show under "Saved, not worn yet".
- d. Tops and Bottoms get lanes. Ethnic gains Kurtas (top/over) and Ethnic bottoms (bottom), added on start for existing data. A piece with no lane asks "Where is this worn?" once, the first time it is added to an outfit.
- Minors:
  - Deleted pieces now show dim in lists.
  - The wear log moves to the new day at midnight and when the app comes back to the front.
  - The "gone" label no longer clips under a stage piece.

The mirror-face tests cover the newest photo, no photo, a removed photo (the one before takes its place) and removing an outfit (its photos go with it).

## Rulings

- The Accessories root gets no lane. Its pieces ask where they are worn, because a watch and a bag sit in different places.
- Mirror photos taken on days an outfit was worn count toward that outfit's face, not only photos kept on the outfit.
- The wear log's suggestion also shows its face when it has one.
- "Best value" and "Least value" show three windows each.
- The "You have none of these" hints show on both "Do I own this?" and Wishes.
- The Wishes header no longer shows a wish in a window, as on the board.
- "Move to…" stays a sheet. "Wait until…" opens a sheet with a future day picker.
- The wear log's "Mirror photo" button logs the day first, then attaches the photo to that day.
- `suggestWords`:
  - Home line:
    - worn on two or more of the same weekday → "Your usual for a Monday"
    - worn last week on that day → "What you wore last Monday"
    - a saved outfit → "Your most worn lately"
    - otherwise → "What you wore last time"
  - The wear log's question follows the same reasons, but "Same as last Monday?" comes first.

## Not verified

- On the S23 itself.
- The real camera for mirror photos (only canvas-made photos from the dev seed were used).
- Swiping between photos with a finger (the scroll-snap track was checked by scrolling).
- How the animations look.
