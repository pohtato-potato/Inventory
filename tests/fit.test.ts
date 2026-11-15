import { describe, expect, it } from 'vitest';
import { STARTER_KINDS } from '../src/db/seed';
import { fitSummary } from '../src/domain/wears';
import type { Item } from '../src/domain/types';

const item = (over: Partial<Item>): Item => ({
  id: 'x', name: 'x', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned',
  needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0, ...over,
});

describe('fitSummary', () => {
  it('counts owned clothing only, ×N as N', () => {
    const fitsTee = item({ fit: 'fits' });
    const tightJeans = item({ kindId: 'k-jeans', fit: 'tight' });
    const looseShirt = item({ kindId: 'k-shirts', fit: 'loose' });
    const headphones = item({ kindId: 'k-o-electronics', fit: 'fits' });
    const goneJeans = item({ kindId: 'k-jeans', fit: 'tight', status: 'gone' });
    const socksX4Fits = item({ kindId: 'k-socks', fit: 'fits', count: 4 });
    expect(fitSummary([fitsTee, tightJeans, looseShirt, headphones, goneJeans, socksX4Fits], STARTER_KINDS)).toEqual({ fits: 5, tight: 1, loose: 1, unset: 0 });
  });
  it('counts pieces with no fit as unset, and skips the trash', () => {
    expect(fitSummary([item({}), item({ fit: 'fits', deletedAt: 1 })], STARTER_KINDS)).toEqual({ fits: 0, tight: 0, loose: 0, unset: 1 });
  });
});
