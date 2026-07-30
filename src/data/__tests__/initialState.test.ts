import { describe, expect, it } from 'vitest';
import { Rating } from 'ts-fsrs';

import { createInitialSnapshot, hydrateSnapshot } from '../initialState';
import { applyReview } from '@/domain/scheduler';
import { learnerStateKey } from '@/domain/types';

describe('hydrating a stored snapshot', () => {
  it('fills in settings added since the snapshot was written', () => {
    const hydrated = hydrateSnapshot({
      onboardingComplete: true,
      settings: { hapticsEnabled: false },
    });

    expect(hydrated.settings).toEqual({
      ...createInitialSnapshot().settings,
      hapticsEnabled: false,
    });
    expect(hydrated.onboardingComplete).toBe(true);
  });

  it('drops the retired activityEvents trail', () => {
    const hydrated = hydrateSnapshot({
      onboardingComplete: true,
      activityEvents: [
        { id: 'a', type: 'item_exposed', sessionId: 's', occurredAt: 'now' },
      ],
    });

    expect('activityEvents' in hydrated).toBe(false);
  });

  it('uses legacy writing repetitions until canonical drawing counts sync', () => {
    const itemId = 'hiragana-vowels-a';
    let writing = applyReview(
      undefined,
      itemId,
      'kana_writing',
      Rating.Good,
      new Date('2026-07-28T00:00:00.000Z'),
    );
    writing = applyReview(
      writing,
      itemId,
      'kana_writing',
      Rating.Good,
      new Date('2026-07-29T00:00:00.000Z'),
    );
    const hydrated = hydrateSnapshot({
      skillStates: {
        [learnerStateKey(itemId, 'kana_writing')]: writing,
      },
    });

    expect(hydrated.drawingCounts).toEqual({ [itemId]: 2 });
    expect(hydrated.drawingOutbox).toEqual([]);
    expect(hydrated.schemaVersion).toBe(createInitialSnapshot().schemaVersion);
  });

  it('falls back to a fresh snapshot for unusable input', () => {
    expect(hydrateSnapshot(null)).toEqual(createInitialSnapshot());
    expect(hydrateSnapshot('nonsense')).toEqual(createInitialSnapshot());
  });
});
