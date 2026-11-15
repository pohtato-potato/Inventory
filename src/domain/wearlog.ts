// Days and wears. A day is the phone's local calendar day, as YYYY-MM-DD.

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a moment: a wear at 00:10 belongs to the new day. */
export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
