import type { Rough } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Money in the piece's currency: ₹6,990, ₹1,50,000, $12.50. */
export function money(n: number, currency = 'INR'): string {
  const whole = Number.isInteger(n);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

/** "Jan 2024", "about 2023", "4 Oct 2026". */
export function roughDateText(d: Rough<string> | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.value.split('-');
  const core = day ? `${Number(day)} ${MONTHS[Number(m) - 1]} ${y}` : m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
  return d.estimate ? `about ${core}` : core;
}

export function roughPriceText(p: Rough<number> | undefined, currency: string): string {
  if (!p) return '';
  return `${p.estimate ? 'about ' : ''}${money(p.value, currency)}`;
}

/** "2 Nov" this year, "2 Nov 2025" otherwise. */
export function dayText(t: number, now = Date.now()): string {
  const d = new Date(t);
  const same = d.getFullYear() === new Date(now).getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${same ? '' : ` ${d.getFullYear()}`}`;
}

export function monthText(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A fact tile's short date: "Mar '25" for a month or a day, "2023" for a year. */
export function shortDate(d: Rough<string> | undefined): string {
  if (!d) return '';
  const [y, m] = d.value.split('-');
  if (!m) return y;
  const month = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short' });
  return `${month} '${y.slice(2)}`;
}
