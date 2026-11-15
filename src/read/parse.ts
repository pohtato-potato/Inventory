import { parseRoughDate } from '../domain/estimate';

export interface ReceiptGuess {
  shop?: string;
  date?: string;
  price?: number;
  name?: string;
  size?: string;
}

const SHOPS: [RegExp, string][] = [
  [/\bmyntra\b/i, 'Myntra'], [/\bamazon(\.in)?\b/i, 'Amazon'], [/\bflipkart\b/i, 'Flipkart'], [/\bajio\b/i, 'Ajio'],
  [/\bnykaa\b/i, 'Nykaa'], [/\btata\s*cliq\b/i, 'Tata CLiQ'], [/\bmeesho\b/i, 'Meesho'], [/\bh\s*&\s*m\b/i, 'H&M'],
  [/\bzara\b/i, 'Zara'], [/\buniqlo\b/i, 'Uniqlo'], [/\blevi('?s|\s+strauss)\b/i, "Levi's"], [/\bdecathlon\b/i, 'Decathlon'],
  [/\bwestside\b/i, 'Westside'], [/\bpantaloons\b/i, 'Pantaloons'], [/\bsnitch\b/i, 'Snitch'], [/\bsouled store\b/i, 'The Souled Store'],
  [/\bbewakoof\b/i, 'Bewakoof'], [/\bnike\b/i, 'Nike'], [/\badidas\b/i, 'Adidas'], [/\bpuma\b/i, 'Puma'], [/\bcroma\b/i, 'Croma'],
  [/\breliance digital\b/i, 'Reliance Digital'], [/\bmarks\s*&\s*spencer\b/i, 'Marks & Spencer'], [/\blifestyle stores?\b/i, 'Lifestyle'],
];

const PRODUCT = /\b(t-?shirt|tee|shirt|polo|jeans|trousers?|chinos|shorts|kurta|jacket|blazer|hoodie|sweat(er|shirt)|cardigan|sneakers?|shoes?|loafers?|sandals?|boots?|socks|belt|cap|watch|bracelet|ring|bag|backpack|wallet|headphones?|earbuds|speaker|phone|charger|cable|laptop|dress|skirt|top)\b/i;
const NOT_NAME = /\b(order|total|size\s*:|price|paid|payment|delivery|address|return|exchange|review|shipping|gstin|invoice|bill no|cashier|sold by|rate &|qty)\b/i;

/** Amounts on a line: "₹1,299", "Rs. 3,450.00", "3450.00". `money` requires a currency mark or decimals. */
function amounts(line: string, loose: boolean): number[] {
  const out: number[] = [];
  const re = /(₹|rs\.?|inr)?\s*(-)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d{2})?/gi;
  for (const m of line.matchAll(re)) {
    if (m[2]) continue; // a discount
    const hasMark = !!m[1];
    const hasDecimals = !!m[4];
    const grouped = m[3].includes(',');
    if (!hasMark && !(loose && (hasDecimals || grouped))) continue;
    let digits = m[3];
    // The reader often turns "₹1,299" into "31,299": an unmarked amount whose first group is
    // "3" plus a valid group is taken as a misread rupee sign.
    if (!hasMark && grouped && /^3\d{1,3},/.test(digits) && /^\d{1,3}(,\d{2,3})+$/.test(digits.slice(1))) digits = digits.slice(1);
    const v = Number(digits.replace(/,/g, '') + (m[4] ?? ''));
    if (v > 0 && v < 10_000_000) out.push(Math.round(v * 100) / 100);
  }
  return out;
}

const TOTALS: [RegExp, number][] = [
  [/\bgrand\s*total\b/i, 5], [/\b(net\s*amount|amount\s*payable|net\s*payable|total\s*payable)\b/i, 4],
  [/\b(total\s*order\s*price|order\s*total|total\s*amount|bill\s*amount)\b/i, 3], [/^\s*total\b/i, 2], [/\btotal\b/i, 1],
];
const NOT_TOTAL = /\b(sub\s*-?total|subtotal|saved|savings|discount|tax|gst|cgst|sgst|igst|mrp)\b/i;

function findPrice(lines: string[]): number | undefined {
  let best: { score: number; value: number } | undefined;
  for (const line of lines) {
    if (NOT_TOTAL.test(line)) continue;
    const t = TOTALS.find(([re]) => re.test(line));
    if (!t) continue;
    const vals = amounts(line, true);
    if (!vals.length) continue;
    const value = vals[vals.length - 1];
    if (!best || t[1] > best.score) best = { score: t[1], value };
  }
  if (best) return best.value;
  const marked = [...new Set(lines.flatMap((l) => (NOT_TOTAL.test(l) ? [] : amounts(l, false))))];
  return marked.length === 1 ? marked[0] : undefined;
}

const DATE_RES = [
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
  /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/,
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
];

function findDate(lines: string[]): string | undefined {
  let best: { score: number; value: string } | undefined;
  lines.forEach((line, i) => {
    for (const re of DATE_RES) {
      const m = line.match(re);
      if (!m) continue;
      const parsed = parseRoughDate(m[0].replace(/(\d)(st|nd|rd|th)\b/i, '$1').replace(/\./g, '/'));
      if (!parsed || parsed.value.length !== 10) continue;
      let score = 0;
      if (/\b(ordered|order date|placed|bill|invoice|date)\b/i.test(line)) score += 3;
      if (/\b(return|exchange|window|warranty|expires?)\b/i.test(line)) score -= 4;
      score -= i / 1000; // earlier wins a tie
      if (!best || score > best.score) best = { score, value: parsed.value };
    }
  });
  return best?.value;
}

function findSize(lines: string[]): string | undefined {
  for (const line of lines) {
    const m = line.match(/\bsize\s*[:\-]?\s*((?:UK|US|EU)\s*\d{1,2}(?:\.5)?|\d{2}\s*[x×]\s*\d{2}|\d{1,2}(?:\.5)?|XXS|XS|S|M|L|XL|XXL|XXXL|\dXL)\b/i);
    if (m) return m[1].toUpperCase().replace(/\s+/g, ' ');
  }
  return undefined;
}

function findName(lines: string[]): string | undefined {
  for (const line of lines) {
    if (!PRODUCT.test(line) || NOT_NAME.test(line)) continue;
    const clean = line.replace(/(\s+[-\d.,₹]+)+\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    if (clean.length >= 4 && clean.length <= 90) return clean;
  }
  return undefined;
}

function findShop(text: string): string | undefined {
  let best: { at: number; name: string } | undefined;
  for (const [re, name] of SHOPS) {
    const m = re.exec(text);
    if (m && (!best || m.index < best.at)) best = { at: m.index, name };
  }
  return best?.name;
}

/** Best guesses from the text of a receipt or an order screenshot. Leaves out anything it cannot find. */
export function parseReceipt(text: string): ReceiptGuess {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ReceiptGuess = {};
  const shop = findShop(text);
  const date = findDate(lines);
  const price = findPrice(lines);
  const name = findName(lines);
  const size = findSize(lines);
  if (shop) out.shop = shop;
  if (date) out.date = date;
  if (price !== undefined) out.price = price;
  if (name) out.name = name;
  if (size) out.size = size;
  return out;
}
