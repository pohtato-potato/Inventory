---
version: 1
slug: "inventory-app-redesign"
primary_target: "src/screens"
related_targets: ["src/styles/tokens.css", "src/styles/base.css", "src/ui", "design/inventory-redesign-board-3.html", "design/inventory-redesign-board-4.html", "design/inventory-redesign-board-5.html"]
---

# Inventory app redesign (Operate)

Scope: every screen of the Inventory phone app. Audience: the owner, at a cupboard, a desk or in a shop, asking what they own, where it is and whether they already have one. The things are clothes and everything else equally. Constraints: S23 at 360 × 745 and 340 × 700. The app is dark, has no thin type, never goes under 14 px, and hides prices while browsing. Spec: `docs/superpowers/specs/2026-11-18-inventory-redesign.md`.

## Direction contract

THESIS: each thing's own colour is the interface. A quiet graphite app where opening a thing floods the screen with that thing's colour. It refuses themed worlds and the flat grey catalogue with one accent.

OWN-WORLD: graphite ground (#101114, #1A1B20, #24262C) with chalk #F4F1EB text and chalk primary buttons. Item colours fill whole pages. Six kind colours appear on dots, icon wells and bars. Fields and fact tiles are tinted dark wells. Bricolage Grotesque 800 is the display face and Atkinson Hyperlegible the body face. Rounded 14 px tiles, three across.

STORY: the owner opens on Home and answers today's question. They find any thing in Everything or Places in two taps, open it into its colour, and read where it lives and its three facts at a glance.

FIRST VIEWPORT: Home on graphite. The title and date sit at the top. The "What did you wear today?" card shows the outfit's pieces as colour tiles, with equal-width "Yes, this" / "Something else" buttons. Rating and "On this day" cards follow in their items' colours. The tab bar reads Home, Everything, chalk +, Places, Wishes.

FORM: Shade Card (item flood), candidate 3 of 7 on board 1, carried through boards 2–5 by the owner's reactions. seed:daebdd68fb1f006b. Signature interaction: tapping a thing grows its colour from the tap point to fill the screen, then its page rises in.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
