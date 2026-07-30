import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../../domain/curriculum';

/**
 * The generated map is read as text rather than imported: it is full of
 * `require('….m4a')` calls that only Metro can resolve, so importing it under
 * Vitest would fail on the asset, not on anything we mean to assert.
 */
const source = readFileSync(
  fileURLToPath(new URL('../kanaAudioAssets.ts', import.meta.url)),
  'utf8',
);

const glyphKeys = new Set(
  [...source.matchAll(/^ {2}'(.+?)': CLIPS\./gmu)].map((match) => match[1]),
);

const manifestGlyphs = BUNDLED_MANIFEST.items.map((item) => item.content.glyph);

describe('bundled kana audio coverage', () => {
  it('has a clip for every glyph the curriculum teaches', () => {
    const missing = manifestGlyphs.filter((glyph) => !glyphKeys.has(glyph));
    expect(missing).toEqual([]);
  });

  it('covers all 71 base and derived glyphs', () => {
    expect(manifestGlyphs).toHaveLength(71);
  });

  it('maps katakana to the same recordings', () => {
    // Same sound, different script — あ and ア share a clip.
    const katakana = (hiragana: string) =>
      [...hiragana].map((c) => String.fromCodePoint(c.codePointAt(0)! + 0x60)).join('');
    const missing = manifestGlyphs
      .map(katakana)
      .filter((glyph) => !glyphKeys.has(glyph));
    expect(missing).toEqual([]);
  });

  it('resolves each glyph to a clip that exists on disk', () => {
    const clips = new Set(
      [...source.matchAll(/require\('\.\.\/\.\.\/assets\/audio\/kana\/(.+?)\.m4a'\)/g)]
        .map((match) => match[1]),
    );
    expect(clips.size).toBe(104);
    for (const name of clips) {
      expect(() =>
        readFileSync(
          fileURLToPath(new URL(`../../../assets/audio/kana/${name}.m4a`, import.meta.url)),
        ),
      ).not.toThrow();
    }
  });
});
