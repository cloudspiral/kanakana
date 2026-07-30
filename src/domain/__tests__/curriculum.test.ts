import { describe, expect, it } from 'vitest';

import {
  BUNDLED_MANIFEST,
  CURRICULUM_ROWS,
  DAKUTEN_KANA_COUNT,
  HANDAKUTEN_KANA_COUNT,
  TOTAL_KANA_COUNT,
} from '../curriculum';
import { curriculumManifestSchema, validateSupportedModules } from '../schemas';

describe('bundled hiragana curriculum', () => {
  it('contains 46 base and 25 independently scheduled derived kana', () => {
    expect(BUNDLED_MANIFEST.version).toBe(3);
    expect(BUNDLED_MANIFEST.items).toHaveLength(TOTAL_KANA_COUNT);
    expect(new Set(BUNDLED_MANIFEST.items.map((item) => item.id))).toHaveLength(
      TOTAL_KANA_COUNT,
    );
    expect(
      new Set(BUNDLED_MANIFEST.items.map((item) => item.content.glyph)),
    ).toHaveLength(TOTAL_KANA_COUNT);
    expect(
      BUNDLED_MANIFEST.items.filter((item) => !item.content.derivedFrom),
    ).toHaveLength(46);
    expect(
      BUNDLED_MANIFEST.items.filter((item) => item.content.mark === 'dakuten'),
    ).toHaveLength(DAKUTEN_KANA_COUNT);
    expect(
      BUNDLED_MANIFEST.items.filter(
        (item) => item.content.mark === 'handakuten',
      ),
    ).toHaveLength(HANDAKUTEN_KANA_COUNT);
  });

  it('interleaves voiced units immediately after their base rows', () => {
    expect(BUNDLED_MANIFEST.units.map((unit) => unit.id)).toEqual(
      CURRICULUM_ROWS.map((row) => `unit-${row.id}`),
    );
    expect(BUNDLED_MANIFEST.units.map((unit) => unit.order)).toEqual(
      CURRICULUM_ROWS.map((_, index) => index),
    );
    expect(BUNDLED_MANIFEST.units).toHaveLength(16);
  });

  it('keeps reciprocal base and derived links in the same grid cell', () => {
    for (const item of BUNDLED_MANIFEST.items) {
      if (item.content.derivedFrom) {
        const parent = BUNDLED_MANIFEST.items.find(
          (candidate) => candidate.id === item.content.derivedFrom,
        );
        expect(parent, item.id).toBeDefined();
        expect(parent!.content.derivedForms).toContain(item.id);
        expect(parent!.content.column).toBe(item.content.column);
      }
    }

    const hRow = BUNDLED_MANIFEST.items.filter(
      (item) => item.content.rowId === 'h' && !item.content.derivedFrom,
    );
    expect(hRow).toHaveLength(5);
    for (const item of hRow) {
      expect(item.content.derivedForms).toHaveLength(2);
    }
  });

  it('uses Hepburn primaries with the requested accepted aliases', () => {
    const byGlyph = Object.fromEntries(
      BUNDLED_MANIFEST.items.map((item) => [item.content.glyph, item]),
    );
    expect(byGlyph['じ'].content).toMatchObject({
      primaryAnswer: 'ji',
      acceptedAnswers: ['ji', 'zi'],
    });
    expect(byGlyph['ぢ'].content).toMatchObject({
      primaryAnswer: 'ji',
      acceptedAnswers: ['ji', 'di'],
    });
    expect(byGlyph['づ'].content).toMatchObject({
      primaryAnswer: 'zu',
      acceptedAnswers: ['zu', 'du'],
    });
  });

  it('targets generic item and skill pairs from every assessed module', () => {
    for (const unit of BUNDLED_MANIFEST.units) {
      for (const module of unit.modules) {
        expect(module.targets.length).toBeGreaterThan(0);
        for (const target of module.targets) {
          expect(target.itemId).toMatch(/^hiragana-/);
          expect(target.skillId).toBe('kana_reading');
        }
      }
    }
  });

  it('rejects an unsupported remote module instead of activating it', () => {
    const invalid = structuredClone(BUNDLED_MANIFEST);
    invalid.units[0].modules[0].moduleType = 'unshipped-game-v1';
    const structurallyValid = curriculumManifestSchema.parse(invalid);
    expect(() => validateSupportedModules(structurallyValid)).toThrow(
      'Unsupported module renderer',
    );
  });
});
