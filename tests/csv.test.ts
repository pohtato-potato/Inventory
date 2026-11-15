import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_PLACES, STARTER_SHADES } from '../src/db/seed';
import { toCsv } from '../src/domain/csv';
import type { Item } from '../src/domain/types';

const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: STARTER_PLACES };
const tee: Item = {
  id: 't', name: 'Tee', kindId: 'k-tees', shadeMain: 's-red-burgundy', count: 2, brand: 'Uniqlo', size: 'M', boughtOn: { value: '2023', estimate: true },
  price: { value: 800, estimate: true }, currency: 'INR', fit: 'fits', tags: ['gym', 'old'], usualSpotIds: [], spotId: 'p-withme', status: 'owned',
  needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0,
};

describe('toCsv', () => {
  it('has the agreed header', () => {
    expect(toCsv([tee], trees).split('\n')[0]).toBe('name,kind,colour,second colour,count,brand,size,bought,price,currency,condition,fit,spot,status,tags');
  });
  it('writes plain words for kinds, colours and spots', () => {
    expect(toCsv([tee], trees).split('\n')[1]).toBe('Tee,Tees,Burgundy,,2,Uniqlo,M,about 2023,about 800,INR,,fits,With me,owned,gym; old');
  });
  it('quotes commas and quotes', () => {
    expect(toCsv([{ ...tee, name: 'Tee, "old"' }], trees)).toContain('"Tee, ""old"""');
  });
  it('defuses spreadsheet formulas', () => {
    expect(toCsv([{ ...tee, name: '=HYPERLINK("x")' }], trees).split('\n')[1].startsWith('"\'=HYPERLINK')).toBe(true);
  });
  it('leaves out pieces in the trash', () => {
    expect(toCsv([{ ...tee, deletedAt: 1 }], trees).split('\n')).toHaveLength(1);
  });
});
