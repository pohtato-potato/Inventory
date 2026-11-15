# Ledger — plan: docs/superpowers/plans/2026-11-15-inventory-build-2.md

Branch feat/build-2 from main 4f49307. Executor: Claude (Opus 5.5), inline (superpowers:executing-plans). One full review after Task 12.

## Tasks

Task 1: complete — db v2 (wears, outfits, wishes), upgrade from a real Build 1 database (frozen fixture tests/fixtures/build1), backup v2 reads v1. Tests 210/210.
Task 1: Ruling: STARTER_LANES keyed by starter name but applied by starter kind id (k-<slug>) — a renamed starter kind keeps its lane; owner kinds get none — cost if wrong: a renamed kind keeps a lane it may no longer suit.
Task 2: complete — wearlog (dayKey, shiftDay, wearStats, outfitCount, suggestWear), logWear/removeWear, wornToday rewritten onto wears, useWearLog reads wears (same shape). Tests 223/223, UTC and IST.
Task 2: Ruling: wornToday now returns boolean (false when already on today's wear) instead of void — the piece page needs to know not to claim a new wear — cost if wrong: none outside the piece page.
Task 2: Ruling: a wear counts for an outfit by outfitId or by holding all its pieces; adding a piece to an outfit day drops outfitId — keeps counts right without a second record — cost if wrong: an outfit worn with an extra piece still counts as that outfit.
Task 2: Ruling: with no regular to suggest, suggestWear offers the last wear before today ("Same as last time?") — the plan only defines the outfit case — cost if wrong: an unwanted suggestion, one tap to dismiss.
Task 2: Ruling: logging a past day stamps its worn events at noon that day; taking a piece off a day removes that day's worn event — keeps "Its story" in step with wears — cost if wrong: story times show noon.
Task 3: complete — layout/placeIn/pairedFirst/laneOf/lightPiece in src/domain/outfit.ts, Stage in src/ui/Stage.tsx; thumbs carry photo aspect. Tests 236/236.
Task 3: Ruling: Placed gains `h` (height fraction, from the photo's aspect and a fixed stage shape 0.53 = the board's 128×240) — the Stage needs it — cost if wrong: none, additive.
Task 3: Ruling: a kind with no lane uses its parent's, else stands at the side ("carry", 0.6) — the plan leaves lane-less kinds undefined — cost if wrong: an owner's kind shows at the side until a lane is chosen in Settings.
Task 3: Ruling: placeIn toggles (a chosen piece tapped again is taken out) — the builder needs a way to remove — cost if wrong: none.
Task 4: complete — saveOutfit/updateOutfit/removeOutfit/setPairs/setKindLane, regulars/DRESS_CODES; Outfits (regulars, builder pinned under header, lane chips, pairs well), OutfitPage, Pieces/Outfits switch (my call, as planned), Edit: size in outfits (slider + live stage), pairs well with, dress codes; Settings kind sheet: where it goes in outfits. Tests 243/243.
Task 4: Ruling: added setKindLane and a "Where it goes in outfits" choice on the kind sheet — Task 1 says owner kinds get a lane "in the kind's settings" but no task builds it — cost if wrong: one extra control on the kind sheet.
Task 4: Ruling: "Or start from a piece" is three across, as the plan says (the board drew four) — plan wins over board on density since Build 1 chose three — cost if wrong: denser grid wanted.
Task 4: Ruling: the size preview in Edit shows the piece inside the newest outfit that holds it, else alone — a lone piece shows no proportion — cost if wrong: none.
Task 5: complete — wearLine/lastWornText/namesLine in domain/wears.ts; WearLog screen (#/wear?day=), MirrorPhoto (role selfie against a wear or outfit), reached from the wardrobe menu ("What you wore") and "Wore this today"; piece page uses lastWornText. DayPicker moved to shared.tsx. Tests 248/248.
Task 5: Ruling: the day's pieces show as removable tiles while changing a day, and a bottom bar logs them; a regular tapped loads its pieces rather than logging at once — one confirm step for "something else", the suggestion stays one tap — cost if wrong: one extra tap for a regular.
Task 6: complete — parseShare, isWaiting, sortWishes, addWish/updateWish/dropWish/buyWish, useWishes/useWish (tests: TZ=UTC npm test and npm test → 260/260)
Task 6: Ruling: parseShare uses the words around a link as the name when there is no title, and names a "shop."/"m." host by its second label (shop.uniqlo.com → Uniqlo) — shop apps share "Name https://…" in text — if wrong, a name field holds a stray sentence the owner edits.
Task 6: Ruling: a bought wish with no kind becomes "Not sorted yet" under clothing — the wish list is mostly clothes — if wrong, the owner re-sorts one piece.
Task 7: complete — Wishes board, wish page with Bought/Move/Not any more, WishForm, share_target in dist/manifest.webmanifest, five tabs (tests: TZ=UTC npm test and npm test → 264/264; build ok)
Task 7: Ruling: the Home tab and a stub Home screen land now, because the plan's Task 7 test requires the five tabs; Task 11 fills Home — cost if wrong: none, the stub is replaced.
Task 7: Ruling: "Photo from a shop" picks the photo inside the + sheet (a real tap) and hands it to the form, so the file picker is never opened without a tap — cost if wrong: none.
Task 7: Ruling: added safeLink and waitText to wish.ts (tested); a typed link without http gets https; anything not http/https is refused — cost if wrong: an odd link needs retyping.
Task 7: Ruling: no currency field on a wish (INR unless a later edit adds it) — the form already has nine fields — cost if wrong: a USD wish shows ₹.
Task 8: complete — gaps/ownedLike on Build 1 matches, OwnThis screen (+ on Wishes, wardrobe menu, wish page prefilled), gap hints on Wishes, staples editable in Settings (tests: TZ=UTC npm test and npm test → 271/271)
Task 8: Ruling: Staple.family is string | string[] (signature deviation) so "Brown or black leather shoes" and "Dark trousers" can name several families — cost if wrong: none for single-family staples.
Task 8: Ruling: gap hints wait until the wardrobe holds one clothing piece, and skip a staple already on the wish list by name — an empty wardrobe would show all nine — cost if wrong: a new owner sees no hints until the first piece.
Task 8: Ruling: "Add to wishes" from a gap goes to Someday; a wish's shade is widened to its family in OwnThis — cost if wrong: one tap to move tiers.
Task 9: complete — asksThirtyWears, gladDue, answerGlad; "Will you wear it 30 times?" sheet before Bought on clothing; GladCard (placed on Home in Task 11); glad answer on the piece page and in a gone piece's story (tests: TZ=UTC npm test and npm test → 275/275)
Task 9: Ruling: gladDue takes an optional third argument, the pieces (signature deviation), to leave out a piece let go or deleted; without it the check is skipped — cost if wrong: none.
Task 9: Ruling: the 1–7 scale is one segmented row of seven 44+ px buttons (fits 340 px), not seven separate buttons with gaps — cost if wrong: a restyle.
