import type { Where } from '../ai/models';
import { mergeSpans } from '../redact/merge';
import type { Span } from '../redact/patterns';
import { findLeaks, type Vault } from '../redact/vault';
import type { TaskId } from './tasks';

export const spanKey = (s: Pick<Span, 'start' | 'end'>) => `${s.start}:${s.end}`;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every occurrence of a phrase the user wants hidden (case-insensitive, whole words). */
export function findPhrase(text: string, phrase: string): Span[] {
  const p = phrase.trim();
  if (p.length < 2) return [];
  const pattern = p.split(/\s+/).map(escapeRe).join('\\s+');
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, 'giu');
  return [...text.matchAll(re)].map((m) => ({
    start: m.index!,
    end: m.index! + m[0].length,
    type: 'OTHER' as const,
    value: m[0],
    source: 'manual' as const,
  }));
}

/** Detected + manual spans, merged, minus the ones the user chose to reveal. */
export function activeSpans(text: string, detected: Span[], manual: Span[], revealed: Set<string>): Span[] {
  const all = mergeSpans(text, [...detected, ...manual]);
  return all.filter((s) => !revealed.has(spanKey(s)));
}

/**
 * Airlock check on the outgoing text. Items the user deliberately revealed are
 * allowed through; anything else the re-scan finds blocks sending.
 */
export function outgoingLeaks(outgoing: string, vault: Vault, revealedValues: string[]): Span[] {
  // Where the revealed items sit in the outgoing text. A hidden surname inside a full
  // name the user chose to reveal ("Daniel Okafor") is part of that choice, not a leak;
  // the same surname anywhere else still blocks.
  const allowedRanges = revealedValues.flatMap((v) => findPhrase(outgoing, v).map((s) => [s.start, s.end] as const));
  return findLeaks(outgoing, vault).filter((l) => !allowedRanges.some(([a, b]) => l.start >= a && l.end <= b));
}

/** Turns SDK/network errors from a cloud call into a message a non-expert can act on. */
export function friendlyCloudError(message: string, online: boolean): string {
  if (!online) return `You're offline, so the cloud can't be reached. "Quick summary" works offline on devices with Gemini Nano.`;
  if (/\b(503|500|502|504)\b|UNAVAILABLE|overloaded|Deadline expired|Timeout has expired|timed? ?out/i.test(message))
    return "Google's cloud model is busy or didn't answer in time. Nothing was lost: press send again in a moment.";
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message)) return 'The cloud model is rate-limited right now. Wait a minute and try again.';
  if (/App Check|\b401\b|\b403\b/i.test(message)) return "This site couldn't prove it's the real Airlock app to Firebase (App Check), so the cloud refused. Reload the page and try again.";
  if (/Failed to fetch|NetworkError|ERR_/i.test(message)) return "Couldn't reach the cloud. Check your connection and try again.";
  return `The cloud request failed: ${message}`;
}

const TOKEN_RE = /\[[A-Z]+_\d+\]/g;

export const tokensIn = (text: string): string[] => [...new Set(text.match(TOKEN_RE) ?? [])];

/** Tokens in the answer that the vault doesn't know (the model invented them). */
export const unknownTokens = (answer: string, vault: Vault): string[] => tokensIn(answer).filter((t) => !vault.has(t));

/** One request that left the device. Kept in memory only. */
export interface TrustEntry {
  at: Date;
  task: TaskId;
  where: Where;
  chars: number;
  tokens: number;
  /** Detected items the user chose to send anyway. */
  revealed: number;
  /** Exactly what was sent (the redacted document inside the prompt). */
  sent: string;
}
