import { describe, expect, it } from 'vitest';
import { detectPatterns, ibanValid, luhnValid, verhoeffValid } from './patterns';
import { blurDate } from './dates';
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

describe('name and reference-code rules', () => {
  const found = (t: string) => detectPatterns(t).map((s) => `${s.type}:${s.value}`);

  it('finds names after titles, keeping the title out', () => {
    expect(found('Review with Dr. Arjun Mehta on Monday')).toEqual(['PERSON:Arjun Mehta']);
    expect(found('From: Advocate Deepa Menon, on behalf of')).toEqual(['PERSON:Deepa Menon']);
    expect(found("Dear Ms. O'Connor,")).toEqual(["PERSON:O'Connor"]);
  });

  it('finds names after field labels and greetings', () => {
    expect(found('Taxpayer: Rebecca Lyons\nSSN')).toEqual(['PERSON:Rebecca Lyons']);
    expect(found('Signed: Peter Novak, HR Director')).toEqual(['PERSON:Peter Novak']);
    expect(found('Owner: Shalini Desai. Tenant: Vikram Joshi.')).toEqual(['PERSON:Shalini Desai', 'PERSON:Vikram Joshi']);
  });

  it('keeps all-caps field labels and extra spacing out of names', () => {
    expect(found('Patient: Priya Raman   DOB: 14/02/1988')).toEqual(['PERSON:Priya Raman', 'DATE:14/02/1988']);
    // pdf.js can collapse a column gap to one space; the next field label still ends the name.
    expect(found('Patient: Daniel Okafor Patient ID: NGH-PT-0045127')).toEqual(['PERSON:Daniel Okafor', 'ID:NGH-PT-0045127']);
    expect(found('Dr. Mei Lin Tan')).toEqual(['PERSON:Mei Lin Tan']);
  });

  it('finds names in dash signatures', () => {
    expect(found('Thanks.\n— Sarah Kim, People Team')).toEqual(['PERSON:Sarah Kim']);
  });

  it('finds organisations by their company-type ending', () => {
    expect(found('versus Brightline Builders Pvt Ltd ... Defendant')).toEqual(['ORG:Brightline Builders Pvt Ltd']);
    expect(found('outside Greenway Pharmacy.')).toEqual(['ORG:Greenway Pharmacy']);
    expect(found('Dr. Helen Park, Riverside Family Practice')).toEqual(['PERSON:Helen Park', 'ORG:Riverside Family Practice']);
    expect(found('Hartwell & Lowe LLP')).toEqual(['ORG:Hartwell & Lowe LLP']);
    expect(found('LAKESIDE MULTISPECIALITY CLINIC\nDischarge summary')).toEqual(['ORG:LAKESIDE MULTISPECIALITY CLINIC']);
  });

  it('does not tag public bodies as organisations', () => {
    expect(found('Internal Revenue Service, HM Revenue & Customs, Income Tax Department')).toEqual([]);
  });

  it('does not treat roles or generic phrases as names', () => {
    expect(found('To: The Manager')).toEqual([]);
    expect(found('Dear Customer Service,')).toEqual([]);
    expect(found('the doctor said to rest')).toEqual([]);
  });

  it('finds reference codes but not plain numbers or year ranges', () => {
    expect(found('Loan CFL-LN-0093312 and sample SD/2026/88213')).toEqual(['ID:CFL-LN-0093312', 'ID:SD/2026/88213']);
    expect(found('Assessment Year: 2026-27, flat B-14')).toEqual([]);
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

  it('gives a surname mentioned alone the same token as the full name', () => {
    const t = 'Patient Priya Raman. Ms. Raman was seen. Dr. Arjun Mehta.';
    const spans = [
      { start: 8, end: 19, type: 'PERSON' as const, value: 'Priya Raman', source: 'nano' as const },
      { start: 25, end: 30, type: 'PERSON' as const, value: 'Raman', source: 'nano' as const },
      { start: 45, end: 56, type: 'PERSON' as const, value: 'Arjun Mehta', source: 'pattern' as const },
    ];
    const { redacted: r, vault: v } = redact(t, spans);
    expect(r).toBe('Patient [PERSON_1]. Ms. [PERSON_1] was seen. Dr. [PERSON_2].');
    expect(restore('Ms. [PERSON_1] should call Dr. [PERSON_2].', v)).toBe('Ms. Priya Raman should call Dr. Arjun Mehta.');
  });

  it('airlock matches hidden values as whole words only', () => {
    const { redacted: r, vault: v } = redact('Al paid.', [{ start: 0, end: 2, type: 'PERSON', value: 'Al', source: 'nano' }]);
    expect(r).toBe('[PERSON_1] paid.');
    expect(findLeaks('Total: 5. Ask AL or al.', v).map((l) => l.value)).toEqual(['AL', 'al']);
  });
});

describe('blur dates', () => {
  it('turns exact dates into month and year, or just the year when ambiguous', () => {
    expect(blurDate('2026-11-15')).toBe('November 2026');
    expect(blurDate('14/02/1988')).toBe('February 1988');
    expect(blurDate('03/12/1985')).toBe('1985');
    expect(blurDate('12 March 1985')).toBe('March 1985');
    expect(blurDate('3rd Mar. 2026')).toBe('March 2026');
    expect(blurDate('March 12, 2026')).toBe('March 2026');
    expect(blurDate('not a date')).toBeUndefined();
  });

  it('sends blurred dates instead of placeholders, and the airlock accepts them', () => {
    const text = 'Patient Priya Raman, DOB 14/02/1988, seen on 2026-11-15.';
    const spans = detectPatterns(text);
    const { redacted: r, vault: v } = redact(text, spans, { blurDates: true });
    expect(r).toBe('Patient [PERSON_1], DOB February 1988, seen on November 2026.');
    expect([...v.keys()]).toEqual(['[PERSON_1]']);
    expect(findLeaks(r, v)).toEqual([]);
    expect(redact(text, spans).redacted).toBe('Patient [PERSON_1], DOB [DATE_1], seen on [DATE_2].');
  });
});

describe('sign-off names', () => {
  it('finds a name on the line after a sign-off', () => {
    const found = detectPatterns('Please pay soon.\n\nSincerely,\nLaura Brennan\nPatient Accounts').map((s) => `${s.type}:${s.value}`);
    expect(found).toEqual(['PERSON:Laura Brennan']);
    expect(detectPatterns('Thanks,\nThe Billing Team')).toEqual([]);
  });
});
