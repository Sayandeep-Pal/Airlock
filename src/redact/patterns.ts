/**
 * Deterministic, on-device PII detectors. These run with no model at all, so they
 * are the backstop when Gemini Nano is unavailable and the re-scan used by the
 * airlock check before anything leaves the device.
 */

export type PiiType =
  | 'EMAIL'
  | 'IBAN'
  | 'CARD'
  | 'SSN'
  | 'AADHAAR'
  | 'PAN'
  | 'PHONE'
  | 'DATE'
  // Types below are found by Gemini Nano, not by patterns.
  | 'PERSON'
  | 'ADDRESS'
  | 'ORG'
  | 'ID'
  // Marked by hand by the user in the review step.
  | 'OTHER';

export interface Span {
  start: number;
  end: number;
  type: PiiType;
  value: string;
  source: 'pattern' | 'nano' | 'manual';
}

interface Detector {
  type: PiiType;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

const digitsOf = (s: string) => s.replace(/\D/g, '');

export function luhnValid(num: string): boolean {
  const d = digitsOf(num);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function ibanValid(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of v) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

// Verhoeff checksum, used by Aadhaar numbers.
const V_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const V_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
export function verhoeffValid(num: string): boolean {
  const d = digitsOf(num);
  let c = 0;
  for (let i = 0; i < d.length; i++) {
    c = V_D[c][V_P[i % 8][Number(d[d.length - 1 - i])]];
  }
  return c === 0;
}

const MONTHS =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

/** Order matters: earlier detectors win when spans overlap. */
const DETECTORS: Detector[] = [
  { type: 'EMAIL', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g },
  { type: 'IBAN', regex: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, validate: ibanValid },
  { type: 'CARD', regex: /\b\d(?:[ -]?\d){12,18}\b/g, validate: luhnValid },
  { type: 'SSN', regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { type: 'AADHAAR', regex: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g, validate: verhoeffValid },
  { type: 'PAN', regex: /\b[A-Z]{3}[PCHABGJLFT][A-Z]\d{4}[A-Z]\b/g },
  // Indian TAN (tax deduction account number): 4 letters, 5 digits, 1 letter.
  { type: 'ID', regex: /\b[A-Z]{4}\d{5}[A-Z]\b/g },
  {
    type: 'PHONE',
    regex: /(?<![\w+])(?:\+\d{1,3}[ .-]?)?(?:\(\d{1,4}\)[ .-]?)?\d{2,5}(?:[ .-]?\d{2,5}){1,3}\b/g,
    validate: (m) => {
      const n = digitsOf(m).length;
      return n >= 10 && n <= 15;
    },
  },
  {
    type: 'DATE',
    regex: new RegExp(
      [
        String.raw`\b\d{1,2}[/.-]\d{1,2}[/.-](?:\d{4}|\d{2})\b`,
        String.raw`\b\d{4}-\d{2}-\d{2}\b`,
        String.raw`\b\d{1,2}(?:st|nd|rd|th)? (?:${MONTHS})\.?,? \d{4}\b`,
        String.raw`\b(?:${MONTHS})\.? \d{1,2}(?:st|nd|rd|th)?,? \d{4}\b`,
      ].join('|'),
      'gi',
    ),
  },
];

/** Find PII spans with deterministic patterns. Non-overlapping, sorted by start. */
export function detectPatterns(text: string): Span[] {
  const accepted: Span[] = [];
  const overlaps = (s: number, e: number) => accepted.some((a) => s < a.end && e > a.start);

  for (const det of DETECTORS) {
    for (const m of text.matchAll(det.regex)) {
      const value = m[0];
      const start = m.index!;
      const end = start + value.length;
      if (det.validate && !det.validate(value)) continue;
      if (overlaps(start, end)) continue;
      accepted.push({ start, end, type: det.type, value, source: 'pattern' });
    }
  }
  return accepted.sort((a, b) => a.start - b.start);
}
