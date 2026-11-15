# Inventory Build 2 (using it) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the catalogue into something the owner uses: put outfits together from real pieces, log what was worn, keep a wish-list that stops bad buys, see the numbers, and land on a Home page.

**Architecture:** Same shape as Build 1. Pure logic in `src/domain`, mutations in `src/db/actions.ts`, thin screens over Dexie live queries, the Shop Window kit in `src/ui`. The database moves to version 2 with three new tables (`wears`, `outfits`, `wishes`); the existing `worn` events are migrated into `wears`, which becomes the single record of what was worn.

**Tech Stack:** Unchanged from Build 1 (Vite 8, React 19, TypeScript 7, Dexie 4, vite-plugin-pwa, Vitest 5, fake-indexeddb). No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-15-inventory-design.md`, sections 6.6 to 6.10. Look reference: `design/inventory-look-board-3.html` (the "Outfits" phone is the only Build 2 screen on it).

**Branch:** `feat/build-2`, cut from `main`.

## Global Constraints

Everything in the Build 1 plan's Global Constraints still holds. In addition:

- Prices of owned things appear only on the piece page and the Numbers page. Wishes may show prices.
- Cost per wear is shown per piece only, never per outfit.
- Wear logging never nags: no reminders, no streaks, no badges for logging.
- Spend is never added across currencies; each currency gets its own line.
- A day is the phone's local calendar day, stored as `YYYY-MM-DD`.
- Nothing a Build 1 user has saved may be lost by the upgrade.
- Calls made in this plan that the owner has not seen are marked **(my call)**.

## Review Focus

1. **Upgrading a phone that already holds pieces:** opening Build 2 over a Build 1 database must keep every piece, photo and wear. Pinned by Task 1 (a version 1 fixture is opened and counted).
2. **A worn piece that is later let go or trashed:** outfits and wear days that include it must still open, show it dimmed as "gone", and count correctly. Pinned by Tasks 2 and 3.
3. **Sharing into the app** (only the installed, built app can prove it): a shared product page opens the wish form; a share with no link, or arriving offline, still opens the form with whatever text there is. Pinned by Task 6 (parser) and Task 12 step 3 (built app).
4. **More than one currency:** totals and rankings must not mix ₹ with another currency. Pinned by Task 10.
5. **Midnight and time zones:** a wear logged at 00:10 belongs to the new day; "yesterday" is right under `TZ=UTC` and IST. Pinned by Task 2.

## File Structure

```
src/domain/  wearlog.ts  outfit.ts  wish.ts  gaps.ts  numbers.ts  home.ts      (new)
             types.ts  wears.ts  search.ts                                     (extended)
src/db/      db.ts (version 2)  migrate.ts (new)  actions.ts  hooks.ts         (extended)
src/screens/ Outfits.tsx  OutfitPage.tsx  WearLog.tsx  Wishes.tsx  WishForm.tsx
             OwnThis.tsx  Numbers.tsx  Home.tsx  YearReview.tsx                (new)
             Wardrobe.tsx  Piece.tsx  Details.tsx  Settings.tsx                (extended)
