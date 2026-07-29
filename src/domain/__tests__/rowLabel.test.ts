import { describe, expect, it } from 'vitest';

import { bareRowLabel, GOJUON_ROWS } from '../curriculum';

describe('bare row labels', () => {
  it('strips the trailing "row" so copy does not double it up', () => {
    expect(bareRowLabel('K row')).toBe('K');
    expect(bareRowLabel('Final N')).toBe('N');
  });

  it('leaves a label that is not suffixed alone', () => {
    expect(bareRowLabel('Vowels')).toBe('Vowels');
  });

  it('never produces "row row" for any row in the curriculum', () => {
    // The exact bug this guards: "Ready for the K row row."
    for (const row of GOJUON_ROWS) {
      const sentence = `the ${bareRowLabel(row.shortTitle)} row`;
      expect(sentence).not.toMatch(/row\s+row/i);
      expect(bareRowLabel(row.shortTitle)).not.toBe('');
    }
  });
});
