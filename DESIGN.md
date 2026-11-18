---
name: Inventory
description: Everything one person owns, on a graphite page where each thing's own colour is the interface.
colors:
  graphite: "#101114"
  pane: "#1A1B20"
  pane-2: "#24262C"
  chalk: "#F4F1EB"
  ink: "#16130F"
  quiet: "#BDB8B0"
  line: "#2C2E35"
  edge: "#FFFFFF54"
  well: "#00000038"
  fit-fits: "#7BD3A0"
  fit-tight: "#F0B95B"
  fit-loose: "#8FA3BF"
  kind-clothes: "#B23A5E"
  kind-electronics: "#2F63D6"
  kind-home: "#7E52C0"
  kind-tools: "#3D7A22"
  kind-bags: "#985A0D"
  kind-other: "#59626D"
typography:
  display:
    fontFamily: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  numeral:
    fontFamily: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  body:
    fontFamily: "'Body digits', 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
  body-small:
    fontFamily: "'Body digits', 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.3
  label:
    fontFamily: "'Body digits', 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
  caption:
    fontFamily: "'Body digits', 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.12em"
rounded:
  inner: "10px"
  field: "12px"
  tile: "14px"
  panel: "18px"
  card: "20px"
  sheet: "22px"
  pill: "22px"
spacing:
  hair: "4px"
  tight: "8px"
  row: "12px"
  gutter: "14px"
  edge: "18px"
components:
  button-primary:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    typography: "{typography.label}"
    rounded: "{rounded.tile}"
    padding: "0 16px"
    height: "48px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  field:
    backgroundColor: "{colors.pane-2}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 14px"
    height: "48px"
  field-on-colour:
    backgroundColor: "{colors.well}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.field}"
  segmented:
    backgroundColor: "{colors.pane-2}"
    rounded: "{rounded.tile}"
    padding: "4px"
  segmented-on:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    height: "44px"
  card:
    backgroundColor: "{colors.pane}"
    rounded: "{rounded.card}"
    padding: "16px"
  sheet:
    backgroundColor: "{colors.pane}"
    rounded: "{rounded.sheet}"
    padding: "18px"
  tab-bar:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.quiet}"
    typography: "{typography.body-small}"
    height: "68px"
  tab-plus:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    size: "48px"
  toast:
    backgroundColor: "{colors.chalk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    height: "52px"
---

# Design System: Inventory

## Overview

**Creative North Star: "The Shade Card"**

A quiet graphite room where the owner's things supply all the colour. Lists sit on near-black; opening a thing floods the whole screen with that thing's colour from the point of the tap, and its page rises in on it. Colour always means something: it is a thing's own shade, its kind, or (for sizes only) how it fits. Nothing is coloured for decoration.

The type is big and confident: Bricolage Grotesque at weight 800 for names, titles and numbers, Atkinson Hyperlegible for everything you read. The layout is a phone in one hand: three-across tiles, rows at least 56px tall, buttons at least 48px, and a fixed tab bar with a chalk plus in the middle. Motion is wanted and every motion has a cause: it shows what just happened, then stops.

It refuses themed worlds (shop windows, rails, dressing rooms, laundry tags), clothes-only metaphors, and the flat grey catalogue with one blue accent.

**Key Characteristics:**
- Graphite ground, chalk text, chalk as the one primary button.
- A thing's colour fills whole pages, clamped so chalk text always reads.
- Six kind colours for dots, icon wells, chips, empty tiles and bars.
- Display 800 for names and numbers; nothing under 14px.
- Each motion plays once, on its event.

## Colors

A dark neutral room whose only colour comes from the owner's things, their kinds, and three fit signals.

### Primary
- **Chalk** (`chalk`): all text on dark, the one primary button, selected chips and segments, the tab-bar plus, toasts, focus rings. Text on chalk is **Ink** (`ink`), 16.4:1.

### Secondary: the six kind colours
- **Clothes** (`kind-clothes`), **Electronics** (`kind-electronics`), **Home** (`kind-home`), **Tools** (`kind-tools`), **Bags and luggage** (`kind-bags`), **Other** (`kind-other`): one per top-level kind group. Used on kind dots, icon wells, filter chips, dashed day-one tiles, Numbers bars and the settings icon squares. The add sheet borrows Electronics, Home and Bags to tell its three non-photo ways apart (owner-approved, board 3).
- The owner can recolour a kind in Settings, but only from a fixed palette of twelve (the six plus `#A8324A`, `#1F7A78`, `#8E3F1F`, `#5B4FB0`, `#2E6E4E`, `#7A5A18`). Every palette colour carries chalk text at 4.5:1 or better (lowest: `#1F7A78` at 4.53:1; Tools 4.65:1, Electronics 4.81:1).

