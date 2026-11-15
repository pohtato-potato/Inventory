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
