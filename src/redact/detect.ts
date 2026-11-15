import { mergeSpans } from './merge';
import { detectWithNano } from './nano';
import { detectPatterns, type Span } from './patterns';

export interface Detection {
  spans: Span[];
  /** True when Nano ran; false means pattern-only (weaker) redaction. */
  usedNano: boolean;
  nanoError?: string;
  ms: number;
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
    spans: mergeSpans(text, [...patternSpans, ...nanoSpans]),
    usedNano: useNano && !nanoError,
    nanoError,
    ms: Math.round(performance.now() - t0),
  };
}
