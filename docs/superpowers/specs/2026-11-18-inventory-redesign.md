# Inventory: redesign

Written 18 November 2026 from the owner's reactions on five redesign boards. It replaces section 8 ("The look") of `2026-11-15-inventory-design.md` and changes the parts of sections 6.5 and 6.10 named below. Everything else in that spec still stands: what the app does, its data, and its Later and Out lists.

Lines marked **(my call)** are Claude's choices that the owner hasn't explicitly agreed to. Lines marked **(open)** wait on an answer. Everything else is the owner's decision, made on a board.

## 1. Why

The Shop Window look was well made but too quiet and too clothes-first. The owner asked for colour, delight, animation and a bolder app, and said it had to suit everything they own, not only clothes. In their words: "a general inventory thing… my laptop, power bank, headphones, and other important stuff".

The boards, in order:

| Board | Link | What it settled |
|---|---|---|
| 1 | https://claude.ai/artifact/369Mg2jXv9tPifN6TTz5C3 | Seven worlds. Every themed world was a no ("way too flashy", "hyper specific fashion"). Liked: the item page drenched in its colour, flooding out from the tap, and the "Do I own this?" answer sheet. |
| 2 | https://claude.ai/artifact/Bb79ht1MuGd2sjhKSh9joz | One shared graphite look. The item flood was loved. Places and plain labelled Numbers were liked. "Do I own this?" should be "just a button". |
| 3 | https://claude.ai/artifact/FYokc3E6s3JcXEB7dBpysc | The whole app. Scan button in the header (A), the app opens on Home (C), a thing with no photo takes a colour you pick (A). |
| 4 | https://claude.ai/artifact/TKiXpgwqrvb4UrXJ81CjVG | Item facts as three tiles (A). Home buttons fixed. Edit on the item's colour was loved; search, settings and day one were liked. |
| 5 | https://claude.ai/artifact/7FmbrZY2o3WCiR3Pt5EYEt | The twelve remaining screens. One note, on Sizes (section 5.11). |

The boards are the visual reference. Where this text and a board disagree, this text wins, because it takes in the later rounds.

## 2. The idea

**Each thing's own colour is the interface.** The app is a quiet graphite room. Open a thing and its colour floods the whole screen from where you tapped. Everything else that uses colour (tiles, outfit bands, kind dots, the wish tile) takes it from the owner's things or from their kind. Nothing is coloured just for decoration.

What it refuses: themed worlds (shop windows, rails, dressing rooms, laundry tags), theatre for its own sake, and anything that only makes sense for clothes.

## 3. The system

### 3.1 Colour

