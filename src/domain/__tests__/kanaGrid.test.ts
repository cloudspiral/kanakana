import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import { createInitialSnapshot } from '@/data/initialState';
import { applyReview } from '../scheduler';
import { BUNDLED_MANIFEST } from '../curriculum';
import {
  kanaGridRows,
  lensProgress,
  voicedLensAvailable,
} from '../kanaGrid';
import { learnerStateKey } from '../types';

function introduced(...glyphs: string[]) {
  const snapshot = createInitialSnapshot();
  for (const glyph of glyphs) {
    const item = BUNDLED_MANIFEST.items.find(
      (candidate) => candidate.content.glyph === glyph,
    )!;
    snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')] =
      applyReview(
        undefined,
        item.id,
        'kana_reading',
        Rating.Good,
        new Date('2026-07-30T00:00:00.000Z'),
      );
  }
  return snapshot;
}

describe('kana grid lenses', () => {
  it('keeps week one at the original 46 cells without a lens', () => {
    const snapshot = introduced('あ', 'か');
    expect(voicedLensAvailable(BUNDLED_MANIFEST, snapshot)).toBe(false);
    expect(
      kanaGridRows(BUNDLED_MANIFEST, snapshot, 'plain')
        .flatMap((row) => row.cells)
        .filter((cell) => cell.glyph),
    ).toHaveLength(46);
    expect(lensProgress(BUNDLED_MANIFEST, snapshot, 'plain')).toEqual({
      introduced: 2,
      total: 46,
      label: 'kana',
    });
  });

  it('reveals ticks only for introduced children and both H-row marks', () => {
    const snapshot = introduced('が', 'ば', 'ぱ');
    const rows = kanaGridRows(BUNDLED_MANIFEST, snapshot, 'plain');
    expect(rows.find((row) => row.id === 'k')!.cells[0].tick).toBe('゛');
    expect(rows.find((row) => row.id === 'h')!.cells[0].tick).toBe('゛゜');
    expect(voicedLensAvailable(BUNDLED_MANIFEST, snapshot)).toBe(true);
  });

  it('shows every supported voiced cell and only blanks unsupported rows', () => {
    const snapshot = introduced('が', 'ぱ');
    const voiced = kanaGridRows(BUNDLED_MANIFEST, snapshot, 'dakuten');
    expect(voiced.find((row) => row.id === 'k')!.cells[0].glyph).toBe('が');
    expect(voiced.find((row) => row.id === 'k')!.cells[1].glyph).toBe('ぎ');
    expect(
      voiced.flatMap((row) => row.cells).filter((cell) => cell.glyph),
    ).toHaveLength(20);
    expect(voiced.find((row) => row.id === 'n')!.cells.every((cell) => !cell.glyph)).toBe(true);
    expect(voiced.find((row) => row.id === 'k')!.label).toBe('G ゛');

    const pRow = kanaGridRows(BUNDLED_MANIFEST, snapshot, 'handakuten');
    expect(pRow.find((row) => row.id === 'h')!.cells[0].glyph).toBe('ぱ');
    expect(
      pRow.flatMap((row) => row.cells).filter((cell) => cell.glyph),
    ).toHaveLength(5);
    expect(
      pRow
        .filter((row) => row.id !== 'h')
        .every((row) => row.cells.every((cell) => !cell.glyph)),
    ).toBe(true);
    expect(lensProgress(BUNDLED_MANIFEST, snapshot, 'handakuten').total).toBe(5);
  });

  it('keeps the complete P-row visible before any P kana is introduced', () => {
    const snapshot = introduced('が');
    const pRow = kanaGridRows(BUNDLED_MANIFEST, snapshot, 'handakuten');

    expect(
      pRow
        .find((row) => row.id === 'h')!
        .cells.map((cell) => cell.glyph),
    ).toEqual(['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ']);
  });
});
