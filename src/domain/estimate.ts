import type { Rough } from './types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const GUESS = /\b(about|around|approx(?:imately)?|roughly|maybe|probably|c\.|circa|ish)\b|~|\?/i;

function month(word: string): number {
  const i = MONTHS.indexOf(word.slice(0, 3).toLowerCase());
  return i < 0 ? 0 : i + 1;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

const yearOk = (y: number, now: Date) => y >= 1950 && y <= now.getFullYear() + 1;

const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A two-digit year: 26 is 2026, 99 is 1999 (anything after next year is last century). */
const fullYear = (y: string, now: Date) => {
  if (y.length === 4) return Number(y);
  const n = Number(y);
  return 2000 + n <= now.getFullYear() + 1 ? 2000 + n : 1900 + n;
};

/**
 * Reads "about 2023", "Jan 2024", "4 Oct 2026", "12th Nov 2026", "2026-10-04", "12/11/2026", "12.11.26" (day first),
 * "03/2021", "today", "last year". A full date with no "about" is exact. Null when unreadable.
 */
export function parseRoughDate(s: string, now = new Date()): Rough<string> | null {
  const estimate = GUESS.test(s);
  const t = s.replace(GUESS, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
    .replace(/(\d)\.(?=\d)/g, '$1/')
    .replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return null;
  let m: RegExpMatchArray | null;
  if (t === 'today') return { value: isoDay(now), estimate };
  if (t === 'yesterday') return { value: isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)), estimate };
  if (t === 'last year') return { value: String(now.getFullYear() - 1), estimate: true };
  if (t === 'this year') return { value: String(now.getFullYear()), estimate: true };
  if ((m = t.match(/^(\d{1,2}) years? ago$/))) return { value: String(now.getFullYear() - Number(m[1])), estimate: true };
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return yearOk(y, now) && validDay(y, mo, d) ? { value: `${y}-${pad(mo)}-${pad(d)}`, estimate } : null;
  }
  if ((m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})$/))) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), fullYear(m[3], now)];
    return yearOk(y, now) && validDay(y, mo, d) ? { value: `${y}-${pad(mo)}-${pad(d)}`, estimate } : null;
  }
  if ((m = t.match(/^(\d{4})-(\d{1,2})$/)) || (m = t.match(/^(\d{1,2})[/-](\d{4})$/))) {
    const [y, mo] = m[1].length === 4 ? [Number(m[1]), Number(m[2])] : [Number(m[2]), Number(m[1])];
    return yearOk(y, now) && mo >= 1 && mo <= 12 ? { value: `${y}-${pad(mo)}`, estimate } : null;
  }
  if ((m = t.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/)) || (m = t.match(/^([a-z]+) (\d{1,2}) (\d{4})$/))) {
    const dayFirst = /^\d/.test(m[1]);
    const d = Number(dayFirst ? m[1] : m[2]);
    const mo = month(dayFirst ? m[2] : m[1]);
    const y = Number(m[3]);
    return mo && yearOk(y, now) && validDay(y, mo, d) ? { value: `${y}-${pad(mo)}-${pad(d)}`, estimate } : null;
  }
  if ((m = t.match(/^([a-z]+) (\d{4})$/))) {
    const mo = month(m[1]);
    const y = Number(m[2]);
    return mo && yearOk(y, now) ? { value: `${y}-${pad(mo)}`, estimate } : null;
  }
  if ((m = t.match(/^(\d{4})$/))) {
    const y = Number(m[1]);
    return yearOk(y, now) ? { value: String(y), estimate } : null;
  }
  return null;
}

/** Reads "about ₹800", "6,990", "Rs. 1,299.00", "~1.5k". Null when unreadable. */
export function parseRoughPrice(s: string): Rough<number> | null {
  const estimate = GUESS.test(s);
  const t = s.replace(GUESS, ' ').replace(/₹|rs\.?|inr|rupees?|\$|usd|€|eur|£|gbp/gi, ' ').replace(/\s+/g, '').toLowerCase();
  const m = t.match(/^(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d{1,2})?(k|l|lakh)?$/);
  if (!m) return null;
  let v = Number(m[1].replace(/,/g, '') + (m[2] ?? ''));
  if (m[3] === 'k') v *= 1000;
  if (m[3] === 'l' || m[3] === 'lakh') v *= 100000;
  if (!Number.isFinite(v) || v <= 0) return null;
  return { value: Math.round(v * 100) / 100, estimate };
}
