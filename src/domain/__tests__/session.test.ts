import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import {
  buildLessonSession,
  buildReviewSession,
  insertRecheck,
} from '../session';

vi.mock('expo-crypto', () => {
  let id = 0;
  return {
    randomUUID: () => `test-id-${++id}`,
  };
});

describe('practice queue construction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('meets every kana in the row before asking for any of them', () => {
    const unit = BUNDLED_MANIFEST.units[0];
    const session = buildLessonSession(
      BUNDLED_MANIFEST,
      unit,
      new Date('2026-07-28T12:00:00.000Z'),
    );
    const kinds = session.steps.map((step) => step.kind);

    // No assessment may appear before the last introduction: being asked for か
    // straight after meeting き is the thing this ordering exists to prevent.
    expect(kinds.lastIndexOf('introduction')).toBeLessThan(
      kinds.indexOf('assessment'),
    );
  });

  it('introduces and then checks each kana in the row exactly once', () => {
    const session = buildLessonSession(
      BUNDLED_MANIFEST,
      BUNDLED_MANIFEST.units[0],
    );
    const introduced = session.steps
      .filter((step) => step.kind === 'introduction')
      .map((step) => step.itemId);
    const assessed = session.steps
      .filter((step) => step.kind === 'assessment')
      .map((step) => step.itemId);

    expect(introduced).toHaveLength(5);
    expect(new Set(introduced).size).toBe(5);
    expect(new Set(assessed)).toEqual(new Set(introduced));
  });

  it('requeues a miss after intervening prompts', () => {
    const session = buildLessonSession(
      BUNDLED_MANIFEST,
      BUNDLED_MANIFEST.units[0],
    );
    session.currentIndex = 3;
    const failed = session.steps[2];
    const updated = insertRecheck(session, failed);
    const recheckIndex = updated.steps.findIndex(
      (step) => step.isRecheck && step.itemId === failed.itemId,
    );
    expect(recheckIndex).toBeGreaterThanOrEqual(session.currentIndex + 2);
    expect(updated.steps[recheckIndex].isRecheck).toBe(true);
  });

  it('mixes rows in due review queues when possible', () => {
    const items = [
      ...BUNDLED_MANIFEST.items.filter(
        (item) => item.content.rowId === 'vowels',
      ).slice(0, 2),
      ...BUNDLED_MANIFEST.items.filter(
        (item) => item.content.rowId === 'k',
      ).slice(0, 2),
    ];
    const session = buildReviewSession(
    BUNDLED_MANIFEST,
    items.map((item) => ({ item, skillId: 'kana_reading' as const })),
  );
    const rows = session.steps.map(
      (step) =>
        BUNDLED_MANIFEST.items.find((item) => item.id === step.itemId)!.content
          .rowId,
    );
    expect(rows).toEqual(['vowels', 'k', 'vowels', 'k']);
  });
});
