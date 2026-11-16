/**
 * Reads a document the user picked, entirely in the browser.
 * PDFs are parsed locally with pdf.js; the file is never uploaded anywhere.
 */

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 30;
export const ACCEPT = '.pdf,.txt,.md,application/pdf,text/plain,text/markdown';

export interface TextPiece {
  str: string;
  hasEOL?: boolean;
  /** pdf.js transform matrix; [4] is x, [5] is y. */
  transform?: number[];
  width?: number;
  height?: number;
}

/** A wide gap between items on one line is a table column, not a word break. */
const COLUMN_GAP = '    ';

/**
 * Joins pdf.js text items into readable lines. Items on one line get a space only
 * where needed, and a wide gap stays wide, so "Patient: Daniel Okafor      Patient ID"
 * is never read as one long name (name rules need single spaces between words).
 */
export function joinTextItems(items: TextPiece[]): string {
  let out = '';
  let prev: TextPiece | undefined;
  for (const it of items) {
    if (it.str) {
      if (prev && isColumnGap(prev, it)) out = out.replace(/[ \t]+$/, '') + COLUMN_GAP;
      else if (out.length > 0 && !/[\s(\[/-]$/.test(out) && !/^[\s.,;:!?)\]]/.test(it.str)) out += ' ';
      out += it.str;
      prev = it;
    }
    if (it.hasEOL) {
      out += '\n';
      prev = undefined;
    }
  }
  return tidy(out);
}

/** True when two items sit on the same line with more than ~1.5 characters of space between them. */
function isColumnGap(a: TextPiece, b: TextPiece): boolean {
  if (!a.transform || !b.transform || a.width === undefined) return false;
  const size = Math.abs(b.height || b.transform[3] || 10);
  if (Math.abs(a.transform[5]! - b.transform[5]!) > size / 2) return false;
  return b.transform[4]! - (a.transform[4]! + a.width) > size * 1.5;
}

/** Trims line ends and collapses runs of blank lines. Inner spacing is kept: it separates columns. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class FileReadError extends Error {}

export async function readDocumentFile(file: File): Promise<{ text: string; pages?: number; truncated?: boolean }> {
  if (file.size > MAX_FILE_BYTES) throw new FileReadError('That file is larger than 15 MB. Try a smaller file or paste the text.');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isPdf) {
    if (file.type && !file.type.startsWith('text/')) throw new FileReadError('Only PDF and plain-text files can be read.');
    return { text: tidy(await file.text()) };
  }
  return readPdf(await file.arrayBuffer());
}

async function readPdf(data: ArrayBuffer): Promise<{ text: string; pages: number; truncated: boolean }> {
  // Loaded on demand so the main bundle stays small.
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(data), enableXfa: false });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    const name = (e as Error).name;
    if (name === 'PasswordException') throw new FileReadError('This PDF is password-protected. Open it, copy the text and paste it instead.');
    throw new FileReadError(`This PDF couldn't be read (${(e as Error).message}).`);
  }
  try {
    const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
    const parts: string[] = [];
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      parts.push(joinTextItems(content.items as TextPiece[]));
      page.cleanup();
    }
    const text = parts.filter(Boolean).join('\n\n');
    if (!text.trim()) throw new FileReadError('No text found in this PDF. It may be a scanned image; Airlock can only read PDFs with selectable text.');
    return { text, pages, truncated: doc.numPages > MAX_PDF_PAGES };
  } finally {
    await task.destroy();
  }
}
