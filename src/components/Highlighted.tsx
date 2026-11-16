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
        // An inline <mark> rather than a <button>: buttons are inline-blocks, so a long
        // address would turn into a centred box instead of wrapping with the text.
        <mark
          key={spanKey(s)}
          role="button"
          tabIndex={0}
          className={`pii toggle ${s.source}${isRevealed ? ' revealed' : ''}`}
          title={title}
          aria-label={`${s.type}: ${isRevealed ? 'will be sent, activate to hide' : 'hidden, activate to reveal'}`}
          aria-pressed={!isRevealed}
          onClick={() => onToggle(s)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle(s);
            }
          }}
        >
          {content}
        </mark>
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
