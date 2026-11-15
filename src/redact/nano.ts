import type { PiiType, Span } from './patterns';

/**
 * Gemini Nano detects the personal data that fixed patterns can't:
 * names, addresses, organisations and free-form ID numbers.
 *
 * Nano only *lists* items; we then find each one verbatim in the text ourselves.
 * Anything Nano returns that isn't literally in the text is discarded, so the
 * model can't invent spans.
 */

export const NANO_TYPES = ['PERSON', 'ADDRESS', 'ORG', 'ID'] as const;
export type NanoType = (typeof NANO_TYPES)[number];

export interface Entity {
  type: NanoType;
  text: string;
}

/** JSON schema passed to Chrome's Prompt API as responseConstraint. */
export const ENTITY_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: NANO_TYPES },
          text: { type: 'string' },
        },
        required: ['type', 'text'],
      },
    },
  },
  required: ['entities'],
} as const;

export function buildPrompt(chunk: string): string {
  return `You find personal data in documents. List every item of these types in the TEXT:
- PERSON: every person's name: patients, clients, tenants, employees, doctors, lawyers, advocates, witnesses, and people who sign the letter. Include full names, first names and surnames.
- ADDRESS: street addresses, including house number, street, city and postal code
- ORG: names of private organisations: employers, hospitals, clinics, banks, insurers, schools, landlords, law firms and companies
- ID: case, account, patient, policy, claim, invoice, member, employee, tenant, tax (e.g. TAN) or reference numbers. Copy the whole number including letter prefixes, e.g. "OS 1482/2026" or "CFL-LN-0093312".

Rules:
- Copy each item EXACTLY as written in the TEXT: same spelling, capitals and punctuation.
- Do not include field labels or roles such as "Name:", "MRN", "Policy No.", "Signed:", "Advocate" or "Dr." in the item.
- Do NOT list:
  - job titles or roles (e.g. "HR Director", "Senior Manager", "Operations Analyst")
  - departments or teams (e.g. "Marketing", "People Team")
  - government bodies, courts and tax authorities (e.g. "Internal Revenue Service", "Income Tax Department"); these are public, not personal
  - medical conditions, medicines, amounts of money, or generic words
- If there are none, return an empty list.

TEXT:
"""
${chunk}
"""`;
}

export interface Chunk {
  text: string;
  offset: number;
}

/**
 * Split text into chunks of at most ~maxChars, breaking on blank lines, then
 * newlines, then sentence ends, so entities rarely straddle two chunks.
 */
export function chunkText(text: string, maxChars = 1200): Chunk[] {
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('\n'), window.lastIndexOf('. '));
      if (cut > maxChars * 0.3) end = start + cut + 1;
    }
    chunks.push({ text: text.slice(start, end), offset: start });
    start = end;
  }
  return chunks;
}

/** Parse Nano's JSON reply leniently; malformed output yields no entities. */
export function parseEntities(raw: string): Entity[] {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  try {
    const parsed = JSON.parse(json) as { entities?: unknown };
    if (!Array.isArray(parsed.entities)) return [];
    return parsed.entities.filter(
      (e): e is Entity =>
        typeof e === 'object' && e !== null &&
        NANO_TYPES.includes((e as Entity).type) &&
        typeof (e as Entity).text === 'string',
    );
  } catch {
    return [];
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TITLE = /^(?:Mr|Mrs|Ms|Miss|Dr|Prof|Shri|Smt)\.?\s+/i;

/**
 * Find every occurrence of each entity in the chunk. Whitespace in the entity
 * matches any whitespace in the text. Multi-word person names also match their
 * individual parts ("Raman" alone later in the letter), when capitalised.
 */
export function locateEntities(chunk: Chunk, entities: Entity[]): Span[] {
  const spans: Span[] = [];
  const add = (type: PiiType, needle: string, flags: string) => {
    const pattern = needle.trim().split(/\s+/).map(escapeRe).join('\\s+');
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, flags);
    for (const m of chunk.text.matchAll(re)) {
      const start = chunk.offset + m.index!;
      spans.push({ start, end: start + m[0].length, type, value: m[0], source: 'nano' });
    }
  };

  for (const e of entities) {
    const text = e.text.trim().replace(/[\s,.;:]+$/, '');
    if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) continue;
    add(e.type, text, 'giu');

    if (e.type === 'PERSON') {
      const parts = text.replace(TITLE, '').split(/\s+/);
      if (parts.length > 1) {
        for (const p of parts) {
          // Case-sensitive and capitalised only, so "Rose" the name doesn't hit "rose" the verb.
          if (p.length >= 3 && /^\p{Lu}/u.test(p)) add('PERSON', p, 'gu');
        }
      }
    }
  }
  return spans;
}

/** One Nano call per chunk. `prompt` is injected so this stays testable. */
export async function detectWithNano(
  text: string,
  prompt: (input: string) => Promise<string>,
): Promise<Span[]> {
  const spans: Span[] = [];
  for (const chunk of chunkText(text)) {
    const raw = await prompt(buildPrompt(chunk.text));
    spans.push(...locateEntities(chunk, parseEntities(raw)));
  }
  return spans;
}
