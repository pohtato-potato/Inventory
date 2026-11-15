import { describe, expect, it } from 'vitest';
import { STARTER_KINDS, STARTER_PLACES, STARTER_SHADES } from '../src/db/seed';
import { decodeQuery, encodeQuery, isEmptyQuery, matches } from '../src/domain/search';
import type { Item, Place } from '../src/domain/types';

const spot: Place = { id: 'p-rail', homeId: 'p-home', name: 'Cupboard, left rail', role: 'spot', order: 1, updatedAt: 0 };
const trees = { kinds: STARTER_KINDS, shades: STARTER_SHADES, places: [...STARTER_PLACES, spot] };
const red = 's-red', tops = 'k-tops';
const item = (over: Partial<Item>): Item => ({
  id: 'x', name: 'x', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0, ...over,
});
const burgundyTee = item({ id: 't', name: 'Old tee', brand: 'Uniqlo', shadeMain: 's-red-burgundy', spotId: 'p-rail', fit: 'tight', tags: ['gym'] });
const goneJeans = item({ id: 'j', name: 'Old jeans', kindId: 'k-jeans', status: 'gone' });

describe('matches', () => {
  it('matches a family through its shades', () => expect(matches(burgundyTee, { shadeId: red }, trees)).toBe(true));
  it('matches a second colour too', () => expect(matches(item({ shadeSecond: 's-blue-navy' }), { shadeId: 's-blue' }, trees)).toBe(true));
  it('matches a kind through its children', () => {
    expect(matches(burgundyTee, { kindId: tops }, trees)).toBe(true);
    expect(matches(burgundyTee, { kindId: 'k-bottoms' }, trees)).toBe(false);
  });
  it('finds text in the brand, ignoring case', () => expect(matches(burgundyTee, { text: 'UNIQ' }, trees)).toBe(true));
  it('finds text in the kind, colour and spot names, every word', () => {
    expect(matches(burgundyTee, { text: 'burgundy tees' }, trees)).toBe(true);
    expect(matches(burgundyTee, { text: 'left rail' }, trees)).toBe(true);
    expect(matches(burgundyTee, { text: 'burgundy jeans' }, trees)).toBe(false);
  });
  it('hides gone pieces unless asked, and then shows only them', () => {
    expect(matches(goneJeans, {}, trees)).toBe(false);
    expect(matches(goneJeans, { gone: true }, trees)).toBe(true);
    expect(matches(burgundyTee, { gone: true }, trees)).toBe(false);
  });
  it('never matches a piece in the trash', () => expect(matches({ ...burgundyTee, deletedAt: 1 }, {}, trees)).toBe(false));
  it('filters by fit, tag, brand, spot, home and needing details', () => {
    expect(matches(burgundyTee, { fit: 'tight' }, trees)).toBe(true);
    expect(matches(burgundyTee, { fit: 'fits' }, trees)).toBe(false);
    expect(matches(burgundyTee, { tag: 'gym' }, trees)).toBe(true);
    expect(matches(burgundyTee, { brand: 'uniqlo' }, trees)).toBe(true);
    expect(matches(burgundyTee, { spotId: 'p-rail' }, trees)).toBe(true);
    expect(matches(burgundyTee, { spotId: 'p-home' }, trees)).toBe(true);
    expect(matches(burgundyTee, { needsDetails: true }, trees)).toBe(false);
  });
});

describe('saved searches', () => {
  it('round-trips a query', () => {
    expect(decodeQuery(encodeQuery({ fit: 'tight', kindId: tops }))).toEqual({ fit: 'tight', kindId: tops });
    expect(decodeQuery(encodeQuery({ text: 'black, old', gone: true, needsDetails: true }))).toEqual({ text: 'black, old', gone: true, needsDetails: true });
  });
  it('ignores unknown values', () => expect(decodeQuery('fit=huge&x=1')).toEqual({}));
  it('knows an empty query', () => {
    expect(isEmptyQuery({})).toBe(true);
    expect(isEmptyQuery({ text: '  ' })).toBe(true);
    expect(isEmptyQuery({ fit: 'fits' })).toBe(false);
  });
});
