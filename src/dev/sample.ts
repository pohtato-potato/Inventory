// Dev only: fills the app with sample pieces using the look board's example cut-outs.
// Open #/wardrobe?devseed=12 (or 300) on the dev server. Never shipped: main.tsx imports it only in DEV.
import { db } from '../db/db';
import { addPlace, addWish, buyWish, clearUndo, createItemWithPhoto, logWear, saveOutfit, savePhotos, updateWish } from '../db/actions';
import { dayKey, shiftDay } from '../domain/wearlog';
import { seedIfEmpty } from '../db/seed';
import type { Item } from '../domain/types';

const SAMPLES: [photo: string, name: string, kindId: string, shade: string][] = [
  ['flat-jacket-leather', 'Leather jacket', 'k-jackets', 's-black-soft-black'],
  ['flat-jeans-blue', 'Blue jeans', 'k-jeans', 's-blue-indigo'],
  ['flat-tee-white', 'White tee', 'k-tees', 's-white-off-white'],
  ['white-sneakers', 'Sneakers', 'k-shoes', 's-white-white'],
  ['flat-tee-black', 'Graphic tee', 'k-tees', 's-black-jet'],
  ['floral-shirt', 'Floral shirt', 'k-shirts', 's-red-burgundy'],
  ['flat-chinos', 'Cargo trousers', 'k-trousers', 's-green-olive'],
  ['white-shirt', 'Crew tee', 'k-tees', 's-grey-light-grey'],
  ['brown-loafers', 'Loafers', 'k-shoes', 's-brown-chestnut'],
  ['black-watch', 'Field watch', 'k-watches', 's-black-faded-black'],
  ['silver-watch', 'Steel watch', 'k-o-electronics', 's-grey-light-grey'],
  ['headphones', 'Headphones', 'k-o-electronics', 's-black-charcoal-black'],
];

async function photos(): Promise<Record<string, string>> {
  const txt = await (await fetch('/design/inventory-photos.js')).text();
  return JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
}

export async function devSeed(n: number) {
  await seedIfEmpty();
  if ((await db.items.count()) > 0) return;
  const ph = await photos();
  const spots = [await addPlace('Cupboard, left rail', 'p-home'), await addPlace('Cupboard, top shelf', 'p-home'), await addPlace('Shoe rack', 'p-home')];
  const blobs = new Map<string, { blob: Blob; w: number; h: number }>();
  for (const [p] of SAMPLES) {
    const blob = await (await fetch(ph[p])).blob();
    const bmp = await createImageBitmap(blob);
    blobs.set(p, { blob, w: bmp.width, h: bmp.height });
  }
  const DAY = 864e5;
  for (let i = 0; i < n; i++) {
    const [p, name, kindId, shade] = SAMPLES[i % SAMPLES.length];
    const b = blobs.get(p)!;
    const draft: Partial<Item> = {
      name: i < SAMPLES.length ? name : `${name} ${Math.floor(i / SAMPLES.length) + 1}`,
      kindId, shadeMain: shade, spotId: spots[i % 4] ?? undefined,
      fit: (['fits', 'fits', 'fits', 'tight', 'loose'] as const)[i % 5],
      brand: ['Uniqlo', 'Zara', "Levi's", 'H&M'][i % 4], size: 'M',
      createdAt: Date.now() - (20 + i) * DAY,
      startWears: { range: '5-20' },
      price: { value: 999 + i * 10, estimate: i % 2 === 0 },
      condition: 'good',
    };
    await createItemWithPhoto(draft, [{ role: 'main', ...b }]);
  }
  await seedLife(n, blobs);
  clearUndo();
}

/** A stand-in mirror photo: a grey figure on a dark ground, as on the look board. */
async function mirrorShot(tint: string): Promise<{ blob: Blob; w: number; h: number }> {
  const c = new OffscreenCanvas(600, 900);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, 900);
  bg.addColorStop(0, '#3A3D44'); bg.addColorStop(1, '#22242A');
  g.fillStyle = bg; g.fillRect(0, 0, 600, 900);
  g.fillStyle = '#6B6E78';
  g.beginPath(); g.arc(300, 170, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = tint;
  g.beginPath(); g.moveTo(180, 270); g.lineTo(420, 270); g.lineTo(450, 560); g.lineTo(150, 560); g.closePath(); g.fill();
  g.fillStyle = '#2F4E86';
  g.fillRect(190, 560, 100, 300); g.fillRect(310, 560, 100, 300);
  return { blob: await c.convertToBlob({ type: 'image/webp', quality: 0.8 }), w: 600, h: 900 };
}

