import { spanKey } from '../flow/logic';
import type { Span } from '../redact/patterns';

const SOURCE_LABEL: Record<Span['source'], string> = { pattern: 'pattern rule', nano: 'Gemini Nano', manual: 'you' };

/**
 * Renders text with detected spans marked; colour shows who found each item.
 * With `onToggle`, each item is a button the user can click to reveal or hide it.
 */
export function Highlighted({
  text,
  spans,
  revealed,
  onToggle,
}: {
  text: string;
  spans: Span[];
  revealed?: Set<string>;
  onToggle?: (span: Span) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s) => {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    const isRevealed = revealed?.has(spanKey(s)) ?? false;
    const title = `${s.type} · found by ${SOURCE_LABEL[s.source]}${onToggle ? (isRevealed ? ' · will be SENT · click to hide' : ' · hidden · click to reveal') : ''}`;
    const content = (
      <>
        {text.slice(s.start, s.end)}
        <sup>{s.type}</sup>
      </>
    );
    parts.push(
      onToggle ? (
        <button
          key={spanKey(s)}
          type="button"
          className={`pii ${s.source}${isRevealed ? ' revealed' : ''}`}
          title={title}
          aria-pressed={!isRevealed}
          onClick={() => onToggle(s)}
        >
          {content}
        </button>
      ) : (
        <mark key={spanKey(s)} className={`pii ${s.source}`} title={title}>
          {content}
        </mark>
      ),
    );
    cursor = s.end;
  });
  parts.push(text.slice(cursor));
  return <pre className="highlighted">{parts}</pre>;
}
