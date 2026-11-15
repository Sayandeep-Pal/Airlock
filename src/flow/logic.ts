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
  const allowed = new Set(revealedValues.map((v) => v.trim().toLowerCase()));
  return findLeaks(outgoing, vault).filter((l) => !allowed.has(l.value.trim().toLowerCase()));
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
