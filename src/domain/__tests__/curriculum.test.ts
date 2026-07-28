import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST, GOJUON_ROWS } from '../curriculum';
import { curriculumManifestSchema, validateSupportedModules } from '../schemas';

describe('bundled hiragana curriculum', () => {
  it('contains all 46 unique basic modern hiragana', () => {
    expect(BUNDLED_MANIFEST.items).toHaveLength(46);
    expect(new Set(BUNDLED_MANIFEST.items.map((item) => item.id))).toHaveLength(
      46,
    );
    expect(
      new Set(BUNDLED_MANIFEST.items.map((item) => item.content.glyph)),
    ).toHaveLength(46);
  });

  it('keeps units in gojuon row order', () => {
    expect(BUNDLED_MANIFEST.units.map((unit) => unit.id)).toEqual(
      GOJUON_ROWS.map((row) => `unit-${row.id}`),
    );
    expect(BUNDLED_MANIFEST.units.map((unit) => unit.order)).toEqual(
      GOJUON_ROWS.map((_, index) => index),
    );
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
