import type { FieldKey, Kind, Place, Shade } from '../domain/types';
import { db } from './db';

const T0 = 0; // starter rows carry updatedAt 0 so any edit by the owner is newer

type K = [name: string, fields?: FieldKey[], hide?: boolean];
const CLOTHING: [K, K[]][] = [
  [['Tops'], [['Tees'], ['Shirts'], ['Knitwear'], ['Jackets']]],
  [['Bottoms'], [['Jeans'], ['Trousers'], ['Shorts']]],
  [['Shoes', ['shoeSize']], []],
  [['Accessories'], [['Watches', ['metal', 'battery']], ['Bracelets'], ['Rings'], ['Belts'], ['Bags'], ['Socks', [], true], ['Caps']]],
  [['Ethnic'], []],
  [['Innerwear', [], true], []],
];
const OTHER: K[] = [['Electronics', ['serial']], ['Bags and luggage'], ['Tools'], ['Home'], ['Other']];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function buildKinds(): Kind[] {
  const out: Kind[] = [];
  let order = 0;
  const add = ([name, fields = [], hide]: K, parentId: string | null, clothing: boolean, prefix = '') => {
    const kind: Kind = { id: `k-${prefix}${slug(name)}`, parentId, name, clothing, fields, order: order++, updatedAt: T0 };
    if (hide) kind.hideFromWindow = true;
    out.push(kind);
    return kind.id;
  };
  for (const [root, kids] of CLOTHING) {
    const id = add(root, null, true);
    for (const k of kids) add(k, id, true);
  }
  for (const k of OTHER) add(k, null, false, 'o-');
  return out;
}

/** Families in order; each family's shades deepest first, with more deep shades than pale. */
const FAMILIES: [name: string, hex: string, shades: [string, string][]][] = [
  ['Black', '#16161A', [['Jet', '#0E0E10'], ['Soft black', '#1C1C1F'], ['Charcoal black', '#2A2A2E'], ['Faded black', '#3A3A3F'], ['Washed black', '#4A4A50']]],
  ['Grey', '#6E7178', [['Graphite', '#3B3D42'], ['Charcoal', '#4A4D53'], ['Slate', '#5E636B'], ['Grey', '#808389'], ['Light grey', '#B5B7BA']]],
  ['White', '#EEECE6', [['Stone', '#D9D6CE'], ['Ivory', '#E9E4D6'], ['Cream', '#EDE3CC'], ['Off-white', '#E9E6DF'], ['White', '#F7F7F5']]],
  ['Beige', '#C7B694', [['Taupe', '#8B7D6B'], ['Khaki', '#A89770'], ['Sand', '#C2B28F'], ['Beige', '#D6C7A8'], ['Oat', '#E2D7BF']]],
  ['Brown', '#6B3F28', [['Chocolate', '#3B2418'], ['Coffee', '#4E3324'], ['Chestnut', '#6B3A26'], ['Cognac', '#8A4A2A'], ['Tan', '#A0703F'], ['Camel', '#B88B57']]],
  ['Red', '#A3202F', [['Oxblood', '#4A0F17'], ['Maroon', '#5C1423'], ['Burgundy', '#6D1A2B'], ['Wine', '#722F37'], ['Crimson', '#A3162F'], ['Red', '#C8282E']]],
  ['Pink', '#D97C98', [['Raspberry', '#8A1F4F'], ['Rose', '#B5546B'], ['Dusty pink', '#C98A93'], ['Pink', '#E58FA8'], ['Blush', '#EFC4C4']]],
  ['Orange', '#D9682A', [['Rust', '#8B3A1A'], ['Burnt orange', '#B3501E'], ['Terracotta', '#C0603F'], ['Orange', '#E57A2E'], ['Peach', '#F2B38A']]],
  ['Yellow', '#D9B53A', [['Ochre', '#A87A1E'], ['Mustard', '#C49A2C'], ['Gold', '#D4A73A'], ['Yellow', '#E8CB4A'], ['Lemon', '#F2E38A']]],
  ['Green', '#3F6B45', [['Bottle green', '#133D2B'], ['Forest', '#1F4D33'], ['Olive', '#556B2F'], ['Sage', '#8A9A7B'], ['Mint', '#A8D5BA']]],
  ['Blue', '#2F4E86', [['Midnight', '#14193A'], ['Ink', '#20263F'], ['Navy', '#1F2F57'], ['Indigo', '#3F5F96'], ['Denim', '#4F6D9A'], ['Sky', '#8FB4DC']]],
  ['Purple', '#5E3A80', [['Aubergine', '#3A1F35'], ['Plum', '#5A2A52'], ['Purple', '#6B3A8C'], ['Mauve', '#9A7090'], ['Lavender', '#B8A6D6']]],
];

function buildShades(): Shade[] {
  const out: Shade[] = [];
  FAMILIES.forEach(([name, hex, shades], fi) => {
    const fid = `s-${slug(name)}`;
    out.push({ id: fid, familyId: null, name, hex, order: fi, updatedAt: T0 });
    shades.forEach(([n, h], i) => out.push({ id: `${fid}-${slug(n)}`, familyId: fid, name: n, hex: h, order: i, updatedAt: T0 }));
  });
  return out;
}

export const STARTER_KINDS: Kind[] = buildKinds();
export const STARTER_SHADES: Shade[] = buildShades();
export const WITH_ME_ID = 'p-withme';
export const STARTER_PLACES: Place[] = [
  { id: 'p-home', homeId: null, name: 'Home', role: 'home', order: 0, updatedAt: T0 },
  { id: WITH_ME_ID, homeId: null, name: 'With me', role: 'withme', order: 999, updatedAt: T0 },
];

/** Fills the starter kinds, shades and places the first time the app opens. Safe to call every start. */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.kinds, db.shades, db.places, async () => {
    if ((await db.kinds.count()) === 0) await db.kinds.bulkAdd(STARTER_KINDS);
    if ((await db.shades.count()) === 0) await db.shades.bulkAdd(STARTER_SHADES);
    if ((await db.places.count()) === 0) await db.places.bulkAdd(STARTER_PLACES);
    else if (!(await db.places.get(WITH_ME_ID))) await db.places.add(STARTER_PLACES[1]);
  });
}
