import { describe, expect, it } from 'vitest';

import { classifyAnswer, normalizeAnswer } from '../answers';
import { BUNDLED_MANIFEST } from '../curriculum';

function byGlyph(glyph: string) {
  return BUNDLED_MANIFEST.items.find(
    (item) => item.content.glyph === glyph,
  )!;
}

describe('kana answer grading', () => {
  it('is case-insensitive and whitespace tolerant', () => {
    expect(normalizeAnswer('  SHI \n')).toBe('shi');
    expect(classifyAnswer(byGlyph('し'), '  SHI ')).toBe('exact');
  });

  it.each([
    ['し', 'si'],
    ['ち', 'ti'],
    ['つ', 'tu'],
    ['ふ', 'hu'],
    ['を', 'o'],
    ['ん', 'nn'],
  ])('accepts common alternative %s → %s', (glyph, answer) => {
    expect(classifyAnswer(byGlyph(glyph), answer)).toBe('accepted_alias');
  });

  it('rejects an unrelated reading', () => {
    expect(classifyAnswer(byGlyph('ら'), 'ri')).toBe('incorrect');
  });
});
