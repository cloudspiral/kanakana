import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import {
  CONFUSIONS,
  MEET_HINTS,
  RESULTS,
  WORDS,
  strokeNoteFor,
} from '../kanaContent';

const GLYPHS = BUNDLED_MANIFEST.items.map((item) => String(item.content.glyph));
const KNOWN = new Set(GLYPHS);

/** Romaji is not needed to look a glyph up, but it makes failures readable. */
const romajiOf = new Map(
  BUNDLED_MANIFEST.items.map((item) => [
    String(item.content.glyph),
    String(item.content.primaryAnswer),
  ]),
);

/**
 * す lists みず, whose す appears in its voiced form ず. Authored that way in the
 * prototype and preserved deliberately; pinned here so the exception stays a
 * known one rather than a silent hole in the containment check.
 */
const KNOWN_UNHIGHLIGHTABLE: readonly (readonly [string, string])[] = [
  ['す', 'みず'],
];

describe('kana content tables', () => {
  it('covers all 46 hiragana', () => {
    expect(GLYPHS).toHaveLength(46);
    expect(KNOWN.size).toBe(46);
  });

  it('gives every kana a stroke note, falling back where MEET_HINTS stops', () => {
    for (const glyph of GLYPHS) {
      const note = strokeNoteFor(glyph, 2);
      expect(note.length, `no stroke note for ${glyph}`).toBeGreaterThan(0);
    }
  });

  it('uses the prototype fallback only for kana MEET_HINTS does not cover', () => {
    for (const glyph of GLYPHS) {
      const hint = MEET_HINTS[glyph];
      const resolved = strokeNoteFor(glyph, 3);
      if (hint) {
        expect(resolved).toBe(hint);
      } else {
        expect(resolved).toBe(
          '3 strokes. Follow the faint guide, then try it once without.',
        );
      }
    }
    expect(strokeNoteFor('ん', 1)).toBe(
      'One stroke. Follow the faint guide, then try it once without.',
    );
  });

  it('keys every table by a glyph the curriculum actually teaches', () => {
    for (const [name, table] of [
      ['MEET_HINTS', MEET_HINTS],
      ['WORDS', WORDS],
      ['CONFUSIONS', CONFUSIONS],
    ] as const) {
      for (const glyph of Object.keys(table)) {
        expect(KNOWN.has(glyph), `${name} has unknown key ${glyph}`).toBe(true);
      }
    }
  });

  it('only points at kana the curriculum teaches, and never at itself', () => {
    for (const [glyph, entries] of Object.entries(CONFUSIONS)) {
      for (const entry of entries) {
        expect(
          KNOWN.has(entry.glyph),
          `${glyph} is confused with unknown glyph ${entry.glyph}`,
        ).toBe(true);
        expect(entry.glyph).not.toBe(glyph);
        expect(entry.romaji).toBe(romajiOf.get(entry.glyph));
        expect(entry.note.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives every kana at least one example word and one confusion', () => {
    for (const glyph of GLYPHS) {
      expect(WORDS[glyph]?.length ?? 0, `no words for ${glyph}`).toBeGreaterThan(
        0,
      );
      expect(
        CONFUSIONS[glyph]?.length ?? 0,
        `no confusions for ${glyph}`,
      ).toBeGreaterThan(0);
    }
  });

  it('puts the target character inside its own example words', () => {
    const missing: [string, string][] = [];
    for (const [glyph, words] of Object.entries(WORDS)) {
      for (const entry of words) {
        expect(entry.romaji.length).toBeGreaterThan(0);
        expect(entry.gloss.length).toBeGreaterThan(0);
        if (!entry.word.includes(glyph)) {
          missing.push([glyph, entry.word]);
        }
      }
    }
    expect(missing).toEqual(KNOWN_UNHIGHLIGHTABLE.map((pair) => [...pair]));
  });

  it('writes example words in kana only', () => {
    for (const words of Object.values(WORDS)) {
      for (const entry of words) {
        expect(entry.word).toMatch(/^[぀-ゟ]+$/);
      }
    }
  });

  it('carries copy for all five trace verdicts', () => {
    expect(Object.keys(RESULTS).sort()).toEqual([
      'clean',
      'guided',
      'loose',
      'order',
      'partial',
    ]);
    for (const verdict of Object.values(RESULTS)) {
      expect(verdict.label.length).toBeGreaterThan(0);
      expect(verdict.copy.length).toBeGreaterThan(0);
      expect(verdict.accent).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