### Tertiary: fit signals
- **Fits** (`fit-fits`), **Tight** (`fit-tight`), **Loose** (`fit-loose`): only for how something fits, on sizes, fit chips and the fit bar. Tight's amber also marks "needs tailoring" and "None yet". On graphite: 10.5:1, 10.6:1, 7.3:1. When filled, they carry Ink text.

### Neutral
- **Graphite** (`graphite`): the page, the tab bar and the bottom action bar.
- **Pane** (`pane`): cards, sheets, Numbers bar tracks.
- **Pane 2** (`pane-2`): fields, segmented track, boxed icon buttons, empty tiles.
- **Quiet** (`quiet`): secondary text. 9.6:1 on graphite, 8.7:1 on pane, 7.7:1 on pane 2.
- **Line** (`line`): 1px row dividers and the top edge of fixed bars.
- **Edge** (`edge`, white at 33%): 2px outlines on ghost buttons and chips.
- **Well** (`well`, black at 22%): fields, fact tiles and segmented tracks on an item colour.

### Item colours (computed, not tokens)
Each thing's colour comes from its shade and is processed in `domain/colour.ts` before it touches the screen:
- **Page colour** (`itemColour`): near-black colours (HSL lightness under 16%) are lifted to 16% lightness with saturation capped at 50%, so a black thing still reads as a colour; then the colour is darkened in 1% steps until chalk reads on it at 4.5:1 or better.
- **Tint** (`tintOf`): quiet text on an item colour. The page colour's hue at 88% lightness, saturation capped at 45%, raised until it reads at 4.5:1 on the page colour. It replaces Quiet on coloured pages.
- **Tile ground** (`tileColour`): the page colour at 72% brightness, so a photo and its name stand out in a grid.
- Unknown colour falls back to Other's grey; a gone thing's tile is greyscale at 70% brightness.

### Named Rules
**The Own Colour Rule.** Every colour on screen belongs to a thing, a kind, or a fit. If you cannot say whose colour it is, it is chalk or graphite.

**The Clamp Rule.** A thing's colour never fills a surface raw. It goes through the page clamp (or the tile darken) first, so chalk text reads at 4.5:1 on every shade the owner can have.

**The Fit-Only Rule.** Green, amber and blue-grey mean fits, tight and loose. They do not decorate, and they do not stand in for success or warning elsewhere, except amber for "needs tailoring", "None yet" and field errors.

## Typography

**Display Font:** Bricolage Grotesque Variable (with Helvetica Neue, Arial)
**Body Font:** Atkinson Hyperlegible 400/700 (with Verdana, system-ui), its slashed zero swapped for Archivo's plain digits via a "Body digits" face limited to 0-9.

**Character:** a chunky, slightly quirky grotesque at 800 for anything you glance at, over a face built for reading at a distance for anything you read.

### Hierarchy
- **Display** (800, 46px, 0.98): a thing's name on its own page, and big wear counts.
- **Numeral** (800, 34-74px, 0.9, tabular, -0.03em): counts and totals. Everything's count is 68px, Numbers' totals 72px, Home stats 40px, fact values 26px (shrinking to 22 and 19px when long).
- **Headline** (800, 28px, 1.1): screen titles. One line, ellipsis.
- **Title** (800, 20-24px, 1.05): section heads (22px), sheet titles (24px), place names and day cards (20px).
- **Body** (400, 17px, 1.45): running text, fields, rows.
- **Body small** (400/700, 15px): chips, tabs, notes, segmented options, secondary lines.
- **Label** (700, 16px): button and link text, one line, never wraps.
- **Caption** (700, 14px, 0.12em, uppercase, Quiet): short section captions only, such as "Your regulars" or "Backup". Tile names, fact labels and fact notes are 14px in sentence case.

### Named Rules
**The 14px Floor Rule.** No text renders under 14px, on any screen width. On screens 350px wide or less, button labels drop from 16 to 15px and tab labels from 15 to 14px before anything wraps.

