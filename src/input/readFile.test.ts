import { describe, expect, it } from 'vitest';
import { joinTextItems, readDocumentFile, tidy } from './readFile';

describe('PDF text joining', () => {
  it('joins items into lines with sensible spacing', () => {
    const items = [
      { str: 'Patient:', hasEOL: false },
      { str: 'Priya Raman', hasEOL: true },
      { str: 'Total due', hasEOL: false },
      { str: ': 12,000', hasEOL: false },
      { str: '', hasEOL: true },
      { str: '', hasEOL: true },
      { str: '', hasEOL: true },
      { str: '(see over)', hasEOL: true },
    ];
    expect(joinTextItems(items)).toBe('Patient: Priya Raman\nTotal due: 12,000\n\n(see over)');
  });

  it('keeps a wide gap between columns, so a label is not read as part of a name', () => {
    const items = [
      { str: 'Patient: Daniel Okafor', transform: [10, 0, 0, 10, 56, 700], width: 120, height: 10, hasEOL: false },
      { str: 'Patient ID: NGH-PT-0045127', transform: [10, 0, 0, 10, 300, 700], width: 140, height: 10, hasEOL: true },
    ];
    expect(joinTextItems(items)).toBe('Patient: Daniel Okafor    Patient ID: NGH-PT-0045127');
  });

  it('tidies line ends and blank lines but keeps inner spacing', () => {
    expect(tidy('  a  b \r\n\r\n\r\n\r\nc  ')).toBe('a  b\n\nc');
  });
});

describe('readDocumentFile', () => {
  it('reads plain text files locally', async () => {
    const file = new File(['Dear Ms. Raman,  \n\n\n\nThanks.'], 'letter.txt', { type: 'text/plain' });
    expect(await readDocumentFile(file)).toEqual({ text: 'Dear Ms. Raman,\n\nThanks.' });
  });

  it('refuses other file types', async () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    await expect(readDocumentFile(file)).rejects.toThrow('Only PDF and plain-text files');
  });
});