- **Ground:** graphite. Page `#101114`, raised surface `#1A1B20`, second surface `#24262C`. Text `#F4F1EB`, quiet text `#BDB8B0`.
- **Chalk** `#F4F1EB` with dark text `#16130F` is the one primary-button style. This replaces the old blue accent. Secondary buttons are outlined in 2 px white at 33%.
- **Item colour:** each thing's colour comes from its shade (`domain/colour.ts`). For full-screen use it is clamped dark enough that chalk text passes 4.5:1. Sample values from the boards: headphones `#34405A`, jeans `#2C55B8`, loafers `#8E3F1F`, floral shirt `#9A2A4C`. Pale things need the clamp most. The board's white tee `#7A7466` (4.12:1) and sneakers `#77736A` (4.19:1) fail, and become about `#6E695C` (4.85:1) once clamped. Secondary text on an item colour is that colour lightened to about 88% lightness (the "tint") **(my call)**.
- **Kind colours** (top-level kinds only):

  | Kind | Colour |
  |---|---|
  | Clothes | `#B23A5E` |
  | Electronics | `#2F63D6` |
  | Home | `#7E52C0` |
  | Tools | `#3D7A22` |
  | Bags and luggage | `#985A0D` (the board's `#A0600F` gave only 4.46:1) |
  | Other | `#59626D` |

  Kind colours are used for dots, icon wells, filter chips, empty-state tiles and Numbers bars. Settings lets the owner change them.
- **No photo:** the owner picks a colour for the thing (board 3, A). Its tile and page then show that colour, with a large icon for its kind and a faint repeating pattern of the same icon.
- **Fit colours keep their jobs only:** tight `#F0B95B`, fits `#7BD3A0`, loose `#8FA3BF`. The board's fit bar used brighter variants; use the existing tokens **(my call)**.
- **Tinted wells:** on an item colour, fields and fact tiles sit in `#00000038`.

### 3.2 Type

- **Display:** Bricolage Grotesque, weight 800, tight tracking (−0.02 to −0.03 em), for titles, names, big numbers and section heads. Add it through `@fontsource-variable/bricolage-grotesque` so it works offline **(my call)**. It replaces Archivo for display.
- **Body:** Atkinson Hyperlegible 400/700, unchanged, including the existing plain-zero digit fix.
- **Real sizes.** The board phones are 288 px wide inside; the S23 is 360. Multiply board sizes by 1.25, then apply the floors from PRODUCT.md:

  | Use | Size | Floor |
  |---|---|---|
  | Body | 17 px | 16 px |
  | Small text, labels, notes, chips | 15 px | never under 14 px |
  | Item name on its page | 46 px | none |
  | Screen titles | 28 px | none |
  | Fact values | 26 px | none |

  The board's 11.5–12 px text maps to 14–15 px. Never ship anything smaller.
- Labels are sentence case at weight 700. The old widely spaced capitals are kept only for small section captions (for example "OR ONE OF YOUR REGULARS").

### 3.3 Shape and layout

- Corner radius: 14 px for tiles and buttons, 12 px for fields, 20–22 px for large panels and sheets.
- Grids are three across. Everything and search results use tiles with the photo on a darkened version of the item colour and the name bottom-left.
- Buttons at least 44 px tall, never wrapping. Two buttons side by side are equal width. On a narrow screen the labels shrink to the 14 px floor before anything wraps.
- Bottom bar: Home · Everything · **+** (chalk, rounded square) · Places · Wishes.

### 3.4 Motion

Motion is wanted, and there is no reduced-motion mode (PRODUCT.md). The boards loop every 8 seconds to demonstrate; **the app plays each motion once, when the event happens.**

- **Signature: the flood.** Tapping a thing grows its colour from the tap point to fill the screen as a `clip-path` circle, over about 0.55 s on `cubic-bezier(.65,0,.2,1)`. The list dims under it. Then the page's content rises in (0.35 s, `cubic-bezier(.16,1,.3,1)`, staggered 40–80 ms). Going back reverses it toward the tile it came from **(my call)**.
- **Rise:** lists and tiles enter with a 14 px rise and fade, staggered.
- **Count changes tick:** a number that changes rolls one step (wears, photos taken, selection count).
- Every screen in section 5 names its own motion. Each one shows what just happened. None plays without a cause.
- Use only `transform`, `opacity` and `clip-path` for motion. Check it stays smooth on the S23.

## 4. Navigation changes (replaces 6.10 "Tabs")

- **The app opens on Home** (board 3, C). Home is the first tab.
- **Everything** replaces the separate Wardrobe and Things tabs: one grid of clothes and things, filtered by kind chips. The Browse component already takes a scope, so this is mostly a new scope plus chips. Keep `/wardrobe` and `/things` working as filtered views, so existing links and back-stacks don't break **(my call)**.
- **Places** becomes a tab. It shows places grouped by where they are, each with its count.
- **"Do I own this?"** is a scan button in the Everything header (board 3, A), not a Home card.
- **The window feature is dropped:** no large "in the window" piece, and no "not in the window" setting on kinds. Remove its code and the setting.

## 5. Screens

Each screen keeps every function and piece of content it has today. Only the look and the motion change.

### 5.1 Home
- **Content:** "What did you wear today?" with the likely outfit and two buttons, "Yes, this" / "Something else". Also the "Glad you bought…?" 1–7 scale, and "On this day".
- **Look:** cards on the graphite page. The likely outfit is shown as tiles on its pieces' colours. The "Glad you bought…" card takes that item's colour, and "On this day" takes the colour of the thing it remembers.
- **Motion:** cards rise in. Tapping a number on the scale fills every dot up to it.

### 5.2 Everything (with search)
- **Look:** a three-across tile grid with kind chips, and a search field plus the scan button in the header.
- **Search** results are the same tiles. Colour chips show a swatch dot. A plain line counts the matches: "7 things match "black" · clothes and electronics".
- **Motion:** tiles rise in a stagger. Tapping a tile starts the flood.

### 5.3 Item page
- **Look:** the whole page is the item colour. It holds the cut-out photo, the name at 46 px, "kind · colour" in tint, and where it lives (pin icon, display type).
- **Facts are three tiles (board 4, A):** Bought / Paid / Owned. Each has an icon and label, a big value (short date such as "Mar '25", "₹8,990", "×1") and a small note ("a guess is fine", "receipt saved").
- **Below the facts:** the serial or other fields in tinted rows, then Move (chalk) and Add a photo (outline).
- **Worn today** ticks the wear count, with Undo in a toast.
- **No photo:** a big kind icon over its pattern, on the colour the owner picked.
- Prices stay hidden while browsing and show here only (PRODUCT.md).
- **Gone:** gone things are hidden from Everything, search and Places. They show only under a "Gone" filter. Opened from there, the page is graphite with "Gone" and its history.

### 5.4 Edit (Details)
- **Look:** the form sits on the item's colour (loved on board 4). Fields are tinted wells, with a 2 px chalk ring on the focused one.
- **Labels and order** stay as today: Name, What is it?, Colour looks like / Change, worn count, When and for how much? (a guess is fine), How does it fit now? (Tight / Fits / Loose as three options), Where does it live?, Let it go, and the details below them.
- **Buttons:** Cancel at top left; Save is a full-width chalk button at the bottom.
- **New things:** while adding something new, the page starts graphite. It takes the colour as soon as a photo or colour is set **(my call)**.

### 5.5 Places, one place, select several
- **Places tab:** places grouped by where they are, each with a count.
- **One place** (board 5): title and "In the study · 4 things". The place is drawn as an open drawer, and its things sit inside as tiles. Rename at top right.
  - **Motion:** the drawer slides open when the page opens.
  - **Empty:** "Nothing here yet" plus the existing hint.
- **Select several:** chosen tiles shrink slightly, get a chalk ring and tick, and the rest dim. The sheet "Move 3 pieces to" rises with place chips, then Edit / Let go / Move (chalk).
  - **Motion:** the ticks pop as tiles are picked, and the sheet rises.

### 5.6 Adding
- **Add (+):** a sheet with the four ways to add, each in its own colour (board 3).
- **Camera:** "Lay it flat" hint, framing brackets, a shutter, and Cancel / Done.
  - After each shot: a short flash, then "Cutting out…" over the item's colour. The cut-out flies into a tray of tiles on their own colours, and "2 taken" ticks to "3 taken".
  - The no-camera message stays.
- **Fix the cut-out:** this sits on the item's colour, with the photo on a checker board.
  - "What a tap does": Keep this part / Remove this part. Taps leave green (+) and red (−) marks, and a removed area fades out.
  - Buttons: Undo point, Start again, Done.
- **Read a receipt:** the photo, with a scan line sweeping down it. Each line it reads is highlighted. The found facts (Name, Paid, Date, Shop) rise below, each with a tick. Buttons: Ignore / Use these.
- **Day one (empty Everything):** "Nothing here yet", a short how-to, and a chalk "Take photos" button. Below it, dashed tiles in the kind colours pulse slowly.

### 5.7 Wearing
- **What you wore (wear log):**
  - **Top:** a day stepper (‹ Today / Wed 18 Nov ›).
  - **Stage:** the pieces stand on vertical bands of their own colours.
  - **The question:** "Same as last Wednesday?" with the pieces named, then Yes, this / Mirror photo.
  - **Below:** "Or one of your regulars" as small colour-band strips, and "Pick pieces one by one".
  - **Motion:** the bands grow up from the floor and the pieces drop in. Logging lands a "Logged" stamp.
- **Outfits list:** regulars shown as colour bands of their pieces (board 3).
- **Outfit page:** the top of the page is vertical bands of the outfit's colours, fading to graphite. It shows the pieces, the name, "Worn 9 times · last on Saturday · Out", the chalk "Wore this today" button, and "Its pieces" as rows.
  - **Motion:** the bands grow down from the top.
- **New outfit:** a tray of slots, "The outfit you are putting together", with a colour strip under it.
  - Each piece you pick lifts into a slot and adds its colour to the strip.
  - Below: kind chips, a piece grid, Name ("For example: Office"), "Where is this worn?", and Save the outfit.

### 5.8 Wishes and the wish form
- **Wishes:** buying a wish fills its tile with colour (board 3). Kept as drawn (owner, 18 Nov).
- **New wish:** a wish tile at the top with a dashed outline. It fills from the bottom with the colour picked.
  - Fields: Name, How soon? (Soon / This year / Some day), Kind and colour, Price ("about is fine"), Shop, Link, and "Is it for someone? Their name".
  - Errors stay as today.

### 5.9 Staples
- Each basic is a row with its photo or kind icon.
- Owned basics show in colour with "You have 3" in fit-green. Missing ones show a dashed tile and "None yet" in amber, which gives a small shake once when the page opens.
- Staples cover things as well as clothes (umbrella, phone charger, torch).

### 5.10 Numbers and Your year
- **Numbers:** plain labelled bars in kind colours (boards 2–3). Every bar has its name and value written on it, with no chart that needs decoding (board 1 feedback).
- **Your year:** one room per slide. Each room's panel is the colour of its most-worn thing, with "Most worn here", the name and the wear count. Under it go three numbers: added, wears, let go.
  - **The last slide:** "The whole year", with the most-used thing and its count as a big number, plus "Spent on new things".
  - **Below the slides:** dots, and "Swipe for the next room".
  - The year view covers things as well as clothes ("most used").

### 5.11 My sizes (changes 6.5)
- **Measured in:** Inches / Centimetres.
- **Brand by brand:** each brand is a row with a lettered badge in a colour.
- **How it all fits now:** a labelled bar of Tight / Fits / Loose with counts.
- **Owner's note on board 5:** one brand must hold **several measurements**, for example shoes and trousers from the same brand. There must also be a place to note that a measurement **needs tailoring**.
  - **Data change:** today `SizeRow` is one value per row. Brand rows become a brand with a list of entries, each with what it covers, a size and an optional note. Add a "needs tailoring" note on the brand entry (for example "Levi's trousers: take in waist to 31"). Write a migration for existing rows. Entries that need tailoring show an amber note on their row.

### 5.12 Settings
- **Backup:** Drive backup with when it was last saved, Restore from a file, Export a spreadsheet, and Trash ("3 things, emptied after 30 days"). Each has an icon in its own coloured square.
- **Kinds and their colours:** each kind with its colour and count. Tapping a kind changes its colour.

## 6. PRODUCT.md changes (to make when the build starts)

- "Clothes first" becomes "clothes and everything else, equally".
- "One accent for the main action" becomes "chalk primary buttons; colour comes from the owner's things and their kinds".
- "Pieces sit on a grey stage" becomes "things sit on graphite; an opened thing floods the screen with its colour".

## 7. Build and finish

- **Order (my call):**
  1. System: tokens, fonts, buttons, tab bar, the flood.
  2. Home, Everything and search, the item page, Edit.
  3. Places, one place, Select several.
  4. Adding: camera, fix, receipt, day one.
  5. Wearing and outfits.
  6. Wishes, Staples, Sizes (with the data change), Numbers, Your year, Settings.
- **Checks:** check every screen in the built app at 360 × 745 and 340 × 700. Look for:
  - text overlapping or clipped;
  - nothing under 14 px;
  - text contrast 4.5:1 or better on every item colour (a test over the sample shades);
  - 44 px touch targets;
  - buttons that never wrap.
- **Finish:** run the impeccable finish review against the direction contract in `.impeccable/surfaces/inventory-app-redesign.md`. Then the documenter writes `DESIGN.md` and `.impeccable/design.json` from the built app.

## 8. Settled on 18 November

1. The tailoring note lives on the brand's entry.
2. The Wishes screen is kept as drawn.
3. The window feature is dropped.
4. Gone things are hidden unless the "Gone" filter is on.
