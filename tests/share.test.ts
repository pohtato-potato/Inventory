import { describe, expect, it } from 'vitest';
import { parseShare } from '../src/domain/wish';

describe('parseShare (Review Focus 3)', () => {
  it('reads a shared product: its title, the link inside the text, and the shop', () => {
    expect(parseShare('?title=Linen%20Shirt&text=Check%20this%20https%3A%2F%2Fwww.myntra.com%2Fshirts%2F123'))
      .toEqual({ name: 'Linen Shirt', url: 'https://www.myntra.com/shirts/123', shop: 'Myntra' });
  });
  it('prefers the url field, and names the shop from it', () => {
    expect(parseShare('?title=Boots&url=https%3A%2F%2Fwww.amazon.in%2Fdp%2FB0')).toEqual({ name: 'Boots', url: 'https://www.amazon.in/dp/B0', shop: 'Amazon' });
    expect(parseShare('?url=https%3A%2F%2Fwww.ajio.com%2Fp%2F1')!.shop).toBe('Ajio');
    expect(parseShare('?url=https%3A%2F%2Fshop.uniqlo.com%2Fin%2F1')!.shop).toBe('Uniqlo');
    expect(parseShare('?url=https%3A%2F%2Fwww.zara.com%2Fin%2F1')!.shop).toBe('Zara');
  });
  it('a share with no link still opens the form with its words', () => {
    expect(parseShare('?text=just%20words')).toEqual({ name: 'just words' });
  });
  it('uses the words around a link as the name when there is no title', () => {
    expect(parseShare('?text=Linen%20shirt%20https%3A%2F%2Fwww.myntra.com%2Fx')!.name).toBe('Linen shirt');
  });
  it('nothing shared: nothing to open', () => {
    expect(parseShare('')).toBeNull();
    expect(parseShare('?r=1')).toBeNull();
  });
  it('keeps only http and https links', () => {
    expect(parseShare('?url=javascript%3Aalert(1)')!.url).toBeUndefined();
    expect(parseShare('?text=data%3Atext%2Fhtml%2Cx')!.url).toBeUndefined();
  });
});
