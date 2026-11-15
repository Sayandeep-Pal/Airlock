import type { PiiType, Span } from '../redact/patterns';
import type { EvalDoc } from './dataset';

/**
 * Scoring:
 *  - Recall (what matters for privacy): a labelled occurrence is "caught" when at
 *    least 90% of its characters fall inside detected spans, whatever type they got.
 *  - Precision: share of detected spans that overlap some labelled occurrence.
 */
export interface TypeScore {
  caught: number;
  total: number;
}
export interface DocScore {
  id: string;
  caught: number;
  total: number;
  spans: number;
  falsePositives: string[];
  missed: string[];
}
export interface Score {
  recall: number;
  precision: number;
  byType: Partial<Record<PiiType, TypeScore>>;
  docs: DocScore[];
}

const COVER_THRESHOLD = 0.9;

function occurrences(text: string, value: string): [number, number][] {
  const out: [number, number][] = [];
  for (let i = text.indexOf(value); i !== -1; i = text.indexOf(value, i + 1)) out.push([i, i + value.length]);
  return out;
}

export function scoreDoc(doc: EvalDoc, spans: Span[]): { doc: DocScore; byType: Partial<Record<PiiType, TypeScore>>; correctSpans: number } {
  const covered = new Uint8Array(doc.text.length);
  for (const s of spans) covered.fill(1, s.start, s.end);

  const byType: Partial<Record<PiiType, TypeScore>> = {};
  const labelled: [number, number][] = [];
  const missed: string[] = [];
  let caught = 0;
  let total = 0;

  // De-duplicate occurrences: a surname label also matches inside the full-name label.
  const seen = new Set<string>();
  for (const label of doc.labels) {
    for (const [a, b] of occurrences(doc.text, label.value)) {
      const key = `${a}:${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      labelled.push([a, b]);
      let c = 0;
      for (let i = a; i < b; i++) c += covered[i];
      const ok = c / (b - a) >= COVER_THRESHOLD;
      const t = (byType[label.type] ??= { caught: 0, total: 0 });
      t.total++;
      total++;
      if (ok) {
        t.caught++;
        caught++;
      } else {
        missed.push(`${label.type}: ${label.value}`);
      }
    }
  }

  const falsePositives = spans
    .filter((s) => !labelled.some(([a, b]) => s.start < b && s.end > a))
    .map((s) => `${s.type}: ${s.value}`);

  return {
    doc: { id: doc.id, caught, total, spans: spans.length, falsePositives, missed },
    byType,
    correctSpans: spans.length - falsePositives.length,
  };
}

export function scoreAll(results: { doc: EvalDoc; spans: Span[] }[]): Score {
  const byType: Partial<Record<PiiType, TypeScore>> = {};
  const docs: DocScore[] = [];
  let caught = 0, total = 0, spans = 0, correct = 0;

  for (const r of results) {
    const s = scoreDoc(r.doc, r.spans);
    docs.push(s.doc);
    caught += s.doc.caught;
    total += s.doc.total;
    spans += s.doc.spans;
    correct += s.correctSpans;
    for (const [type, ts] of Object.entries(s.byType) as [PiiType, TypeScore][]) {
      const t = (byType[type] ??= { caught: 0, total: 0 });
      t.caught += ts.caught;
      t.total += ts.total;
    }
  }
  return {
    recall: total ? caught / total : 1,
    precision: spans ? correct / spans : 1,
    byType,
    docs,
  };
}
