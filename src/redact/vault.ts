import { detectPatterns, type PiiType, type Span } from './patterns';

/** Maps tokens like "[PERSON_1]" to the real value. Never leaves the device. */
export type Vault = Map<string, { type: PiiType; value: string }>;

export interface Redaction {
  redacted: string;
  vault: Vault;
}

const TOKEN_RE = /\[([A-Z]+)_(\d+)\]/g;

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
    let token = byKey.get(key);
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
  const lower = outgoing.toLowerCase();
  for (const { type, value } of vault.values()) {
    const needle = value.trim().toLowerCase();
    if (needle.length < 2) continue;
    let i = lower.indexOf(needle);
    while (i !== -1) {
      leaks.push({ start: i, end: i + needle.length, type, value: outgoing.slice(i, i + needle.length), source: 'pattern' });
      i = lower.indexOf(needle, i + needle.length);
    }
  }
  return leaks.sort((a, b) => a.start - b.start);
}
