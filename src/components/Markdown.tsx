import { parseMarkdown, type Inline } from '../flow/markdown';

const renderInlines = (inlines: Inline[]) =>
  inlines.map((n, i) => {
    switch (n.kind) {
      case 'bold':
        return <strong key={i}>{n.text}</strong>;
      case 'italic':
        return <em key={i}>{n.text}</em>;
      case 'code':
        return <code key={i}>{n.text}</code>;
      default:
        return n.text;
    }
  });

/** Renders model output as React elements; never uses innerHTML. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      {parseMarkdown(text).map((b, i) => {
        if (b.kind === 'heading') {
          const H = (`h${Math.min(b.level + 2, 6)}`) as 'h3' | 'h4' | 'h5' | 'h6';
          return <H key={i}>{renderInlines(b.inlines)}</H>;
        }
        if (b.kind === 'p') return <p key={i}>{renderInlines(b.inlines)}</p>;
        const List = b.kind;
        return (
          <List key={i}>
            {b.items.map((item, j) => (
              <li key={j}>{renderInlines(item)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
