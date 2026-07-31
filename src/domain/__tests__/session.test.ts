import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import {
  buildLessonSession,
  buildReviewSession,
  insertRecheck,
  recordAttempt,
  resolveReviewSessionId,
  reviewTargetKey,
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

  it('keeps reading and writing distinct for the same kana', () => {
    const [a, i] = BUNDLED_MANIFEST.items;
    const session = buildReviewSession(BUNDLED_MANIFEST, [
      { item: a, skillId: 'kana_reading' },
      { item: a, skillId: 'kana_writing' },
      { item: i, skillId: 'kana_reading' },
    ]);

    expect(
      session.steps.map((step) => ({
        itemId: step.itemId,
        skillId: step.skillId,
        moduleType: step.moduleType,
      })),
    ).toEqual([
      {
        itemId: a.id,
        skillId: 'kana_reading',
        moduleType: 'kana-reading-input-v1',
      },
      {
        itemId: i.id,
        skillId: 'kana_reading',
        moduleType: 'kana-reading-input-v1',
      },
      {
        itemId: a.id,
        skillId: 'kana_writing',
        moduleType: 'kana-writing-input-v1',
      },
    ]);
  });

  it('gives reading and writing previews distinct React keys', () => {
    const item = BUNDLED_MANIFEST.items[5];
    const targets = [
      { item, skillId: 'kana_reading' as const },
      { item, skillId: 'kana_writing' as const },
    ];

    expect(targets.map(reviewTargetKey)).toEqual([
      `${item.id}:kana_reading`,
      `${item.id}:kana_writing`,
    ]);
    expect(new Set(targets.map(reviewTargetKey))).toHaveLength(2);
  });
});

describe('grading a prompt', () => {
  const reviewSession = () =>
    buildReviewSession(
      BUNDLED_MANIFEST,
      BUNDLED_MANIFEST.items
        .slice(0, 5)
        .map((item) => ({ item, skillId: 'kana_reading' as const })),
    );

  it('tallies a hit and moves on', () => {
    const session = reviewSession();
    const graded = recordAttempt(session, session.steps[0], true);

    expect(graded.currentIndex).toBe(1);
    expect(graded.steps).toHaveLength(session.steps.length);
    expect(graded.outcomes).toMatchObject({
      strengthenedItemIds: [session.steps[0].itemId],
      againItemIds: [],
      correctAttempts: 1,
      totalAttempts: 1,
    });
  });

  it('re-queues a miss for a recheck without re-counting the item', () => {
    const session = reviewSession();
    const failed = session.steps[0];
    const graded = recordAttempt(session, failed, false);

    expect(graded.outcomes).toMatchObject({
      strengthenedItemIds: [],
      againItemIds: [failed.itemId],
      correctAttempts: 0,
      totalAttempts: 1,
    });
    // Three prompts intervene before the retry: it lands three past the one
    // the learner is about to see, not three past the one they just missed.
    const recheck = graded.steps[4];
    expect(recheck.itemId).toBe(failed.itemId);
    expect(recheck.isRecheck).toBe(true);
    // A fresh step ID keeps the retry from colliding with the original review
    // event, which the server keys on.
    expect(recheck.id).not.toBe(failed.id);
  });

  it('counts a second miss of the same item once in the tally', () => {
    const session = reviewSession();
    const once = recordAttempt(session, session.steps[0], false);
    const twice = recordAttempt(once, once.steps[1], false);

    expect(twice.outcomes.againItemIds).toEqual([
      session.steps[0].itemId,
      once.steps[1].itemId,
    ]);
    expect(twice.outcomes.totalAttempts).toBe(2);
  });
});

describe('review event session IDs', () => {
  it('keeps the active practice session ID', () => {
    const activeSessionId = 'bc6ccab1-dcac-47c2-9f35-b6397ccde601';

    expect(resolveReviewSessionId(activeSessionId)).toBe(activeSessionId);
  });

  it('mints a session ID for standalone practice', () => {
    const first = resolveReviewSessionId(undefined);
    const second = resolveReviewSessionId(undefined);

    expect(first).toMatch(/^test-id-\d+$/);
    expect(second).not.toBe(first);
  });

  it('repairs the legacy practice placeholder', () => {
    expect(resolveReviewSessionId('practice')).toMatch(/^test-id-\d+$/);
  });
});
