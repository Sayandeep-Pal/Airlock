import { describe, expect, it } from 'vitest';
import { detectPatterns } from '../redact/patterns';
import { DATASET } from './dataset';
import { scoreAll } from './score';

const PATTERN_TYPES = new Set(['EMAIL', 'IBAN', 'CARD', 'SSN', 'AADHAAR', 'PAN', 'PHONE', 'DATE']);

describe('eval dataset', () => {
  it('has unique ids and every label appears verbatim', () => {
    expect(new Set(DATASET.map((d) => d.id)).size).toBe(DATASET.length);
    for (const d of DATASET) for (const l of d.labels) expect(d.text, `${d.id} ${l.value}`).toContain(l.value);
  });
});

describe('pattern-only baseline', () => {
  const score = scoreAll(DATASET.map((doc) => ({ doc, spans: detectPatterns(doc.text) })));

  it('catches every pattern-type item (regression guard)', () => {
    for (const [type, t] of Object.entries(score.byType)) {
      if (PATTERN_TYPES.has(type)) expect(t, type).toEqual({ caught: t!.total, total: t!.total });
    }
  });

  it('prints the baseline', () => {
    const rows = Object.entries(score.byType).map(([k, t]) => `${k.padEnd(8)} ${t!.caught}/${t!.total}`);
    console.log(
      `Pattern-only: recall ${(score.recall * 100).toFixed(1)}%, precision ${(score.precision * 100).toFixed(1)}%\n` +
        rows.join('\n') +
        '\nFalse positives: ' + score.docs.flatMap((d) => d.falsePositives.map((f) => `${d.id} ${f}`)).join(' | '),
    );
  });
});