src/ui/      Stage.tsx (new: the head-to-toe outfit window)  TabBar.tsx        (extended)
src/backup/  file.ts (reads version 1 and 2, writes 2)
tests/       one file per new domain module, plus migrate, share, backup-v2
```

---

### Task 1: Database version 2 and migration

**Files:** Modify `src/domain/types.ts`, `src/db/db.ts`, `src/backup/file.ts`. Create `src/db/migrate.ts`. Test `tests/migrate.test.ts`, extend `tests/backup.test.ts`.

**Interfaces:**
- Produces (types, added to `types.ts`):

```ts
type Lane = 'head' | 'neck' | 'top' | 'waist' | 'bottom' | 'feet' | 'wrist' | 'hand' | 'carry';
type Layer = 'under' | 'over' | 'outer';
// Kind gains:  lane?: Lane; layer?: Layer; baseScale?: number   (1 = a tee's width)
// Item gains:  outfitScale?: number; pairs?: Id[]; dressCodes?: string[]
// Photo: itemId now holds the owner's id (item, outfit, wear or wish); role gains 'selfie' | 'wish'
interface Wear extends Base { day: string; itemIds: Id[]; outfitId?: Id; note?: string }
interface Outfit extends Base { name?: string; itemIds: Id[]; dressCodes: string[]; createdAt: number }
type Tier = 'now' | 'soon' | 'someday';
interface Wish extends Base {
  name: string; tier: Tier; kindId?: Id; shadeId?: Id; url?: string; shop?: string;
  price?: Rough<number>; currency: string; note?: string; forWhom?: string;
  waitUntil?: { date?: string; note?: string };
  status: 'open' | 'bought' | 'dropped'; itemId?: Id; boughtOn?: string;
  glad?: number; gladSkipped?: boolean; source: 'hand' | 'share' | 'photo' | 'gap'; createdAt: number;
}
```

- Produces: Dexie `version(2)` adding `wears: 'id, day, outfitId, *itemIds'`, `outfits: 'id'`, `wishes: 'id, tier, status'`, with an upgrade that calls `wearsFromEvents`; `wearsFromEvents(events: ItemEvent[]): Wear[]` (one wear per local day, item ids merged and de-duplicated); `STARTER_LANES: Record<kindName, { lane; layer?; baseScale }>` applied to starter kinds in the upgrade; backup `data.json` version 2, with `importAll` accepting 1 and 2.

- [ ] **Step 1: Write the failing tests**

```ts
// three 'worn' events: tee and jeans on 3 Nov, tee again on 3 Nov, tee on 4 Nov
expect(wearsFromEvents(events).map(w => [w.day, w.itemIds.length])).toEqual([['2026-11-03', 2], ['2026-11-04', 1]]);
// Review Focus 1: open a version 1 database, then the version 2 code
const before = await seedV1Fixture();           // 3 items, 5 photos, 3 worn events
const db2 = await openCurrent();
expect(await db2.items.count()).toBe(before.items);
expect(await db2.photos.count()).toBe(before.photos);
expect(await db2.wears.count()).toBe(2);
expect((await db2.kinds.get(TEES))!.lane).toBe('top');
expect((await db2.kinds.get(SHOES))!.baseScale).toBeLessThan((await db2.kinds.get(JEANS))!.baseScale!);
// backups
expect((await importAll(v1Zip)).items).toBe(3);                       // an older backup still restores
await expect(importAll(zipWithVersion(3))).rejects.toThrow('This backup was made by a newer version of Inventory');
```

- [ ] **Step 2:** Run `npx vitest run tests/migrate.test.ts tests/backup.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Starter lanes: Tees and Innerwear tops `top/under`; Shirts and Knitwear `top/over`; Jackets `top/outer`; Jeans, Trousers, Shorts `bottom`; Shoes `feet`; Socks `feet/under`; Watches and Bracelets `wrist`; Rings `hand`; Belts `waist`; Caps `head`; Bags `carry`. Base scales: tops 1, jackets 1.1, bottoms 0.8 wide, shoes 0.45, watches and bracelets 0.16, rings 0.08, belts 0.7, caps 0.45, bags 0.6. Kinds the owner added get no lane until one is chosen in the kind's settings.
- [ ] **Step 4:** Run. Expected: PASS. Run the whole suite; expected: all Build 1 tests still pass.
- [ ] **Step 5:** Commit: `feat: database version 2 with wears, outfits and wishes; older data and backups carry over`.

### Task 2: The wear record

**Files:** Create `src/domain/wearlog.ts`. Modify `src/db/actions.ts`, `src/db/hooks.ts`. Test `tests/wearlog.test.ts`.

