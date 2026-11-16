/**
 * "Blur dates": turn an exact date into month and year (or just the year when the
 * month is ambiguous), so the cloud can still reason about timing without the exact
 * day, which helps identify people (e.g. a date of birth).
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthFromName(word: string): number | undefined {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return undefined;
  const i = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(w));
  return i >= 0 ? i + 1 : undefined;
}

const fullYear = (y: string) => (y.length === 2 ? (Number(y) > 50 ? `19${y}` : `20${y}`) : y);
const monthYear = (m: number, y: string) => `${MONTH_NAMES[m - 1]} ${fullYear(y)}`;

/** Returns the blurred form, or undefined when the value isn't a date we understand. */
export function blurDate(value: string): string | undefined {
  const v = value.trim();
  let m: RegExpMatchArray | null;

  // 2026-11-15
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? monthYear(month, m[1]!) : undefined;
  }
  // 15/11/2026, 11-15-26, 15.11.2026: day-first or month-first, so only certain when one part > 12.
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = m[3]!;
    if (a > 12 && b >= 1 && b <= 12) return monthYear(b, year);
    if (b > 12 && a >= 1 && a <= 12) return monthYear(a, year);
    if (a === b && a >= 1 && a <= 12) return monthYear(a, year);
    return fullYear(year);
  }
  // 12 March 1985, 3rd Mar. 2026
  if ((m = v.match(/^\d{1,2}(?:st|nd|rd|th)?\s+([A-Za-z]+\.?),?\s+(\d{4})$/))) {
    const month = monthFromName(m[1]!);
    return month ? monthYear(month, m[2]!) : undefined;
  }
  // March 12, 2026
  if ((m = v.match(/^([A-Za-z]+\.?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(\d{4})$/))) {
    const month = monthFromName(m[1]!);
    return month ? monthYear(month, m[2]!) : undefined;
  }
  return undefined;
}
