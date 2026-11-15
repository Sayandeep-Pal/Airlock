import type { Span } from './patterns';

/**
 * Combine pattern and Nano spans into non-overlapping spans.
 *
 * Overlapping spans are merged into their union rather than one being dropped:
 * if Nano marks an address and a pattern marks a date inside part of it,
 * dropping either would leave the rest of the text exposed. The union takes the
 * type of its longest member (patterns win ties, as they're validated).
 */
export function mergeSpans(text: string, spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  let group: Span[] = [];
  let groupEnd = -1;

  const flush = () => {
    if (group.length === 0) return;
    const start = group[0].start;
    const lead = group.reduce((best, s) => {
      const len = s.end - s.start;
      const bestLen = best.end - best.start;
      if (len !== bestLen) return len > bestLen ? s : best;
      return best.source === 'pattern' ? best : s;
    });
    out.push({ start, end: groupEnd, type: lead.type, value: text.slice(start, groupEnd), source: lead.source });
    group = [];
  };

  for (const s of sorted) {
    if (s.start >= groupEnd) {
      flush();
      groupEnd = s.end;
    } else {
      groupEnd = Math.max(groupEnd, s.end);
    }
    group.push(s);
  }
  flush();
  return out;
}
