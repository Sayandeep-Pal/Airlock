import type { Span } from '../redact/patterns';

/** Renders text with detected spans marked; colour shows whether a pattern or Nano found it. */
export function Highlighted({ text, spans }: { text: string; spans: Span[] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(
      <mark key={i} className={`pii ${s.source}`} title={`${s.type} · found by ${s.source}`}>
        {text.slice(s.start, s.end)}
        <sup>{s.type}</sup>
      </mark>,
    );
    cursor = s.end;
  });
  parts.push(text.slice(cursor));
  return <pre className="highlighted">{parts}</pre>;
}
