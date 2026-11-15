import { describe, expect, it } from 'vitest';
import { detectPii } from './detect';
import { mergeSpans } from './merge';
import { chunkText, locateEntities, parseEntities } from './nano';
import type { Span } from './patterns';

describe('chunkText', () => {
  it('covers the whole text without gaps, preferring line breaks', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Line ${i}: some words here.`).join('\n');
    const chunks = chunkText(text, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.text).join('')).toBe(text);
    for (const c of chunks) {
      expect(text.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
      expect(c.text.length).toBeLessThanOrEqual(200);
    }
    expect(chunks[0].text.endsWith('\n')).toBe(true);
  });
});

describe('parseEntities', () => {
  it('reads valid JSON and drops bad items', () => {
    const raw = '{"entities":[{"type":"PERSON","text":"Priya Raman"},{"type":"MOOD","text":"x"},{"type":"ORG"}]}';
    expect(parseEntities(raw)).toEqual([{ type: 'PERSON', text: 'Priya Raman' }]);
  });
  it('tolerates surrounding prose or code fences', () => {
    expect(parseEntities('```json\n{"entities":[{"type":"ORG","text":"Acme"}]}\n```')).toEqual([{ type: 'ORG', text: 'Acme' }]);
  });
  it('returns [] for garbage', () => {
    expect(parseEntities('sorry, I cannot')).toEqual([]);
  });
});

describe('locateEntities', () => {
  const text = 'Dear Ms. Priya Raman,\nYour landlord Greenfield Homes wrote to Raman about flat 4B.';
  const chunk = { text, offset: 100 };

  it('finds all occurrences, including surname alone, with absolute offsets', () => {
    const spans = locateEntities(chunk, [{ type: 'PERSON', text: 'Ms. Priya Raman' }]);
    const values = spans.map((s) => s.value);
    expect(values).toContain('Ms. Priya Raman');
    expect(values.filter((v) => v === 'Raman')).toHaveLength(2);
    for (const s of spans) expect(text.slice(s.start - 100, s.end - 100)).toBe(s.value);
  });

  it('ignores entities not literally in the text (no invented spans)', () => {
    expect(locateEntities(chunk, [{ type: 'PERSON', text: 'John Smith' }])).toEqual([]);
  });

  it('does not match inside other words', () => {
    const c = { text: 'Ram went to Ramanujan Hall.', offset: 0 };
    expect(locateEntities(c, [{ type: 'PERSON', text: 'Ram' }]).map((s) => s.value)).toEqual(['Ram']);
  });

  it('matches across different whitespace and trims trailing punctuation', () => {
    const c = { text: 'Greenfield\n  Homes Ltd.', offset: 0 };
    expect(locateEntities(c, [{ type: 'ORG', text: 'Greenfield Homes Ltd.' }])[0].value).toBe('Greenfield\n  Homes Ltd');
  });
});

describe('mergeSpans', () => {
  const s = (start: number, end: number, source: Span['source'], type: Span['type'] = 'PERSON'): Span => ({
    start, end, source, type, value: '',
  });
  it('unions overlapping spans, taking the longest member type', () => {
    const text = '0123456789abcdefghij';
    const merged = mergeSpans(text, [s(2, 6, 'pattern', 'DATE'), s(4, 15, 'nano', 'ADDRESS'), s(17, 19, 'nano')]);
    expect(merged).toEqual([
      { start: 2, end: 15, type: 'ADDRESS', value: '23456789abcde', source: 'nano' },
      { start: 17, end: 19, type: 'PERSON', value: 'hi', source: 'nano' },
    ]);
  });
});

describe('detectPii', () => {
  const text = 'Patient Priya Raman (priya@example.org) at Lakeside Clinic, MRN LKC-448291.';
  const fakeNano = async () =>
    JSON.stringify({ entities: [
      { type: 'PERSON', text: 'Priya Raman' },
      { type: 'ORG', text: 'Lakeside Clinic' },
      { type: 'ID', text: 'LKC-448291' },
      { type: 'PERSON', text: 'Not In Text' },
    ] });

  it('combines patterns and Nano', async () => {
    const d = await detectPii(text, { useNano: true, prompt: fakeNano });
    expect(d.usedNano).toBe(true);
    expect(d.spans.map((s) => `${s.type}:${s.value}`)).toEqual([
      'PERSON:Priya Raman', 'EMAIL:priya@example.org', 'ORG:Lakeside Clinic', 'ID:LKC-448291',
    ]);
  });

  it('falls back to patterns and reports the error when Nano fails', async () => {
    const d = await detectPii(text, { useNano: true, prompt: async () => { throw new Error('no nano'); } });
    expect(d.usedNano).toBe(false);
    expect(d.nanoError).toBe('no nano');
    // Pattern rules alone still catch the labelled name and the reference code.
    expect(d.spans.map((s) => `${s.type}:${s.value}`)).toEqual(['PERSON:Priya Raman', 'EMAIL:priya@example.org', 'ORG:Lakeside Clinic', 'ID:LKC-448291']);
  });
});

describe('propagate', () => {
  it('hides bare repeats and surname-only mentions of a name found once', async () => {
    const text = 'Seen by Dr. Arjun Mehta. Arjun Mehta will call. Ask Mehta.';
    const d = await detectPii(text, { useNano: false, prompt: async () => '' });
    expect(d.spans.map((s) => s.value)).toEqual(['Arjun Mehta', 'Arjun Mehta', 'Mehta']);
    expect(d.spans.every((s) => s.source === 'pattern')).toBe(true);
  });
});
