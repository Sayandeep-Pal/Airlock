/**
 * Tiny Markdown parser for model answers. It produces plain data that React
 * renders as elements, so there is no HTML injection (no innerHTML anywhere).
 * Supports: headings, bullet and numbered lists, paragraphs, **bold**, *italic*, `code`.
 */

export type Inline = { kind: 'text' | 'bold' | 'italic' | 'code'; text: string };
export type Block =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'ul' | 'ol'; items: Inline[][] }
  | { kind: 'p'; inlines: Inline[] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  // Underscores only mark emphasis at word boundaries (as in CommonMark), so placeholders
  // like [ORG_1] … [PERSON_2] on the same line are never turned into italics.
  const re = /\*\*(.+?)\*\*|(?<!\w)__(.+?)__(?!\w)|`([^`]+)`|\*([^*\s][^*]*?)\*|(?<!\w)_([^_\s][^_]*?)_(?!\w)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    if (m[1] ?? m[2]) out.push({ kind: 'bold', text: (m[1] ?? m[2])! });
    else if (m[3]) out.push({ kind: 'code', text: m[3] });
    else out.push({ kind: 'italic', text: (m[4] ?? m[5])! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: Inline[][] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: 'p', inlines: parseInline(para.join(' ')) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const raw of src.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);

    if (!line) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInline(heading[2]) });
    } else if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list && list.kind !== kind) flushList();
      list ??= { kind, items: [] };
      list.items.push(parseInline((bullet ?? numbered)![1]));
    } else if (list && /^\s{2,}/.test(raw)) {
      // Indented continuation of the previous list item.
      list.items[list.items.length - 1].push({ kind: 'text', text: ' ' + line });
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks;
}
