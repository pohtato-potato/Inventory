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