**Interfaces:**
- Consumes: Task 1 `Wear`.
- Produces: `dayKey(at: number): string`; `shiftDay(day: string, by: number): string`; `wearStats(wears: Wear[]): { last: Map<Id, string>; count: Map<Id, number>; together: Map<string, number> }` (`together` keyed `idA|idB`, ids sorted); `outfitCount(outfit: Outfit, wears: Wear[]): number`; `suggestWear(outfits: Outfit[], wears: Wear[], today: string): { outfitId?: Id; itemIds: Id[] } | null`; actions `logWear(day: string, itemIds: Id[], outfitId?: Id): Promise<Id>` (replaces that day's wear), `removeWear(day)`, and `wornToday(id)` rewritten to add the piece to today's wear; `useWearLog()` now reads `wears` and keeps its current return shape.

- [ ] **Step 1: Write the failing tests**

```ts
expect(dayKey(new Date(2026, 10, 15, 0, 10).getTime())).toBe('2026-11-15');   // Review Focus 5
expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
// suggestion: the regular worn most in the last 60 days, unless it was worn yesterday; then the next one
expect(suggestWear([a, b], wearsWhereAWornMostButYesterday, today)!.outfitId).toBe(b.id);
expect(suggestWear([], [], today)).toBeNull();
await logWear('2026-11-15', [tee, jeans]); await logWear('2026-11-15', [tee]);
expect(await db.wears.where('day').equals('2026-11-15').count()).toBe(1);     // one wear a day
await wornToday(jeans);
expect((await db.wears.where('day').equals(dayKey(Date.now())).first())!.itemIds).toContain(jeans);
// Review Focus 2
await letGo(tee, { on: '2026-11-16', how: 'donated' });
expect(wearStats(await db.wears.toArray()).count.get(tee)).toBe(1);           // history survives
expect(await undoLast()).toBe('Let go of 1 piece');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. `logWear` still appends a `worn` event per newly added piece so "Its story" keeps working. All are undoable.
- [ ] **Step 4:** Run with `TZ=UTC` and without. Expected: PASS both.
- [ ] **Step 5:** Commit: `feat: one wear record per day, with stats and a suggestion`.

### Task 3: Outfit layout at true proportions

**Files:** Create `src/domain/outfit.ts`, `src/ui/Stage.tsx`. Test `tests/outfit.test.ts`.

**Interfaces:**
- Produces: `Placed = { itemId: Id; lane: Lane; layer: Layer; x: number; y: number; w: number; z: number; gone: boolean }` (fractions of the box; `w` is width, height follows the photo); `layout(items: Item[], kinds: Kind[], aspect: Map<Id, number>): Placed[]`; `placeIn(current: Id[], add: Item, items: Item[], kinds: Kind[]): Id[]` (a new piece replaces the one in the same lane and layer; `under`, `over`, `outer` can coexist in `top`; wrists and hands hold up to two each); `pairedFirst(candidates: Item[], chosen: Id[], together: Map<string, number>): Item[]`; `<Stage placed photos height />`.

- [ ] **Step 1: Write the failing tests**

```ts
const p = layout([tee, jeans, sneakers, watch], kinds, aspect);
const w = (id: Id) => p.find(x => x.itemId === id)!;
expect(w(sneakers.id).w).toBeLessThan(w(jeans.id).w);                 // shoes smaller than jeans
expect(w(watch.id).w).toBeLessThan(0.2);
expect(w(tee.id).y).toBeLessThan(w(jeans.id).y); expect(w(jeans.id).y).toBeLessThan(w(sneakers.id).y);  // head to toe
expect(w(watch.id).x).toBeLessThan(w(tee.id).x);                      // at the wrist, beside the top
expect(layout([{ ...tee, outfitScale: 1.2 }], kinds, aspect)[0].w).toBeCloseTo(1.2 * layout([tee], kinds, aspect)[0].w);
expect(placeIn([tee.id], shirt, items, kinds)).toEqual([tee.id, shirt.id]);      // under + over
expect(placeIn([tee.id], otherTee, items, kinds)).toEqual([otherTee.id]);        // same lane and layer replaces
expect(layout([jacket, shirt, tee], kinds, aspect).map(x => x.z)).toEqual([3, 2, 1]);
expect(layout([{ ...jeans, status: 'gone' }], kinds, aspect)[0].gone).toBe(true); // Review Focus 2
expect(pairedFirst([loafers, sneakers], [jeans.id], new Map([[key(jeans.id, sneakers.id), 4]]))[0].id).toBe(sneakers.id);
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Lane bands down the box: head 0–0.1, top 0.08–0.5, waist 0.46–0.52, bottom 0.44–0.9, feet 0.86–1; wrists at the outer edges of the top band, hands just below them, carry at the right edge of the bottom band. Pieces in overlapping layers are offset slightly so the under layer shows. `Stage` draws one tall window lit in the colour of the topmost `top` piece; a gone piece is drawn greyed with "gone" under it.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: head-to-toe outfit layout at true proportions`.

### Task 4: Outfits

**Files:** Create `src/screens/Outfits.tsx`, `src/screens/OutfitPage.tsx`. Modify `src/screens/Wardrobe.tsx`, `src/screens/Piece.tsx`, `src/db/actions.ts`. Test `tests/outfits.test.ts`.

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces: actions `saveOutfit(itemIds: Id[], name?: string, dressCodes?: string[]): Promise<Id>` (saving the same set of pieces again returns the existing outfit), `updateOutfit(id, patch)`, `removeOutfit(id)`, `setPairs(a: Id, b: Id, on: boolean)` (kept symmetric); `regulars(outfits: Outfit[], wears: Wear[]): Outfit[]` (most worn first, then newest); `DRESS_CODES = ['Formal', 'Smart casual', 'Casual', 'Ethnic', 'Gym', 'Lounge']` plus the owner's own in settings key `dressCodes`.

- [ ] **Step 1: Write the failing tests**

```ts
const a = await saveOutfit([tee, jeans]); const b = await saveOutfit([jeans, tee]);
expect(b).toBe(a);                                                       // same pieces, same outfit
await setPairs(tee, jeans, true);
expect((await db.items.get(jeans))!.pairs).toContain(tee);               // both sides
expect(regulars([o1, o2], wearsWhereO2WornTwice).map(o => o.id)).toEqual([o2.id, o1.id]);
await removeOutfit(a); expect(await undoLast()).toBe('Removed 1 outfit');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The wardrobe header gets a switch "Pieces / Outfits" **(my call)**. Outfits screen, top to bottom, matching the board's Outfits phone: "Your regulars" as a sideways row of `Stage` windows with "Worn N times" under each; then "Or start from a piece": a three-across grid filtered by lane chips (Tops, Bottoms, Shoes, Accessories). Tapping a piece adds it through `placeIn` to the outfit being built, shown in a large `Stage` pinned under the header; pieces that pair with what is chosen (`pairs`, then `together`) are listed first with "pairs well" under them. "Save" asks for an optional name and dress codes. Tapping a regular opens `OutfitPage`: the stage, its pieces as tiles, dress codes, times worn, last worn, "Wore this today" (blue), "Change", "Remove". The piece page's Edit gains "Size in outfits" (a slider from 0.6 to 1.5 writing `outfitScale`, with a live `Stage` preview), "Pairs well with" (pick pieces) and "Dress codes". With no clothing yet, Outfits says "Add a few pieces first, then put them together here."
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: outfits, built from regulars and pieces`.

### Task 5: The wear log and mirror selfies

**Files:** Create `src/screens/WearLog.tsx`. Modify `src/screens/Piece.tsx`, `src/screens/OutfitPage.tsx`, `src/domain/wears.ts`. Test `tests/wearlog-screen.test.ts`.

**Interfaces:**
- Consumes: Task 2 `suggestWear`, `logWear`; Build 1 `openCamera`, `savePhotos`.
- Produces: `wearLine(wear: Wear | undefined, outfits: Outfit[], items: Item[]): string` ("Navy tee, blue jeans and 2 more", or the outfit's name); `lastWornText(day: string | undefined, today: string): string` ("today", "yesterday", "13 days ago", "never logged").

- [ ] **Step 1: Write the failing tests**

```ts
expect(wearLine({ ...w, itemIds: [a, b, c, d] }, [], items)).toBe('Navy tee, Blue jeans and 2 more');
expect(wearLine({ ...w, outfitId: o.id }, [{ ...o, name: 'Office' }], items)).toBe('Office');
expect(lastWornText('2026-11-02', '2026-11-15')).toBe('13 days ago');
expect(lastWornText(undefined, '2026-11-15')).toBe('never logged');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the screen (`#/wear?day=`): the day as a large numeral with "Today", and arrows to step back a day or pick a date; then the suggestion as a `Stage` with "Same as last time?" and a blue "Yes, this" (one tap logs it); then "Something else": regulars as a row, then pieces to tap in. The day's current pieces show as removable tiles. "Add a mirror photo" takes a photo saved with role `selfie` against the wear; a selfie can also be added to an outfit from `OutfitPage`. A saved day shows "Logged" and can be changed or cleared. Reached from Home, from the wardrobe menu, and from "Wore this today" on an outfit. The piece page's wears line uses `lastWornText`. No reminders anywhere.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: quick wear log for any day, with mirror photos`.

### Task 6: Wishes, the record

**Files:** Create `src/domain/wish.ts`. Modify `src/db/actions.ts`, `src/db/hooks.ts`. Test `tests/wish.test.ts`, `tests/share.test.ts`.

**Interfaces:**
- Produces: `parseShare(search: string): { name?: string; url?: string; shop?: string } | null` (reads `title`, `text`, `url`; finds a link inside `text` when `url` is empty; shop from the host: `myntra.com` → "Myntra", `amazon.in` → "Amazon", `ajio.com` → "Ajio", else the host's first label capitalised); `isWaiting(w: Wish, today: string): boolean`; `sortWishes(ws: Wish[], today: string): Wish[]` (open first, waiting last within a tier, newest first); actions `addWish(draft, photo?)`, `updateWish`, `dropWish(id)`, `buyWish(id, opts: { boughtOn: string; price?: Rough<number> }): Promise<Id>` (creates an item with `needsDetails: true`, copying name, kind, shade, price, shop and the wish photo as an extra photo; sets `status: 'bought'`, `itemId`); `useWishes()`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(parseShare('?title=Linen%20Shirt&text=Check%20this%20https%3A%2F%2Fwww.myntra.com%2Fshirts%2F123'))
  .toEqual({ name: 'Linen Shirt', url: 'https://www.myntra.com/shirts/123', shop: 'Myntra' });
expect(parseShare('?text=just%20words')).toEqual({ name: 'just words' });   // Review Focus 3: no link
expect(parseShare('')).toBeNull();
expect(parseShare('?url=javascript%3Aalert(1)')!.url).toBeUndefined();      // only http and https links are kept
expect(isWaiting({ ...w, waitUntil: { date: '2026-12-01' } }, '2026-11-15')).toBe(true);
expect(isWaiting({ ...w, waitUntil: { date: '2026-11-01' } }, '2026-11-15')).toBe(false);
expect(isWaiting({ ...w, waitUntil: { note: 'when my waist is under 32' } }, '2026-11-15')).toBe(true);  // until cleared by hand
const itemId = await buyWish(wid, { boughtOn: '2026-11-15' });
expect((await db.items.get(itemId))!.needsDetails).toBe(true);
expect((await db.wishes.get(wid))!.status).toBe('bought');
expect(await undoLast()).toBe('Bought 1 wish');
expect(await db.items.get(itemId)).toBeUndefined();
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: wishes with tiers, waiting and buying`.

### Task 7: The wish-list screens and sharing in

**Files:** Create `src/screens/Wishes.tsx`, `src/screens/WishForm.tsx`. Modify `vite.config.ts`, `src/main.tsx`, `src/ui/TabBar.tsx`, `src/App.tsx`. Test extend `tests/wiring.test.ts`.

**Interfaces:**
- Consumes: Task 6.
- Produces: manifest `share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } }`; on start, `main.tsx` passes `location.search` to `parseShare` and, when it returns something, routes to `#/wish-new` with the values and clears the search from the address; tab bar Wardrobe · Things · + · Wishes · Home.

- [ ] **Step 1: Write the failing test**

```ts
const cfg = readFileSync('vite.config.ts', 'utf8');
expect(cfg).toMatch(/share_target/); expect(cfg).toMatch(/method:\s*'GET'/);
expect(readFileSync('src/main.tsx', 'utf8')).toMatch(/parseShare\(/);
expect(TABS.map(t => t.label)).toEqual(['Wardrobe', 'Things', 'Add a piece', 'Wishes', 'Home']);
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Wishes screen: a window header with the count of open wishes and one wish "in the window"; a switch Now / Soon / Someday; a two-across image board (taller tiles than the wardrobe, with name, shop and price under each); waiting wishes dimmed with "waiting until 1 Dec" or the note. A wish with no photo shows its name large in an unlit window. The + on this tab offers "Type it in", "Photo from a shop", "Do I already own this?". `WishForm`: photo, name, tier, kind and shade (optional), shop, link, price, "Is it for someone?" (a name), "Wait to buy until" (a date, or a line of text), note; then "Save". An open wish page offers "Bought" (blue), "Open the shop page", "Move to…", "Not any more". Without a link the shop-page button is absent.
- [ ] **Step 4:** Run. Expected: PASS. Run `npm run build` and confirm `dist/manifest.webmanifest` contains `share_target`.
- [ ] **Step 5:** Commit: `feat: wish-list board, wish form and sharing in from shop apps`.

### Task 8: "Do I already own this?" and gap hints

**Files:** Create `src/domain/gaps.ts`, `src/screens/OwnThis.tsx`. Modify `src/screens/Wishes.tsx`, `src/screens/Settings.tsx`. Test `tests/gaps.test.ts`.

**Interfaces:**
- Consumes: Build 1 `matches`.
- Produces: `Staple = { id: string; label: string; kind: string; family?: string }` (kind and family by name); `STARTER_STAPLES: Staple[]`; `gaps(items: Item[], staples: Staple[], dismissed: string[], trees): Staple[]`; `ownedLike(items: Item[], q: { kindId?: Id; shadeId?: Id }, trees): Item[]` (owned only; a family matches its shades; a parent kind matches its children).

- [ ] **Step 1: Write the failing tests**

```ts
expect(gaps([burgundyTee], STARTER_STAPLES, [], trees).map(s => s.label)).toContain('White tee');
expect(gaps([whiteTee], STARTER_STAPLES, [], trees).map(s => s.label)).not.toContain('White tee');
expect(gaps([offWhiteTee], STARTER_STAPLES, [], trees).map(s => s.label)).not.toContain('White tee'); // a shade of white counts
expect(gaps([], STARTER_STAPLES, ['white-tee'], trees).map(s => s.id)).not.toContain('white-tee');     // dismissed stays gone
expect(gaps([goneWhiteTee], STARTER_STAPLES, [], trees).map(s => s.label)).toContain('White tee');     // gone does not count
expect(ownedLike([navyTee, goneNavyTee, navyJeans], { kindId: TOPS, shadeId: BLUE }, trees)).toEqual([navyTee]);
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Starter staples: White tee, Black tee, White shirt, Blue jeans, Dark trousers, White sneakers, Brown or black leather shoes, Plain belt, Light jacket. `OwnThis`: pick a kind and a colour family with chips; results appear as tiles as soon as either is chosen, with the count as a large numeral ("3 like this") or "Nothing like this yet". Open it from the + on Wishes, from the wardrobe menu, and from a wish page ("Do I already own this?", prefilled). Gap hints sit at the foot of the Wishes screen as "You have none of these": each with "Add to wishes" and "Not for me". The staples list is editable in Settings.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: do I already own this, and gap hints`.

### Task 9: The two buying questions

**Files:** Modify `src/domain/wish.ts`, `src/screens/Wishes.tsx`. Test extend `tests/wish.test.ts`.

**Interfaces:**
- Produces: `asksThirtyWears(w: Wish, kinds: Kind[]): boolean` (clothing kinds only; a wish with no kind is asked too); `gladDue(wishes: Wish[], today: string): Wish[]` (bought 30 or more days ago, `glad` unset, not skipped, and the item not gone); action `answerGlad(id, score: number | 'skip')`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(asksThirtyWears({ ...w, kindId: TEES }, kinds)).toBe(true);
expect(asksThirtyWears({ ...w, kindId: ELECTRONICS }, kinds)).toBe(false);
expect(gladDue([{ ...bought, boughtOn: '2026-10-16' }], '2026-11-15').length).toBe(1);   // exactly 30 days
expect(gladDue([{ ...bought, boughtOn: '2026-10-17' }], '2026-11-15').length).toBe(0);
expect(gladDue([{ ...bought, boughtOn: '2026-09-01', glad: 6 }], '2026-11-15').length).toBe(0);
await expect(answerGlad(wid, 9)).rejects.toThrow();                                       // 1 to 7 only
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. "Bought" on a clothing wish first shows one sheet: "Will you wear it 30 times?" with "Yes, I will" (continues), "Not sure, keep it as a wish" (closes) and "Buying it anyway" (continues). The glad check is a card (Task 11 places it on Home): the piece in a window, "Bought 30 days ago. Glad you bought it?", seven numbered buttons from 1 to 7 with "not at all" and "very" at the ends, and "Skip". The answer is saved on the wish and shown on the piece's story.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: the 30 wears question and the glad-you-bought-it check`.

### Task 10: Numbers

**Files:** Create `src/domain/numbers.ts`, `src/screens/Numbers.tsx`. Test `tests/numbers.test.ts`.

**Interfaces:**
- Consumes: Build 1 `countAtEveryLevel`, `costPerWear`, `totalWears`; Task 2 `wearStats`.
- Produces: `spend(items: Item[], by: 'kind' | 'shop' | 'brand', trees): { currency: string; total: number; estimated: boolean; rows: { label: string; amount: number }[] }[]` (owned and gone pieces both count as money spent; pieces without a price are left out and counted in `unpriced`); `valueRanking(items, counts, kinds): { best: Ranked[]; worst: Ranked[] }` (clothing with a price and at least one wear; five each; one currency at a time); `topBrands(items: Item[], n = 5): { brand: string; count: number }[]`; `onThisDay(items, wears, today): { item: Item; what: 'bought' | 'worn'; years: number }[]`; `anniversaries(items, today): { item: Item; years: number }[]` (exact bought dates only).

- [ ] **Step 1: Write the failing tests**

```ts
const s = spend([inr1000, inr500est, usd40, noPrice], 'kind', trees);
expect(s.map(x => [x.currency, x.total])).toEqual([['INR', 1500], ['USD', 40]]);          // Review Focus 4
expect(s[0].estimated).toBe(true);
expect(valueRanking([cheapWornALot, dearWornOnce, neverWorn, noPrice], counts, kinds).best[0].item.id).toBe(cheapWornALot.id);
expect(valueRanking([neverWorn], counts, kinds)).toEqual({ best: [], worst: [] });
expect(topBrands([u1, u2, z1, noBrand])[0]).toEqual({ brand: 'Uniqlo', count: 2 });
expect(anniversaries([{ ...watch, boughtOn: { value: '2021-11-15', estimate: false } }], '2026-11-15')[0].years).toBe(5);
expect(anniversaries([{ ...watch, boughtOn: { value: '2021', estimate: true } }], '2026-11-15')).toEqual([]);
expect(anniversaries([{ ...watch, boughtOn: { value: '2024-02-29', estimate: false } }], '2026-02-28')[0].years).toBe(2); // leap day
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement, then the screen (reached from Home's header): the count of pieces and of things as large numerals; counts by kind and by home and spot; "What it all cost" per currency, marked "about" when any price is an estimate, with "N pieces have no price"; a switch By kind / By shop / By brand over plain rows with a bar each; "Best value" and "Worst value" as tiles with cost per wear; "Brands you own most". Empty sections say what would fill them ("Log a few wears to see best and worst value").
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: numbers page with spend, value and brands`.

### Task 11: Home and the year in review

**Files:** Create `src/domain/home.ts`, `src/screens/Home.tsx`, `src/screens/YearReview.tsx`. Modify `src/App.tsx`. Test `tests/home.test.ts`.

**Interfaces:**
- Consumes: Tasks 2, 9, 10.
- Produces: `homeCards(input: { items; wears; wishes; outfits; today: string }): Card[]` in this fixed order, each present only when it has something to show: `log` (always), `glad`, `needsDetails`, `onThisDay`, `anniversary`, `recent`, `year`; `yearOpen(today: string): boolean` (20 December to 10 January); `yearRooms(items, wears, places, year): { place: Place; added: number; wears: number; mostWorn?: Item; letGo: number }[]` (homes, then their spots, then "With me"; rooms with nothing that year are left out).

- [ ] **Step 1: Write the failing tests**

```ts
expect(homeCards(empty).map(c => c.type)).toEqual(['log']);
expect(homeCards(full).map(c => c.type)).toEqual(['log', 'glad', 'needsDetails', 'onThisDay', 'anniversary', 'recent']);
expect(yearOpen('2026-12-19')).toBe(false); expect(yearOpen('2026-12-20')).toBe(true);
expect(yearOpen('2027-01-10')).toBe(true);  expect(yearOpen('2027-01-11')).toBe(false);
expect(homeCards({ ...full, today: '2026-12-25' }).at(-1)!.type).toBe('year');
expect(yearRooms(items, wears, places, 2026).every(r => r.added + r.wears + r.letGo > 0)).toBe(true);
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Home: the date as a large numeral in a window header, with a "Numbers" link; then the cards. `log`: "What did you wear today?" with the suggestion as a small stage and a blue "Log it", or "Logged: Navy tee, Blue jeans" once done. `needsDetails`: "7 pieces need details" opening the queue. `recent`: the last six pieces added. The app still opens on the wardrobe; Home is a tab. Year in review: one screen per room as a lit window holding that room's most worn piece, with pieces added, wears and pieces let go as numerals, swiped sideways; the last screen is the whole year: pieces added, wears logged, most worn piece, and spend per currency. In January it reviews the year just ended.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: Home page and the year in review`.

### Task 12: Whole-build verification

**Files:** Create `docs/superpowers/notes/2026-11-build-2-verification.md`; modify `README.md` and whatever the checks turn up.

- [ ] **Step 1:** Run `TZ=UTC npm test`, `npm test`, `npm run typecheck`. Expected: all PASS, no errors.
- [ ] **Step 2:** Run `npm run build && npm run preview`. At 360 × 745 and 340 × 700, on every new screen and every changed one, measure: text under 14 px (expected 0), tap targets under 44 px (0), text contrast under 4.5:1 including text over lit windows (0; measure against the darkest and lightest point behind each text), horizontal scroll (none), content under the tab bar or a sheet (none). Compare Outfits with the board's Outfits phone at 360 px. For the screens with no board (wear log, wishes, numbers, Home, year in review), check each against Build 1's screens for the same type sizes, spacing and components, and list any new component invented.
- [ ] **Step 3 (Review Focus 3):** In the built preview, open `./?title=Linen%20Shirt&url=https%3A%2F%2Fwww.myntra.com%2Fx`. Expected: the wish form opens prefilled and the address no longer carries the query. Stop the server, reload the same address. Expected: the same, offline. Note in the verification file that sharing from the Myntra app itself can only be checked on the installed phone app.
- [ ] **Step 4 (Review Focus 1):** Restore a backup file made by the deployed Build 1 into the preview. Expected: every piece and photo present, wears carried over.
- [ ] **Step 5:** Walk three states: nothing but pieces (every new screen's empty state reads sensibly), a dozen pieces with a week of wears, and the 300-piece dev seed with a year of generated wears.
- [ ] **Step 6:** Write the verification note: what ran, the environment, every number measured, and everything not verified. Commit: `docs: build 2 verification`.
- [ ] **Step 7:** Request the one full review (superpowers:requesting-code-review), fix what it finds. Do not push; the owner says when.

---

## Self-review notes

- **Spec coverage:** saved outfits, builder, true proportions, pairs well, dress codes, layer lanes (Tasks 1, 3, 4); mirror selfies (5); quick wear log, last worn, times worn (2, 5); cost per wear stays per piece (Build 1, unchanged); wish board, tiers, wait to buy, save from a shop, wish from a photo (6, 7); do I already own this, gap hints (8); 30 wears, glad you bought it (9); numbers, spend, value, brands, on this day, anniversaries (10); year in review, Home (11).
- **Calls the owner has not seen:** the "Pieces / Outfits" switch on the wardrobe; one wear record per day (a second log on the same day replaces the first); a wish can be "for someone" by typed name, which covers gift ideas simply; the staples list behind gap hints; the year in review opening from 20 December to 10 January.
- **Risk to say out loud:** only the Outfits screen has an approved board. The wear log, wishes, numbers, Home and year in review are designed here in words and built from the Shop Window kit. If any of them should be seen before it is built, a board comes first.
