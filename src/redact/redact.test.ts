import { describe, expect, it } from 'vitest';
import { detectPatterns, ibanValid, luhnValid, verhoeffValid } from './patterns';
import { findLeaks, redact, restore } from './vault';

// All values below are synthetic test numbers, not real people.
describe('checksums', () => {
  it('validates Luhn', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
    expect(luhnValid('4111 1111 1111 1112')).toBe(false);
  });
  it('validates IBAN', () => {
    expect(ibanValid('GB82 WEST 1234 5698 7654 32')).toBe(true);
    expect(ibanValid('GB82 WEST 1234 5698 7654 33')).toBe(false);
  });
  it('validates Verhoeff', () => {
    expect(verhoeffValid('2363')).toBe(true);
    expect(verhoeffValid('2364')).toBe(false);
  });
});

describe('detectPatterns', () => {
  const types = (t: string) => detectPatterns(t).map((s) => s.type);

  it('finds emails, cards, SSNs, PAN, IBAN', () => {
    expect(types('mail jane.doe@example.org now')).toEqual(['EMAIL']);
    expect(types('card 4111-1111-1111-1111 ok')).toEqual(['CARD']);
    expect(types('SSN 123-45-6789')).toEqual(['SSN']);
    expect(types('PAN ABCPE1234F')).toEqual(['PAN']);
    expect(types('TAN BLRZ04412E')).toEqual(['ID']);
    expect(types('IBAN GB82 WEST 1234 5698 7654 32.')).toEqual(['IBAN']);
  });

  it('finds phone numbers but not short numbers or amounts', () => {
    expect(types('Call +1 (415) 555-0132 today')).toEqual(['PHONE']);
    expect(types('Call +91 98765 43210')).toEqual(['PHONE']);
    expect(types('Total due: 12000 for 3 visits')).toEqual([]);
  });

  it('finds dates in common formats', () => {
    expect(types('DOB 03/12/1985')).toEqual(['DATE']);
    expect(types('on 2026-11-15')).toEqual(['DATE']);
    expect(types('born 12 March 1985')).toEqual(['DATE']);
    expect(types('seen March 12, 2026')).toEqual(['DATE']);
  });

  it('does not double-count a card number as a phone', () => {
    expect(types('4111 1111 1111 1111')).toEqual(['CARD']);
  });
});

describe('redact / restore round trip', () => {
  const text = 'Jane (jane@example.org) emailed bob@example.org. Reply to jane@example.org.';
  const spans = detectPatterns(text);
  const { redacted, vault } = redact(text, spans);

  it('uses stable tokens for repeated values', () => {
    expect(redacted).toBe('Jane ([EMAIL_1]) emailed [EMAIL_2]. Reply to [EMAIL_1].');
  });

  it('restores real values and leaves unknown tokens alone', () => {
    expect(restore('Write to [EMAIL_1] and [EMAIL_9].', vault)).toBe('Write to jane@example.org and [EMAIL_9].');
    expect(restore(redacted, vault)).toBe(text);
  });

  it('airlock finds leaks of vault values and patterns', () => {
    expect(findLeaks(redacted, vault)).toEqual([]);
    const leaky = findLeaks('Hi JANE@example.org, card 4111111111111111', vault);
    expect(leaky.map((l) => l.type).sort()).toEqual(['CARD', 'EMAIL', 'EMAIL']);
  });
});
