import { detectPatterns, type PiiType, type Span } from './patterns';

/** Maps tokens like "[PERSON_1]" to the real value. Never leaves the device. */
export type Vault = Map<string, { type: PiiType; value: string }>;

export interface Redaction {
  redacted: string;
  vault: Vault;
}

const TOKEN_RE = /\[([A-Z]+)_(\d+)\]/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace spans with stable tokens. The same type + value always maps to the same
 * token, so the cloud model can still reason about "[PERSON_1] paid [PERSON_2]".
 * Spans must be non-overlapping.
 */
export function redact(text: string, spans: Span[]): Redaction {
  const vault: Vault = new Map();
  const byKey = new Map<string, string>();
  const counters = new Map<PiiType, number>();

  let out = '';
  let cursor = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    if (span.start < cursor) continue; // defensive: skip overlaps
    const key = `${span.type}\u0000${span.value.trim().toLowerCase()}`;
    let token = byKey.get(key) ?? (span.type === 'PERSON' ? tokenOfFullName(vault, span.value) : undefined);
    if (token) byKey.set(key, token);
    if (!token) {
      const n = (counters.get(span.type) ?? 0) + 1;
      counters.set(span.type, n);
      token = `[${span.type}_${n}]`;
      byKey.set(key, token);
      vault.set(token, { type: span.type, value: span.value });
    }
    out += text.slice(cursor, span.start) + token;
    cursor = span.end;
  }
  out += text.slice(cursor);
  return { redacted: out, vault };
}

/**
 * A surname or first name mentioned alone ("Ms. Raman") reuses the token of the
 * full name seen earlier ("Priya Raman"), so the cloud model knows it's one person.
 */
function tokenOfFullName(vault: Vault, part: string): string | undefined {
  const words = part.trim().toLowerCase().split(/\s+/);
  for (const [token, entry] of vault) {
    if (entry.type !== 'PERSON') continue;
    const full = entry.value.trim().toLowerCase().split(/\s+/);
    if (full.length > words.length && words.every((w) => full.includes(w))) return token;
  }
  return undefined;
}

/** Put real values back. Unknown tokens (e.g. invented by the model) are left as-is. */
export function restore(text: string, vault: Vault): string {
  return text.replace(TOKEN_RE, (tok) => vault.get(tok)?.value ?? tok);
}

/**
 * Airlock check: re-scan the text that is about to leave the device.
 * Returns any PII the patterns can still find, plus any vault value that
 * appears verbatim (e.g. a name Nano found once but that occurs again elsewhere).
 */
export function findLeaks(outgoing: string, vault: Vault): Span[] {
  const leaks = detectPatterns(outgoing);
  for (const { type, value } of vault.values()) {
    const needle = value.trim();
    if (needle.length < 2) continue;
    // Whole words only: a hidden name "Al" must not match inside "Total".
    const pattern = needle.split(/\s+/).map(escapeRe).join('\\s+');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'giu');
    for (const m of outgoing.matchAll(re)) {
      leaks.push({ start: m.index!, end: m.index! + m[0].length, type, value: m[0], source: 'pattern' });
    }
  }
  return leaks.sort((a, b) => a.start - b.start);
}
