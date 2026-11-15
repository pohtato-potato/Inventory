import { roughDateText } from './format';
import type { Item, Kind, Place, Shade } from './types';

export interface CsvTrees {
  kinds: Kind[];
  shades: Shade[];
  places: Place[];
}

const HEADER = ['name', 'kind', 'colour', 'second colour', 'count', 'brand', 'size', 'bought', 'price', 'currency', 'condition', 'fit', 'spot', 'status', 'tags'];

/** One cell: quoted when it holds a comma, quote or line break; a leading = + - @ is defused so a spreadsheet never runs it. */
function cell(v: string | number | undefined): string {
  let s = v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A spreadsheet of every piece not in the trash, in plain words. */
export function toCsv(items: Item[], trees: CsvTrees): string {
  const name = <T extends { id: string; name: string }>(list: T[], id?: string) => (id ? list.find((x) => x.id === id)?.name ?? '' : '');
  const spot = (id?: string) => {
    const p = trees.places.find((x) => x.id === id);
    if (!p) return '';
    const home = p.homeId ? trees.places.find((x) => x.id === p.homeId) : undefined;
    return home ? `${home.name} / ${p.name}` : p.name;
  };
  const rows = items
    .filter((i) => !i.deletedAt)
    .map((i) => [
      i.name, name(trees.kinds, i.kindId), name(trees.shades, i.shadeMain), name(trees.shades, i.shadeSecond), i.count, i.brand, i.size,
      roughDateText(i.boughtOn), i.price ? `${i.price.estimate ? 'about ' : ''}${i.price.value}` : '', i.currency, i.condition, i.fit,
      spot(i.spotId), i.status, i.tags.join('; '),
    ].map(cell).join(','));
  return [HEADER.join(','), ...rows].join('\n');
}
