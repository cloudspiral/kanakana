import { describe, expect, it } from 'vitest';

import { isNearMiss } from '../answers';
import { BUNDLED_MANIFEST } from '../curriculum';

const item = (glyph: string) =>
  BUNDLED_MANIFEST.items.find((candidate) => candidate.content.glyph === glyph)!;

describe('typo override eligibility', () => {
  it('accepts a single-character slip', () => {
    expect(isNearMiss(item('か'), 'kd')).toBe(true);
    expect(isNearMiss(item('か'), 'kaa')).toBe(true);
    expect(isNearMiss(item('か'), 'a')).toBe(true);
  });

  it('refuses a wholly different answer, which would be a free pass', () => {
    expect(isNearMiss(item('か'), 'shi')).toBe(false);
    expect(isNearMiss(item('か'), 'zzz')).toBe(false);
  });

  it('refuses an empty answer', () => {
    expect(isNearMiss(item('か'), '')).toBe(false);
    expect(isNearMiss(item('か'), '   ')).toBe(false);
  });

  it('is not offered for an exactly correct answer', () => {
    // Distance 0, not 1 — there is nothing to override.
    expect(isNearMiss(item('か'), 'ka')).toBe(false);
  });

  it('measures against every accepted spelling, not just the primary', () => {
    // し accepts both shi and si; one edit from either counts.
    expect(isNearMiss(item('し'), 'sh')).toBe(true);
    expect(isNearMiss(item('し'), 'so')).toBe(true);
  });
});