/** Wears, outfits, wishes and mirror photos, so Home, the wear log, Wishes, Numbers and the year can be seen filled. */
async function seedLife(n: number, blobs: Map<string, { blob: Blob; w: number; h: number }>) {
  const items = await db.items.toArray();
  const by = (kinds: string[]) => items.filter((i) => kinds.includes(i.kindId));
  const tops = by(['k-tees', 'k-shirts']), outer = by(['k-jackets']), bottoms = by(['k-jeans', 'k-trousers']), shoes = by(['k-shoes']), watches = by(['k-watches']);
  const pick = <T,>(list: T[], i: number) => list[i % list.length];
  // Outfits: a top, a bottom, shoes, sometimes a watch or a jacket. The first is "Office, most days".
  const outfitIds: string[] = [];
  const count = Math.min(n >= 100 ? 8 : 4, tops.length * bottoms.length);
  for (let i = 0; i < count; i++) {
    const ids = [pick(tops, i).id, pick(bottoms, i + (i >> 1)).id, pick(shoes, i).id];
    if (i % 2 === 0 && watches.length) ids.push(pick(watches, i).id);
    if (i === 3 && outer.length) ids.push(outer[0].id);
    const { id } = await saveOutfit(ids, i === 0 ? 'Office, most days' : i === 1 ? 'Weekend' : undefined, i === 0 ? ['Smart casual'] : i === 1 ? ['Casual'] : []);
    outfitIds.push(id);
  }
  const outfits = await db.outfits.toArray();
  // Wears: most days for the last 60 (a year with 100 or more pieces). Mondays are the office outfit; the last
  // saved outfit is never worn.
  const today = dayKey(Date.now());
  const span = n >= 100 ? 365 : 60;
  for (let d = span; d >= 1; d--) {
    if (d % 9 === 4) continue;
    const day = shiftDay(today, -d);
    const wd = new Date(`${day}T12:00:00`).getDay();
    const o = wd === 1 ? outfits[0] : outfits[(d % Math.max(1, outfits.length - 1))];
    if (!o) break;
    await logWear(day, o.itemIds, o.id);
  }
  // Mirror photos: two on the office outfit (swipe to the older), one on a day the weekend outfit was worn.
  await savePhotos(outfitIds[0], [{ role: 'selfie', ...(await mirrorShot('#68727C')) }]);
  await new Promise((r) => setTimeout(r, 5));
  await savePhotos(outfitIds[0], [{ role: 'selfie', ...(await mirrorShot('#8A9AA6')) }]);
  const weekendDay = (await db.wears.toArray()).filter((w) => w.outfitId === outfitIds[1]).at(-1);
  if (weekendDay) await savePhotos(weekendDay.id, [{ role: 'selfie', ...(await mirrorShot('#7A2F45')) }]);
  // Wishes: a few per tier, one waiting, one for someone, one bought 30 days ago (Home asks "glad you bought it?").
  const WISHES: [photo: string | null, name: string, tier: 'now' | 'soon' | 'someday', shop: string, price: number, kindId?: string, shade?: string][] = [
    ['brown-loafers', 'Leather loafers', 'now', 'Myntra', 4999, 'k-shoes', 's-brown-chestnut'],
    ['white-shirt', 'Heavy white tee', 'now', 'Uniqlo', 1490, 'k-tees', 's-white-white'],
    ['flat-jacket-leather', 'Bomber jacket', 'now', 'Zara', 7990, 'k-jackets', 's-black-jet'],
    ['headphones', 'Headphones', 'now', 'Amazon', 6900, 'k-o-electronics'],
    ['floral-shirt', 'Printed shirt', 'soon', 'Ajio', 2290, 'k-shirts', 's-red-burgundy'],
    [null, 'Rain jacket', 'someday', 'Decathlon', 3499, 'k-jackets'],
  ];
  const total = n >= 100 ? 40 : WISHES.length;
  for (let i = 0; i < total; i++) {
    const [p, name, tier, shop, price, kindId, shadeId] = WISHES[i % WISHES.length];
    const id = await addWish({ name: i < WISHES.length ? name : `${name} ${Math.floor(i / WISHES.length) + 1}`, tier, shop, price: { value: price, estimate: false }, ...(kindId ? { kindId } : {}), ...(shadeId ? { shadeId } : {}), source: 'hand' }, p ? { blob: blobs.get(p)!.blob, w: blobs.get(p)!.w, h: blobs.get(p)!.h } : undefined);
    await db.wishes.update(id, { createdAt: Date.now() - (14 - (i % 14)) * 864e5 });
    if (i === 2) await updateWish(id, { waitUntil: { date: shiftDay(today, 15) } });
    if (i === 4) await updateWish(id, { forWhom: 'my brother' });
  }
  const gladId = await addWish({ name: 'Brown loafers', tier: 'now', kindId: 'k-shoes', shadeId: 's-brown-chestnut', shop: 'Myntra', price: { value: 3999, estimate: false } }, { ...blobs.get('brown-loafers')! });
  await buyWish(gladId, { boughtOn: shiftDay(today, -30) });
}
