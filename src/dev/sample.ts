// Dev only: fills the app with sample pieces using the look board's example cut-outs.
// Open #/wardrobe?devseed=12 (or 300) on the dev server. Never shipped: main.tsx imports it only in DEV.
import { db } from '../db/db';
import { addPlace, createItemWithPhoto } from '../db/actions';
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
}
