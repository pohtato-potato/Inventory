import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Item } from '../src/domain/types';
import { Tile } from '../src/ui/Tile';

const item: Item = { id: 'i', name: 'Navy tee', kindId: 'k-tees', count: 1, currency: 'INR', tags: [], usualSpotIds: [], status: 'owned', needsDetails: false, extra: {}, createdAt: 0, updatedAt: 0 };
const lit = (i: Item) => !/class="sw dim/.test(renderToString(<Tile item={i} colour="#1F2F57" />));

describe('Tile', () => {
  it('an owned piece shows in its colour; a gone or deleted one is greyed', () => {
    expect(lit(item)).toBe(true);
    expect(lit({ ...item, status: 'gone' })).toBe(false);
    expect(lit({ ...item, deletedAt: 5 })).toBe(false);
  });
});
