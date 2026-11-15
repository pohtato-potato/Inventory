# Inventory Build 1 (the catalogue) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone app the owner can install and start filling: photograph clothes and other things, have them cut out, browse them by kind, colour and place, record fit and sizes, and back everything up.

**Architecture:** An installed, offline web app. All data and photos live in IndexedDB on the phone through Dexie. Pure logic (trees, colour matching, wears, search, the window pick) lives in `src/domain` and is unit-tested; screens are thin React components over Dexie live queries. The cut-out model runs in a web worker and is fetched from Hugging Face on first run.

**Tech Stack:** Vite 8, React 19, TypeScript 7, Dexie 4 + dexie-react-hooks, vite-plugin-pwa, Vitest 5 + fake-indexeddb, `@huggingface/transformers` (RMBG-1.4), `tesseract.js` (text reading), `fflate` (backup zip), `@fontsource-variable/archivo`, `@fontsource/atkinson-hyperlegible`. Node 24. Same versions and config shape as `../health`.

**Spec:** `docs/superpowers/specs/2026-11-15-inventory-design.md`. Look reference: `design/inventory-look-board-3.html` (published at https://claude.ai/artifact/FmATEZXU89y1ZHMPzphwkW).

## Where this sits in the overall plan

| Stage | What | State |
|---|---|---|
| Build 1 | The catalogue: this plan, 16 tasks | To build |
| Owner | Photographs the wardrobe and starts using the app | After Build 1 ships |
| Build 2 | Outfits, wear log, wishes, numbers, Home (spec sections 6.6 to 6.9) | Its own plan, written after the Build 1 review, tuned on the owner's real pieces |
| Later | Everything in spec section 12 "Later" | Picked from as the owner asks |

Build 1 leaves room for Build 2: the tab bar reserves Wishes and Home, `events` already records `worn`, and items already carry starting wears.

## Global Constraints

- Device: Samsung S23, installed web app. Check every screen at 360 × 745 and 340 × 700. Nothing pinned to the bottom may cover content.
- Offline: everything works without internet after the first run, except Drive backup.
- All data and photos live on the phone.
- Legibility: body text 16 px or larger, nothing below 14 px, text contrast 4.5:1 or better, no thin or handwriting fonts, touch targets 44 px.
- Money: ₹ by default, with a currency per item.
- Prices of owned things never appear while browsing; only on the item page.
- Colour comes from the owner's things, plus one blue (`#7FA7FF`) for the main action. Green, amber and blue-grey only for fit.
- Motion is wanted. Do not build a reduced-motion or battery-saver mode.
- No link to any other app in this build.
- Copy is plain words: "pieces", "things", "spots", "homes". No jargon.
- The RMBG model is fetched from Hugging Face at first run and never committed to the repo.
- Deletion sets `deletedAt`; rows are removed after 30 days. Every record has `id` and `updatedAt`.
- One full review at the end of the build. No per-task reviews. Commit after each task; do not push until the owner says so.
- Served at `pohtato-potato.github.io/inventory/` with `base: './'`.

## Review Focus

1. **Offline after first run** (only the built app can prove it): with the model, text reader and fonts cached, the app must add and cut out a piece in aeroplane mode. Pinned by Task 16 step 3.
2. **Phone storage full while saving a photo:** the item must not be left half-saved; the owner sees "Not enough space to save this photo". Pinned by Task 4 (`createItemWithPhoto` rolls back).
3. **A cut-out that comes back empty or covers the whole frame** (black jeans on a dark sheet): keep the uncut photo and say so. Pinned by Task 6 (`cleanMask` returns `null`).
4. **A piece with no price, or never worn:** cost per wear must be absent, never `NaN`, `Infinity` or ₹0. Pinned by Task 11.
5. **Deleting a kind, shade or spot that pieces still use:** pieces move to the parent kind, the shade's family, or "No spot"; nothing disappears. Pinned by Task 4.

Also covered though not in the top five: restoring a backup made by a newer version is refused with a message (Task 15).

## File Structure

```
src/
  main.tsx, App.tsx, router.ts, pwa.ts, env.d.ts
  styles/tokens.css, base.css
  domain/  types.ts  tree.ts  colour.ts  wears.ts  estimate.ts  window.ts
           search.ts  fields.ts  format.ts  csv.ts
  db/      db.ts  seed.ts  actions.ts  hooks.ts
  photo/   camera.ts  mask.ts  polish.ts  encode.ts  cutout.worker.ts  cutout.ts
  read/    parse.ts  reader.ts
  backup/  file.ts  google.ts  drive.ts
  ui/      Window.tsx  Tile.tsx  Numeral.tsx  Chips.tsx  Seg.tsx  TabBar.tsx
           Sheet.tsx  Toast.tsx  icons.tsx
  screens/ Wardrobe.tsx  Things.tsx  Browse.tsx  Piece.tsx  Camera.tsx
           Details.tsx  Sizes.tsx  Search.tsx  Settings.tsx  SpotPage.tsx
tests/     one file per domain/db/photo/read/backup module
.github/workflows/deploy.yml
```

`domain` imports nothing from `db`, `photo` or React. `Browse.tsx` is the shared body of Wardrobe and Things (they differ only in which kinds they show).

---

### Task 1: Project shell

**Files:**
- Delete: `bg-test/`
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `.github/workflows/deploy.yml`, `src/main.tsx`, `src/App.tsx`, `src/router.ts`, `src/pwa.ts`, `src/env.d.ts`, `src/styles/tokens.css`, `src/styles/base.css`, `scripts/make-icons.mjs`, `public/icons/*`
- Test: `tests/router.test.ts`, `tests/wiring.test.ts`

**Interfaces:**
- Produces: `parseHash(hash: string): { path: string; params: URLSearchParams }` (default path `/wardrobe`); `useRoute()`; `go(path: string, params?: Record<string, string>): void`; `startPwa(): void`; CSS tokens `--g #0B0C0F`, `--t #EEEAE4`, `--m #ABA69E`, `--line #272930`, `--pane #15161A`, `--a #7FA7FF`, `--ok #7BD3A0`, `--warn #F0B95B`, `--lo #8FA3BF`, `--f-num` (Archivo, width 64, weight 500), `--f-caps` (Archivo, weight 600, letter-spacing .2em, uppercase), `--f-body` (Atkinson Hyperlegible).

- [ ] **Step 1:** Copy `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `src/pwa.ts`, `src/router.ts` and `.github/workflows/deploy.yml` from `../health`. In the manifest set name and short_name `Inventory`, description `Everything you own, clothes first. Everything stays on this phone.`, `start_url: './#/wardrobe'`, background and theme `#0B0C0F`, no shortcuts. Keep `registerType: 'prompt'` and `injectRegister: false`. Add `'**/*.wasm'` to `globIgnores` and a workbox `runtimeCaching` entry: `CacheFirst` for `https://huggingface.co/**` and `https://cdn.jsdelivr.net/**` in cache `models`.
- [ ] **Step 2: Write the failing tests**

```ts
// tests/router.test.ts
expect(parseHash('')).toMatchObject({ path: '/wardrobe' });
expect(parseHash('#/piece?id=abc').params.get('id')).toBe('abc');
// tests/wiring.test.ts — injectRegister is false, so the manual wiring must exist
const main = readFileSync('src/main.tsx', 'utf8');
expect(main).toMatch(/startPwa\(\)/);
expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/injectRegister:\s*false/);
```

- [ ] **Step 3:** Run `npm test`. Expected: FAIL, `parseHash` not exported.
- [ ] **Step 4:** Implement `parseHash`, `useRoute`, `go` in `src/router.ts`; `src/main.tsx` mounts `<App/>` and calls `startPwa()`; `App.tsx` renders the routed screen and `<TabBar/>` placeholder. Write `tokens.css` with the values above and `base.css` (16 px body, selection, focus ring and caret in `--a`).
- [ ] **Step 5:** Run `npm test` and `npm run build`. Expected: PASS, build succeeds.
- [ ] **Step 6:** Commit: `chore: project shell, replaces the throwaway cut-out test`.

### Task 2: Types, database, starter data

**Files:**
- Create: `src/domain/types.ts`, `src/db/db.ts`, `src/db/seed.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Produces (types):

```ts
type Id = string;
interface Base { id: Id; updatedAt: number; deletedAt?: number }
interface Kind extends Base { parentId: Id | null; name: string; clothing: boolean; fields: FieldKey[]; hideFromWindow?: boolean; order: number }
interface Shade extends Base { familyId: Id | null; name: string; hex: string; order: number }   // familyId null = a family
interface Place extends Base { homeId: Id | null; name: string; role: 'home' | 'spot' | 'withme'; order: number }
type Fit = 'tight' | 'fits' | 'loose';
type Condition = 'new' | 'good' | 'worn' | 'replace';
type StartWears = { exact: number } | { range: 'never' | '1-5' | '5-20' | '20-50' | '50+' };
interface Rough<T> { value: T; estimate: boolean }
interface Item extends Base {
  name: string; kindId: Id; shadeMain?: Id; shadeSecond?: Id; count: number;
  brand?: string; size?: string; boughtOn?: Rough<string>; shop?: string; price?: Rough<number>; currency: string;
  condition?: Condition; startWears?: StartWears; fit?: Fit; fitNote?: string; tags: string[];
  usualSpotIds: Id[]; spotId?: Id; status: 'owned' | 'gone';
  gone?: { on: string; how: 'sold' | 'donated' | 'given' | 'thrown'; to?: string; amount?: number };
  needsDetails: boolean; hideFromWindow?: boolean; extra: Record<string, string>; createdAt: number;
}
interface Photo extends Base { itemId: Id; role: 'main' | 'original' | 'extra'; blob: Blob; w: number; h: number; closeups?: { x: number; y: number; label: string }[] }
interface ItemEvent { id: Id; itemId: Id; at: number; type: 'added' | 'edited' | 'moved' | 'worn' | 'gone' | 'back'; data?: Record<string, unknown> }
interface SavedSearch extends Base { name: string; query: string }
type FieldKey = 'size' | 'shoeSize' | 'serial' | 'metal' | 'battery';
```

- Produces: `db` (Dexie, name `inventory`, version 1) with tables `items, kinds, shades, places, photos, events, sizes, searches, settings`; `seedIfEmpty(): Promise<void>`; `STARTER_KINDS`, `STARTER_SHADES`.

- [ ] **Step 1: Write the failing test**

```ts
const fams = STARTER_SHADES.filter(s => s.familyId === null);
expect(fams.map(f => f.name)).toEqual(['Black','Grey','White','Beige','Brown','Red','Pink','Orange','Yellow','Green','Blue','Purple']);
expect(STARTER_SHADES.length - fams.length).toBeGreaterThanOrEqual(55);
const red = fams.find(f => f.name === 'Red')!;
expect(STARTER_SHADES.filter(s => s.familyId === red.id).map(s => s.name))
  .toEqual(expect.arrayContaining(['Burgundy','Maroon','Oxblood','Wine','Crimson']));
expect(STARTER_SHADES.every(s => /^#[0-9A-F]{6}$/.test(s.hex))).toBe(true);
const tops = STARTER_KINDS.find(k => k.name === 'Tops')!;
expect(STARTER_KINDS.find(k => k.name === 'Tees')!.parentId).toBe(tops.id);
expect(STARTER_KINDS.find(k => k.name === 'Socks')!.hideFromWindow).toBe(true);
await seedIfEmpty(); await seedIfEmpty();
expect(await db.places.where('role').equals('withme').count()).toBe(1);
```

- [ ] **Step 2:** Run `npx vitest run tests/seed.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Starter kinds: clothing roots Tops (Tees, Shirts, Knitwear, Jackets), Bottoms (Jeans, Trousers, Shorts), Shoes, Accessories (Watches, Bracelets, Rings, Belts, Bags, Socks, Caps), Ethnic, Innerwear; non-clothing roots Electronics, Bags and luggage, Tools, Home, Other. Shoes carry `shoeSize`; Watches carry `metal`, `battery`; Electronics carries `serial`. Each family gets 4 to 6 shades ordered deepest first, with more deep shades than pale ones. Seed one home "Home" and the fixed "With me". Dexie indexes: `items: id, kindId, status, spotId, shadeMain, needsDetails, deletedAt, *tags`; `photos: id, itemId, role`; `events: id, itemId, at`; the rest by `id` plus their parent key.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: types, database and starter kinds, shades and places`.

### Task 3: Trees

**Files:** Create `src/domain/tree.ts`. Test `tests/tree.test.ts`.

**Interfaces:**
- Produces: `ancestors<T>(id, nodes: T[], parentOf: (n: T) => Id | null): Id[]` (nearest first); `descendants(...)`: `Id[]`; `countAtEveryLevel<T>(items: { key: Id; n: number }[], nodes: T[], parentOf): Map<Id, number>`.

- [ ] **Step 1: Write the failing test**

```ts
// Red > Burgundy; Tops > Tees. One burgundy tee (count 1) and socks ×4 under Accessories > Socks.
expect(counts.get(burgundy)).toBe(1); expect(counts.get(red)).toBe(1);
expect(kindCounts.get(tees)).toBe(1); expect(kindCounts.get(tops)).toBe(1);
expect(kindCounts.get(accessories)).toBe(4);            // ×N counts as N
expect(ancestors(tees, kinds, k => k.parentId)).toEqual([tops]);
expect(() => ancestors(a, loop, k => k.parentId)).not.toThrow(); // a cycle stops, never hangs
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with a visited set so a cycle ends the walk.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: tree walks and counts at every level`.

### Task 4: Actions, history, undo, trash

**Files:** Create `src/db/actions.ts`, `src/db/hooks.ts`. Test `tests/actions.test.ts`.

**Interfaces:**
- Consumes: Task 2 `db` and types.
- Produces: `createItemWithPhoto(draft: Partial<Item>, photos: { role: Photo['role']; blob: Blob; w: number; h: number }[]): Promise<Id>`; `updateItem(id, patch)`; `updateMany(ids, patch)`; `moveItems(ids: Id[], spotId: Id | undefined)`; `copyItem(id): Promise<Id>`; `letGo(id, gone: Item['gone'])`; `bringBack(id)`; `trash(ids)`; `restore(ids)`; `sweepTrash(now: number): Promise<number>`; `removeKind(id)`, `removeShade(id)`, `removePlace(id)`; `undoLast(): Promise<string | null>` (returns the label of what was undone); hooks `useItems(filter)`, `useItem(id)`, `usePhoto(itemId, role)`, `useTrees()`.

- [ ] **Step 1: Write the failing tests** (fake-indexeddb)

```ts
const id = await createItemWithPhoto({ name: 'Tee', kindId: tees }, [photo]);
expect((await db.events.where('itemId').equals(id).toArray()).map(e => e.type)).toEqual(['added']);
await moveItems([id], spotA); expect(await undoLast()).toBe('Moved 1 piece');
expect((await db.items.get(id))!.spotId).toBeUndefined();
await trash([id]); expect(await sweepTrash(Date.now() + 29 * DAY)).toBe(0);
expect(await sweepTrash(Date.now() + 31 * DAY)).toBe(1);
expect(await db.photos.where('itemId').equals(id).count()).toBe(0);     // photos go with the item
// Review Focus 2: a failed photo write leaves no item behind
vi.spyOn(db.photos, 'bulkAdd').mockRejectedValueOnce(Object.assign(new Error('q'), { name: 'QuotaExceededError' }));
await expect(createItemWithPhoto({ name: 'X', kindId: tees }, [photo])).rejects.toThrow('Not enough space to save this photo');
expect(await db.items.where('name').equals('X').count()).toBe(0);
// Review Focus 5: removing something in use moves pieces up, never loses them
await removeKind(tees);   expect((await db.items.get(id2))!.kindId).toBe(tops);
await removeShade(burgundy); expect((await db.items.get(id2))!.shadeMain).toBe(red);
await removePlace(spotA); expect((await db.items.get(id2))!.spotId).toBeUndefined();
const c = await copyItem(id2); expect((await db.items.get(c))!.name).toBe('Tee copy');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Every action runs in one Dexie transaction, stamps `updatedAt`, appends an `ItemEvent`, and pushes an inverse onto an in-memory undo stack (depth 20). `copyItem` copies fields and the main photo, resets `startWears`, and names it `<name> copy`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: item actions with history, undo and 30-day trash`.

### Task 5: Colour guessing

**Files:** Create `src/domain/colour.ts`. Test `tests/colour.test.ts`.

**Interfaces:**
- Produces: `hexToLab(hex): [number, number, number]`; `nearestShade(rgb: [number, number, number], shades: Shade[]): Shade` (ΔE76, shades only, never a family); `dominant(pixels: Uint8ClampedArray, opts?: { mergeBelow?: number }): { rgb: [number, number, number]; share: number }[]` (transparent pixels skipped, clusters closer than ΔE 12 merged, largest first); `guessShades(pixels, shades): { main: Shade; second?: Shade }` (second only when its share is at least 0.2).

- [ ] **Step 1: Write the failing test**

```ts
expect(nearestShade([0x6D, 0x1A, 0x2B], STARTER_SHADES).name).toBe('Burgundy');
// the worn black trousers case: three close blacks at 82 / 9 / 3 % become one
const d = dominant(pixelsOf([[20,20,22,.82],[28,28,30,.09],[14,14,16,.03],[240,240,240,.06]]));
expect(d[0].share).toBeCloseTo(0.94, 2); expect(d.length).toBe(2);
expect(guessShades(pixelsOf([[20,20,22,.94],[240,240,240,.06]]), STARTER_SHADES).second).toBeUndefined();
expect(dominant(new Uint8ClampedArray(400))).toEqual([]);   // fully transparent
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement: quantise to 4 bits a channel, count, convert bins to Lab, merge greedily from the largest.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: shade guessing with merging of near-identical colours`.

### Task 6: Mask clean-up, straightening, sizes

**Files:** Create `src/photo/mask.ts`, `src/photo/polish.ts`, `src/photo/encode.ts`. Test `tests/mask.test.ts`, `tests/polish.test.ts`.

**Interfaces:**
- Produces: `cleanMask(alpha: Uint8Array, w: number, h: number): Uint8Array | null` (threshold 128 → open with radius 3 → fill holes from outside → keep the component nearest the centre → 1 px blur; `null` when the kept area is under 2 % or over 95 % of the frame); `tiltDegrees(mask, w, h): number` (principal axis, clamped to ±20, 0 when under 3); `fitWithin(w, h, longEdge): { w: number; h: number }`; `LONG_EDGE = { original: 1600, cutout: 1000 }`; `toWebp(canvas, quality = 0.85): Promise<Blob>`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(cleanMask(blobAtCentrePlusSpeckInCorner, 40, 40)![cornerIndex]).toBe(0);   // speck removed
expect(cleanMask(ringWithHole, 40, 40)![holeIndex]).toBe(255);                    // hole filled
expect(cleanMask(new Uint8Array(1600), 40, 40)).toBeNull();                       // Review Focus 3: empty
expect(cleanMask(new Uint8Array(1600).fill(255), 40, 40)).toBeNull();             // Review Focus 3: whole frame
expect(tiltDegrees(rectTiltedBy(10), 80, 80)).toBeCloseTo(10, 0);
expect(tiltDegrees(rectTiltedBy(1), 80, 80)).toBe(0);
expect(fitWithin(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
expect(fitWithin(800, 600, 1600)).toEqual({ w: 800, h: 600 });                    // never enlarges
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement on plain typed arrays so the tests need no canvas.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: cut-out clean-up, straightening and photo sizes`.

### Task 7: Camera and the cut-out worker (with the S23 speed check)

**Files:** Create `src/photo/camera.ts`, `src/photo/cutout.worker.ts`, `src/photo/cutout.ts`. Test `tests/cutout.test.ts`.

**Interfaces:**
- Consumes: Task 6 `cleanMask`, `tiltDegrees`, `fitWithin`, `toWebp`.
- Produces: `openCamera(video: HTMLVideoElement): Promise<{ shoot(): Promise<ImageBitmap>; stop(): void }>` (rear camera, falls back to a file input with `capture="environment"`); `cutOut(bitmap: ImageBitmap): Promise<{ original: Blob; cutout: Blob | null; w: number; h: number; pixels: Uint8ClampedArray | null }>` (`cutout: null` means keep the uncut photo); `modelState(): 'missing' | 'loading' | 'ready'`; `loadModel(onProgress: (fraction: number) => void): Promise<void>`; `queue: { add(bitmap): Id; onDone(cb) }` (one cut-out at a time, shooting never waits).

- [ ] **Step 1: Write the failing test** (worker replaced by a stub that returns a given alpha)

```ts
const r = await cutOut(bitmap, { runModel: async () => emptyAlpha });
expect(r.cutout).toBeNull(); expect(r.original).toBeInstanceOf(Blob);   // falls back, keeps the photo
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The worker loads `briaai/RMBG-1.4` through `@huggingface/transformers` with `device: 'webgpu'` when available, else `wasm` with `dtype: 'q8'`, as the October test page did (commit `b3f507b`, `bg-test/index.html`, before Task 1 deletes it).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Speed check on the phone.** Run `npm run build && npm run preview -- --host`, open it on the S23 over Wi-Fi, load the model, cut out five photos. Record seconds per photo and the model download size in `docs/superpowers/notes/2026-11-cutout-s23.md`. If the median is over 20 seconds, stop and tell the owner before continuing: the fallback is cutting out in the background after the shooting session, which the queue already supports.
- [ ] **Step 6:** Commit: `feat: camera capture and on-phone cut-out`.

### Task 8: The Shop Window kit

**Files:** Create `src/ui/Window.tsx`, `Tile.tsx`, `Numeral.tsx`, `Chips.tsx`, `Seg.tsx`, `TabBar.tsx`, `Sheet.tsx`, `Toast.tsx`, `icons.tsx`; extend `src/styles/base.css`. Test `tests/ui.test.ts`.

**Interfaces:**
- Produces: `<Window colour={hex} lit={boolean} delay={ms}>`; `<Tile item photo onPress selected />` (three across, name under, never a price); `<Numeral value roll />`; `<Chips options value onChange />`; `<Seg options value onChange />`; `<TabBar current />` (Wardrobe · Things · + · Wishes · Home; Wishes and Home show "Coming in the next build" in Build 1); `<Sheet>`; `showToast(label: string, undo?: () => void)`; pure helpers `windowColour(hex: string): string` and `rollFrames(to: number, steps: number): number[]`.

- [ ] **Step 1: Write the failing test**

```ts
expect(rollFrames(47, 5).at(-1)).toBe(47);
expect(rollFrames(47, 5)).toEqual([...rollFrames(47, 5)].sort((a, b) => a - b));   // never counts down
expect(lightness(windowColour('#F2EFE8'))).toBeLessThanOrEqual(0.5);  // a white piece still gets a visible pool
expect(lightness(windowColour('#0E0E10'))).toBeGreaterThanOrEqual(0.22); // a black piece is not lost on the dark pane
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement to match `design/inventory-look-board-3.html` (classes `.win`, `.tile`, `.chip`, `.seg2`, `.acc`, `.ghost`, `.nav`, `.stamp`): radial pool in the piece's colour, darker floor, cut-outs with the faint rim light, light-up on mount with exponential ease-out and a 50 ms stagger. Scale the board's sizes by 1.2 (the board is drawn at 300 px for a 360 px screen). No `prefers-reduced-motion` branch.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: Shop Window components`.

### Task 9: Wardrobe and Things

**Files:** Create `src/domain/window.ts`, `src/screens/Browse.tsx`, `Wardrobe.tsx`, `Things.tsx`, `SpotPage.tsx`. Test `tests/window.test.ts`.

**Interfaces:**
- Consumes: Tasks 3, 4, 8.
- Produces: `pickWindowPiece(items: Item[], kinds: Kind[], lastWorn: Map<Id, number>, now: number, seed: number): { item: Item; reason: string } | null`; `sortItems(items, by: 'kind' | 'added' | 'lastWorn' | 'name')`.

- [ ] **Step 1: Write the failing test**

```ts
// rule order: added in the last 2 days → "added yesterday"/"added today";
// else the owned clothing piece unworn longest, if over 10 days → "not worn for 13 days";
// else a seeded random piece → "from your wardrobe"
expect(pickWindowPiece([jacket13DaysAgo, tee1DayAgo], kinds, worn, now, 1)!.reason).toBe('not worn for 13 days');
expect(pickWindowPiece([newHeadphones], kinds, worn, now, 1)!.reason).toBe('added yesterday');
expect(pickWindowPiece([socks], kinds, worn, now, 1)).toBeNull();                 // kind hidden from the window
expect(pickWindowPiece([{ ...jacket13DaysAgo, hideFromWindow: true }], kinds, worn, now, 1)).toBeNull();
expect(pickWindowPiece([goneJeans], kinds, worn, now, 1)).toBeNull();
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the rule, then the screens: window header with the rolling count and the picked piece (long-press offers "Don't show this in the window" and "Don't show any <kind>"); `Seg` By kind / By colour / By place; kind chips with counts from `countAtEveryLevel`; three-across grid grouped by kind; By colour as one window per family, the open one listing its shades deepest first with counts; By place as shelves per home (count, name, up to three pieces standing on it) and "With me"; `SpotPage` lists a spot's pieces. A view menu offers grid or list and the four sorts. With no items, the window says "Nothing here yet" with the blue "Add your first piece" button.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: wardrobe and things, browsable by kind, colour and place`.

### Task 10: Search and saved searches

**Files:** Create `src/domain/search.ts`, `src/screens/Search.tsx`. Test `tests/search.test.ts`.

**Interfaces:**
- Produces: `Query = { text?: string; kindId?: Id; shadeId?: Id; spotId?: Id; fit?: Fit; tag?: string; brand?: string; needsDetails?: boolean; gone?: boolean }`; `matches(item: Item, q: Query, trees: { kinds: Kind[]; shades: Shade[]; places: Place[] }): boolean`; `encodeQuery(q): string`; `decodeQuery(s): Query`.

- [ ] **Step 1: Write the failing test**

```ts
expect(matches(burgundyTee, { shadeId: red }, trees)).toBe(true);        // a family matches its shades
expect(matches(burgundyTee, { kindId: tops }, trees)).toBe(true);
expect(matches(burgundyTee, { text: 'UNIQ' }, trees)).toBe(true);        // brand, case-insensitive
expect(matches(goneJeans, {}, trees)).toBe(false);                       // gone hidden unless asked
expect(matches(goneJeans, { gone: true }, trees)).toBe(true);
expect(decodeQuery(encodeQuery({ fit: 'tight', kindId: tops }))).toEqual({ fit: 'tight', kindId: tops });
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; the screen has one text box, filter chips, results as tiles, and "Save this search".
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: search, filters and saved searches`.

### Task 11: The piece page

**Files:** Create `src/domain/wears.ts`, `src/domain/estimate.ts`, `src/domain/format.ts`, `src/screens/Piece.tsx`. Test `tests/wears.test.ts`, `tests/estimate.test.ts`.

**Interfaces:**
- Produces: `startCount(s?: StartWears): { n: number; approx: boolean; atLeast: boolean }` (ranges use the middle: `1-5` → 3, `5-20` → 12, `20-50` → 35, `50+` → 50 with `atLeast`); `totalWears(item, logged: number)`; `costPerWear(price: Rough<number> | undefined, wears): { text: string } | null`; `parseRoughDate(s: string): Rough<string> | null`; `parseRoughPrice(s: string): Rough<number> | null`; `money(n: number, currency: string): string`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(costPerWear({ value: 6990, estimate: false }, { n: 30, approx: true, atLeast: false })!.text).toBe('about ₹230 a wear');
expect(costPerWear({ value: 6990, estimate: false }, { n: 30, approx: false, atLeast: false })!.text).toBe('₹233 a wear');
expect(costPerWear({ value: 5000, estimate: false }, startCount({ range: '50+' }))!.text).toBe('under ₹100 a wear');
expect(costPerWear(undefined, startCount({ exact: 10 }))).toBeNull();                       // Review Focus 4
expect(costPerWear({ value: 999, estimate: false }, startCount({ range: 'never' }))).toBeNull();
expect(parseRoughDate('about 2023')).toEqual({ value: '2023', estimate: true });
expect(parseRoughDate('Jan 2024')).toEqual({ value: '2024-01', estimate: false });
expect(parseRoughPrice('about ₹800')).toEqual({ value: 800, estimate: true });
expect(parseRoughPrice('6,990')).toEqual({ value: 6990, estimate: false });
expect(parseRoughPrice('cheap')).toBeNull();
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement (approximate values round to the nearest ₹10; an estimated price also makes the result "about"), then the screen in this order: the piece in its window with photo paging and close-up spots; name; shade · brand · size; fit and condition chips; spot row with "Move"; wears as a large numeral with "last worn"; a small line with bought date, price and cost per wear; "Worn today" (blue, adds a `worn` event), "Copy", "Edit". Edit uses the same fields as Task 12's details screen plus "Let it go" and "Don't show in the window". A gone piece shows an unlit window, the "Gone" stamp, "Its story" from `events`, and "Bring it back".
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: piece page with wears, cost per wear and gone history`.

### Task 12: Adding, details, batch edit

**Files:** Create `src/domain/fields.ts`, `src/screens/Camera.tsx`, `src/screens/Details.tsx`; extend `Browse.tsx` with selection mode. Test `tests/fields.test.ts`.

**Interfaces:**
- Consumes: Task 4 actions, Task 5 `guessShades`, Task 7 `queue`, Task 11 parsers.
- Produces: `fieldsFor(kindId: Id, kinds: Kind[]): FieldKey[]` (own fields plus every ancestor's, `size` for any clothing kind); `nextNeedingDetails(items: Item[]): Item | undefined` (oldest first).

- [ ] **Step 1: Write the failing test**

```ts
expect(fieldsFor(tees, kinds)).toEqual(['size']);
expect(fieldsFor(watches, kinds)).toEqual(expect.arrayContaining(['metal', 'battery']));
expect(fieldsFor(shoes, kinds)).toContain('shoeSize'); expect(fieldsFor(shoes, kinds)).not.toContain('size');
expect(fieldsFor(electronics, kinds)).toEqual(['serial']);
expect(nextNeedingDetails([b2, a1])!.id).toBe(a1.id);
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Camera: full-height viewfinder, hint "Lay it flat, whole piece in frame", shutter, a strip of the last shots, a rolling "N shot", "Done". Each shot becomes an item at once (`needsDetails: true`, name "New piece", kind = the last kind used) and joins the cut-out queue; shades are filled when its cut-out lands. Details, one piece at a time: "Looks like" (kind and shade chips, "Change"), "How many times have you worn it?" (Never, 1–5, 5–20, 20–50, 50+, Exact), "When and for how much? A guess is fine." (two fields through `parseRoughDate` and `parseRoughPrice`), "How does it fit now?", "Where does it live?", the kind's extra fields, then "Skip" and "Save and next". Selection mode: long-press a tile, then a bottom sheet "Move N pieces to" with spot chips, plus "Edit" (kind, tags, fit, spot for all) and "Let go". The sheet must not cover the last row: the grid gets bottom padding equal to the sheet's height.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: camera-first adding, details queue and batch edit`.

### Task 13: Reading receipts and order screenshots

**Files:** Create `src/read/parse.ts`, `src/read/reader.ts`, `tests/fixtures/receipts/*.txt`. Test `tests/parse.test.ts`.

**Interfaces:**
- Produces: `parseReceipt(text: string): { shop?: string; date?: string; price?: number; name?: string; size?: string }`; `readImage(blob: Blob): Promise<string>` (loads `tesseract.js` and English data on first use; cached by the service worker after).

- [ ] **Step 1: Write the failing test** with four fixture texts written to look like what the reader returns: a Myntra order screen, an Amazon order screen, a printed shop bill, and nonsense.

```ts
expect(parseReceipt(myntra)).toMatchObject({ shop: 'Myntra', price: 1299, size: 'M', date: '2026-10-04' });
expect(parseReceipt(amazon)).toMatchObject({ shop: 'Amazon', price: 2499 });
expect(parseReceipt(bill).price).toBe(3450);            // the total, not a line item or the GST line
expect(parseReceipt(nonsense)).toEqual({});             // never invents values
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. On the details screen add "Read a receipt or order screenshot": pick an image, show each value found as an editable field marked "read from the photo", and save only what the owner leaves ticked. If nothing is found, say "Couldn't read anything useful from that photo."
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: read receipts and order screenshots as editable guesses`.

### Task 14: Fit and my sizes

**Files:** Create `src/screens/Sizes.tsx`; add `fitSummary` to `src/domain/wears.ts`. Test `tests/fit.test.ts`.

**Interfaces:**
- Produces: `fitSummary(items: Item[], kinds: Kind[]): { fits: number; tight: number; loose: number; unset: number }` (owned clothing only, ×N counted as N).

- [ ] **Step 1: Write the failing test**

```ts
expect(fitSummary([fitsTee, tightJeans, looseShirt, headphones, goneJeans, socksX4Fits], kinds))
  .toEqual({ fits: 5, tight: 1, loose: 1, unset: 0 });
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement, then the screen: measurements as large numerals in a two-column grid (chest, waist, hip, shoulder, sleeve, inseam; inches or centimetres, chosen once), "Brand by brand" rows (brand, size, note), then "How it all fits now" as one bar in green, amber and blue-grey with the three counts as text beside it. The wardrobe header shows "N fit now"; tapping it filters to `fit: 'fits'`. Reached from the wardrobe's menu.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: my sizes and fit summary`.

### Task 15: Backup and export

**Files:** Create `src/domain/csv.ts`, `src/backup/file.ts`, `src/backup/google.ts`, `src/backup/drive.ts`, `src/screens/Settings.tsx`. Test `tests/backup.test.ts`, `tests/csv.test.ts`.

**Interfaces:**
- Produces: `toCsv(items, trees): string`; `exportAll(): Promise<Blob>` (zip: `data.json` with `{ version: 1, tables }`, `photos/<id>.webp`); `importAll(zip: Blob): Promise<{ items: number; photos: number }>`; `backupToDrive(): Promise<{ uploaded: number }>`; `lastBackup(): Promise<number | null>`.

- [ ] **Step 1: Write the failing tests**

```ts
const zip = await exportAll(); await db.delete(); await db.open();
expect(await importAll(zip)).toEqual({ items: 3, photos: 5 });
expect(await db.items.count()).toBe(3);
await expect(importAll(zipWithVersion(2))).rejects.toThrow('This backup was made by a newer version of Inventory');
await expect(importAll(new Blob(['nope']))).rejects.toThrow('This file is not an Inventory backup');
expect(toCsv([tee], trees).split('\n')[0]).toBe('name,kind,colour,second colour,count,brand,size,bought,price,currency,condition,fit,spot,status,tags');
expect(toCsv([{ ...tee, name: 'Tee, "old"' }], trees)).toContain('"Tee, ""old"""');
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the file backup with `fflate`. Port `../Media/src/sync/google.ts` and `drive.ts` for Drive: scope `drive.file`, an "Inventory" folder, one file per photo named by id and `updatedAt`, `data.json` replaced each run, only changed photos uploaded. Read the client id from the owner's private starter file and never commit it. Check every sign-in return path (popup, redirect, reload) validates `state` against a stored pending request and strips the token from the URL. Settings shows last backup time, "Back up now", "Save a backup file", "Restore from a file", "Export a spreadsheet", storage used, and Trash.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Drive sign-in check.** In the built preview, sign in and run one backup, then a second with one new piece. Expected: second run reports `uploaded: 1`. If sign-in cannot be made to work, leave the Drive rows out of Settings, keep the file backup, and tell the owner; this is the fallback the spec allows.
- [ ] **Step 6:** Commit: `feat: backup file, restore, spreadsheet export and Drive backup`.

### Task 16: Whole-build verification

**Files:** Create `docs/superpowers/notes/2026-11-build-1-verification.md`, `README.md`; modify whatever the checks turn up.

- [ ] **Step 1:** Run `TZ=UTC npm test` and `npm test`. Expected: both PASS. Run `npm run typecheck`. Expected: no errors.
- [ ] **Step 2:** Run `npm run build && npm run preview`. At 360 × 745 and 340 × 700, open every screen beside `design/inventory-look-board-3.html` at 360 px and note differences. Measure: text nodes under 14 px (expected 0), tap targets under 44 px (expected 0), text contrast under 4.5:1 (expected 0), horizontal scroll (expected none), and content hidden under the tab bar or a sheet (expected none).
- [ ] **Step 3 (Review Focus 1):** In the same built preview: load the model, read one receipt, then stop the preview server and reload. Expected: the app opens, the wardrobe shows, a new photo is cut out, and a receipt is read, all with no network.
- [ ] **Step 4:** Walk the empty state, one piece, and a seeded 300 pieces (script `scripts/seed-300.mjs`, dev only): scrolling the wardrobe stays smooth, and the count, kind chips, colour families and shelves all agree.
- [ ] **Step 5:** Write the verification note: what ran, under which environment, every number measured, and anything not verified. Commit: `docs: build 1 verification`.
- [ ] **Step 6:** Request the one full review (superpowers:requesting-code-review). Do not push; the owner enables Pages and says when.

---

## Self-review notes

- **Spec coverage:** every Build 1 row of spec section 5 maps to a task: wardrobe and views (9), search (10), counts and trees (3, 9), copy, condition, starting wears, accessories, tags, extra photos and close-ups (4, 11, 12), camera, burst, cut-out, polish (6, 7, 12), batch edit and fields by kind (12), receipts (13), fit and sizes (14), places and move many (4, 9, 12), things and item history (4, 9, 11), gone (4, 11), offline, backup, export, trash, undo, select many, motion (1, 4, 8, 12, 15, 16).
- **Not in this plan, on purpose:** "throw to a place" is built as the move sheet in Task 12; the flick gesture itself is added in the final polish only if the sheet version tests well, since the spec lists both. Burst capture is the conveyor itself (shoot without waiting), not a separate mode.
- **One spec correction made while planning:** the app guesses colour but cannot guess a garment's kind; the kind defaults to the last one used. The spec now says so.
