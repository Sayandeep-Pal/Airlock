import { mergeSpans } from './merge';
import { NANO_TYPES, detectWithNano, locateEntities, type NanoType } from './nano';
import { detectPatterns, type Span } from './patterns';

export interface Detection {
  spans: Span[];
  /** True when Nano ran; false means pattern-only (weaker) redaction. */
  usedNano: boolean;
  nanoError?: string;
  ms: number;
}

const isNanoType = (t: Span['type']): t is NanoType => (NANO_TYPES as readonly string[]).includes(t);

/**
 * Hide every other occurrence of anything already found. A name caught once
 * (e.g. "Dr. Arjun Mehta") is also hidden where it appears bare, and person
 * names also cover their parts ("Mehta" alone). Without this, the airlock
 * check would find the repeat and block sending.
 */
export function propagate(text: string, spans: Span[]): Span[] {
  const sourceOf = new Map(spans.map((s) => [`${s.type}|${s.value.toLowerCase()}`, s.source]));
  const entities = spans.filter((s) => isNanoType(s.type)).map((s) => ({ type: s.type as NanoType, text: s.value }));
  const extra = locateEntities({ text, offset: 0 }, entities).map((s) => ({
    ...s,
    source: sourceOf.get(`${s.type}|${s.value.toLowerCase()}`) ?? sourceOf.get(`PERSON|${s.value.toLowerCase()}`) ?? 'nano',
  }));
  // Name parts inherit the source of the full name they came from.
  for (const e of extra) {
    if (e.type === 'PERSON' && !sourceOf.has(`PERSON|${e.value.toLowerCase()}`)) {
      const parent = spans.find((s) => s.type === 'PERSON' && s.value.toLowerCase().includes(e.value.toLowerCase()));
      if (parent) e.source = parent.source;
    }
  }
  return mergeSpans(text, [...spans, ...extra]);
}

/**
 * Full on-device detection: patterns always, plus Nano when requested.
 * `prompt` is the on-device Nano call (see ai/nanoPrompt.ts), injected for testing.
 * If Nano fails, returns pattern-only spans with the error, and the caller
 * must treat the result as weaker (warn + ask for consent).
 */
export async function detectPii(
  text: string,
  { useNano, prompt }: { useNano: boolean; prompt: (input: string) => Promise<string> },
): Promise<Detection> {
  const t0 = performance.now();
  const patternSpans = detectPatterns(text);
  let nanoSpans: Span[] = [];
  let nanoError: string | undefined;

  if (useNano) {
    try {
      nanoSpans = await detectWithNano(text, prompt);
    } catch (e) {
      nanoError = (e as Error).message;
    }
  }

  return {
    spans: propagate(text, mergeSpans(text, [...patternSpans, ...nanoSpans])),
    usedNano: useNano && !nanoError,
    nanoError,
    ms: Math.round(performance.now() - t0),
  };
}
