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
const DERIVED_WORDS: Record<string, string[]> = {
  が: ['えいが', 'がっこう'], ぎ: ['ぎんこう', 'かぎ'],
  ぐ: ['ぐあい', 'かぐ'], げ: ['げんき', 'ひげ'], ご: ['ごはん', 'りんご'],
  ざ: ['ざっし', 'ざせき'], じ: ['じかん', 'にじ'], ず: ['みず', 'ちず'],
  ぜ: ['ぜんぶ', 'かぜ'], ぞ: ['ぞう', 'かぞく'],
  だ: ['だいがく', 'からだ'], ぢ: ['はなぢ', 'ちぢむ'],
  づ: ['つづく', 'みかづき'], で: ['でんわ', 'うで'], ど: ['どうぶつ', 'まど'],
  ば: ['かばん', 'そば'], び: ['びょういん', 'ゆび'], ぶ: ['ぶた', 'こんぶ'],
  べ: ['べんきょう', 'たべる'], ぼ: ['ぼうし', 'とんぼ'],
  ぱ: ['かんぱい', 'いっぱい'], ぴ: ['えんぴつ', 'ぴったり'],
  ぷ: ['おんぷ', 'てんぷら'], ぺ: ['ぺこぺこ', 'ぺらぺら'],
  ぽ: ['さんぽ', 'しっぽ'],
};

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
  it('covers all 71 base and derived hiragana', () => {
    expect(GLYPHS).toHaveLength(71);
    expect(KNOWN.size).toBe(71);
  });

  it('returns a note only for the kana MEET_HINTS covers', () => {
    for (const glyph of GLYPHS) {
      expect(strokeNoteFor(glyph)).toBe(MEET_HINTS[glyph] ?? null);
    }
    expect(strokeNoteFor('ん')).toBeNull();
  });

  /**
   * Every screen showing a note already shows the count beside it — the Meet
   * pill, the trace header, the character page's row line — so a note that
   * counts strokes says it a second time.
   */
  it('never states a stroke count in a note', () => {
    for (const [glyph, hint] of Object.entries(MEET_HINTS)) {
      expect(hint, glyph).not.toMatch(
        /\b(one|two|three|four|five|\d+)\s+strokes?\b/i,
      );
    }
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

  it('gives every kana at least one example word', () => {
    for (const glyph of GLYPHS) {
      expect(WORDS[glyph]?.length ?? 0, `no words for ${glyph}`).toBeGreaterThan(
        0,
      );
    }
  });

  it('keeps the two fixed examples for every voiced form', () => {
    expect(Object.keys(DERIVED_WORDS)).toHaveLength(25);
    for (const [glyph, expected] of Object.entries(DERIVED_WORDS)) {
      expect(WORDS[glyph]?.map((entry) => entry.word)).toEqual(expected);
    }
  });

  it('retains only the meaningful extra confusions for derived kana', () => {
    const derivedGlyphs = BUNDLED_MANIFEST.items
      .filter((item) => item.content.derivedFrom)
      .map((item) => item.content.glyph);
    const derivedWithConfusions = derivedGlyphs.filter(
      (glyph) => (CONFUSIONS[glyph]?.length ?? 0) > 0,
    );
    expect(derivedWithConfusions.sort()).toEqual(
      ['じ', 'ず', 'ぢ', 'づ', 'ば', 'ぱ'].sort(),
    );
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