**The Sentence-Case Rule.** Labels are sentence case at 700. Spaced capitals are kept only for small section captions, and a caption is the section's own heading, never a tag above another heading.

## Layout

A single phone column, checked at 360 x 745 and 340 x 700. Content sits 14px from the screen edge for grids, cards and button rows, 18px for text, row content and section heads. Grids are three across with an 8px gap. Two or three buttons side by side are equal-width grid columns with 8px gaps. Spacing runs on 4 / 8 / 12 / 14 / 18px, with 8px the most common gap.

Fixed chrome: a 68px tab bar (plus the safe area) at the bottom of every main screen; screens pad their bottom by the bar height plus 24px. Edit and form screens replace it with a bottom action bar on graphite (or on the page's colour) with a 1px line above. Screen headers are at least 60px tall with the title left and icon buttons right.

Lists are rows at least 56px tall with a 1px line above each; settings rows are 72px.

## Elevation & Depth

Mostly flat, with depth from tonal steps (graphite, pane, pane 2) and from colour. Shadows are rare and soft.

### Shadow Vocabulary
- **Cut-out lift** (`filter: drop-shadow(0 8px 10px #0007)`): under every cut-out photo, so a piece stands on its colour. Photos that could not be cut out get no shadow.
- **Sheet lift** (`box-shadow: 0 -10px 30px #0008`): non-modal sheets over the page.
- **Toast lift** (`box-shadow: 0 8px 24px #000A`): the undo toast.
- **Scrim** (`#000A`): behind modal sheets.

### Named Rules
**The Tonal Step Rule.** A surface is raised by moving one step lighter (graphite to pane to pane 2) or, on an item colour, by sinking into a well. Do not add a shadow to a card.

## Shapes

Soft, generous rounding, scaled to the size of the thing. Tiles and buttons are 14px; fields 12px; small inner wells, mini tiles and segment buttons 10-11px; mid panels (day cards, add-sheet ways, size entries, the one-place drawer) 16-18px; cards 20px; sheets and photo panels 22px at the top. Chips and the round icon buttons are full pills. Kind dots and colour swatches are circles. Outlines are 2px; dividers 1px. Dashed 2px outlines mark something not there yet: day-one tiles, a new wish, a missing staple.

## Components

### Buttons
Solid, one line, pressed down a touch.
- **Shape:** gently rounded (14px), at least 48px tall (52px on the item page), never wrapping.
- **Primary:** chalk with ink text, 16px bold. One per view.
- **Ghost:** transparent with a 2px Edge outline and chalk text; on an item colour the outline is white at 50%.
- **Link:** chalk text with an Edge underline, 44px target.
- **Icon button:** 44px round, transparent; boxed variant on pane 2 with 12px corners.
- **Press:** scales to 0.97 in 0.15s. Disabled: 45% opacity. Focus: 2px chalk outline, 2px offset.

### Chips
- **Style:** 44px pills, 2px Edge outline, chalk 15px text, optional 14px kind or colour dot and a quiet count.
- **On:** filled chalk, ink bold text. Fit chips take their fit colour as outline and text, and fill with it when on.
- **On an item colour:** outline white at 40%; fit chips turn chalk.

### Tiles
The grid unit. A square at 14px corners on the item's tile ground, the cut-out photo standing in the upper 66%, the name bottom-left in 14px bold over a soft dark fade (two lines max), an optional count badge top-left. No photo: the owner's chosen colour with a large kind icon and a faint repeating pattern of it. Press scales to 0.96. In selection, unpicked tiles drop to 45% and picked ones shrink to 0.93 with a 3px chalk ring and a 28px chalk tick that pops in.

### Swatch pages (a thing's page)
The whole page is the item's page colour; quiet text becomes its Tint. Photos sit in a 22px panel of black at 15%. Fields, fact tiles, the "where it lives" button and segmented tracks become wells. Facts are three equal tiles: 14px label with icon, 26px display value, 14px note. The bottom bar takes the page colour.

### Segmented control
A pane 2 track (a well on colour) at 14px corners with 4px padding; equal options at 44px, 15px text; the chosen one fills chalk with ink bold text. Used for "By kind / By colour / By place" and similar two-to-three-way switches.

### Inputs / Fields
- **Style:** pane 2 fill (well on colour), no border, 12px corners, 48px tall, 17px text, Quiet placeholder (Tint on colour).
- **Focus:** an inset 2px chalk ring.
- **Error:** an inset 2px amber ring with amber 15px text below; on a coloured page the message is chalk bold instead.

### Sheets
Pane, 22px top corners, 18px padding, up to 86% of the screen height, a 40 x 4px grip, 24px display title. They rise 40px with a fade over 0.34s. The add sheet holds four ways in a 2 x 2 grid of 132px panels: "Take photos" in chalk, the other three in kind colours, each with a 44px icon well.

### Navigation (tab bar)
Home, Everything, plus, Places, Wishes on graphite with a 1px line above. Tabs are Quiet 15px text at 48px tall; the current tab is chalk bold. The plus is a 48px chalk rounded square (14px) that opens the add sheet (on Wishes it adds a wish) and scales to 0.92 when pressed.

### Bars (Numbers and fit)
Labelled bars only: a 48px pane row at 14px corners with the label and amount written on it; the bar behind is the kind colour, growing from the left. The fit bar is a 36px strip of Tight / Fits / Loose segments with counts below.

### Stamps
A rotated (-5 degrees) word in a 2px current-colour box, 8px corners, 18px display 800 uppercase: "Logged" after logging a wear, "Gone" on a let-go thing. It lands once, from 1.8x scale to rest in 0.42s.

### Outfit bands
An outfit stands on vertical bands, one per piece colour (clamped), top piece first. On the wear screen and outfit lists the bands grow up from the floor, each 70ms after the last, and the pieces drop in 250ms later. On the outfit page the bands hang from the top at 85% opacity and fade to graphite.

### Toast
Chalk, 52px tall, 14px corners, ink bold text with a dark "Undo" button; sits above the tab bar and any open sheet.

### Motion inventory
Easings: **out** `cubic-bezier(.16,1,.3,1)` for almost everything; **flood** `cubic-bezier(.65,0,.2,1)` for colour fills.
- **Flood** (0.55s in, 0.45s back, flood easing): a circle clip of the new page grows from the tap point via the View Transitions API while the old page dims to 45%; back shrinks it toward the tile. Without View Transitions the page simply changes.
- **Rise** (0.35s, out): 14px rise and fade for cards, tiles, add-sheet ways and receipt rows, staggered by `--d`.
- **Sheet rise** (0.34s) and **scrim fade** (0.2s); toast rise (0.3s).
- **Tick** (0.32s): a changing count rolls one step. **Numeral roll**: big numbers ease up to a new value over 40 frames; no roll on revisit.
- **Bands grow** (0.6s), **piece drop** (0.45s, 24px), **bars and fit bar grow** (0.7s), **wish/bought fill** from the bottom (0.7-0.9s, flood easing).
- **Stamp land** (0.42s), **pop** (0.3s) for ticks, photo thumbnails and fix points, **drawer slide** (0.5s) for one place, **camera flash** (0.35s).
- **Nudge** (0.5s, once, after 0.8s) on a missing staple; **breathe** (2.6s, three times) on day-one tiles; **scan sweep** (1.4s, repeating only while a receipt is being read).
- Motion always plays: the app ignores the system "reduce motion" setting, as PRODUCT.md asks.

## Do's and Don'ts

### Do:
- **Do** take every coloured surface from a thing (through `itemColour` / `tileColour` / `tintOf`), a kind (`groupColour`), or a fit token.
- **Do** keep chalk as the only primary button, and show one per view.
- **Do** keep text at 14px or larger and touch targets at 44px or larger; buttons at 48px.
- **Do** put fields and fact tiles in wells (`#00000038`) on a coloured page and on pane 2 on graphite.
- **Do** give each motion a cause, play it once, and animate only transform, opacity and clip-path.
- **Do** use Display 800 with tight tracking for names and numbers, tabular figures for counts.
- **Do** keep two or three buttons in a row equal width, shrinking labels to the floor before anything wraps.

### Don't:
- **Don't** add decorative colour, gradients or a second accent; colour that belongs to nothing is noise.
- **Don't** put a raw, unclamped shade behind text.
- **Don't** use green, amber or blue-grey for anything but fit (amber also for tailoring, "None yet" and errors).
- **Don't** use thin weights, handwriting faces, or text under 14px.
- **Don't** add shadows to cards; raise by a tonal step or a well.
- **Don't** add themed worlds or clothes-only metaphors (rails, tags, shop windows).
- **Don't** loop a motion for show; only a live process (reading a receipt) may repeat.
