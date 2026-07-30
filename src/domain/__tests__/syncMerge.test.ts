import { Rating } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';

import { createInitialSnapshot } from '@/data/initialState';
import { BUNDLED_MANIFEST } from '@/domain/curriculum';
import { applyReview } from '@/domain/scheduler';
import { buildReviewSession } from '@/domain/session';
import { mergeCompletedSync } from '@/domain/syncMerge';
import {
  learnerStateKey,
  type ReviewAttempt,
  type SyncResult,
} from '@/domain/types';

vi.mock('expo-crypto', () => ({
  randomUUID: () => 'sync-merge-test-id',
}));

function reviewEvent(
  eventId: string,
  expectedStateVersion: number,
): ReviewAttempt {
  const item = BUNDLED_MANIFEST.items[0];
  return {
    eventId,
    sessionId: 'sync-merge-test-session',
    itemId: item.id,
    skillId: 'kana_reading',
    answer: item.content.primaryAnswer,
    classification: 'exact',
    rating: Rating.Good,
    responseMs: 500,
    exerciseVersion: 1,
    reviewedAt: '2026-07-30T12:00:00.000Z',
    expectedStateVersion,
  };
}

describe('completed sync merging', () => {
  it('cannot roll an active review session or newer local state backward', () => {
    const item = BUNDLED_MANIFEST.items[0];
    const stateKey = learnerStateKey(item.id, 'kana_reading');
    const firstState = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date('2026-07-29T12:00:00.000Z'),
    );
    const secondState = applyReview(
      firstState,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date('2026-07-30T12:00:00.000Z'),
    );
    const session = buildReviewSession(BUNDLED_MANIFEST, [
      { item, skillId: 'kana_reading' },
      { item: BUNDLED_MANIFEST.items[1], skillId: 'kana_reading' },
    ]);
    const latest = {
      ...createInitialSnapshot(),
      activeSession: { ...session, currentIndex: 1 },
      skillStates: { [stateKey]: secondState },
      reviewOutbox: [reviewEvent('settled-event', 0), reviewEvent('new-event', 1)],
      sync: {
        cloudStatus: 'syncing' as const,
        guestId: 'guest-id',
        acceptedCount: 4,
      },
    };
    const result: SyncResult = {
      pendingCount: 0,
      acceptedCount: 1,
      acceptedEventIds: ['settled-event'],
      discardedEventIds: [],
      pendingDrawingCount: 0,
      acceptedDrawingEventIds: [],
      discardedDrawingEventIds: [],
      canonicalDrawingCounts: {},
      canonicalStates: [firstState],
      guestId: 'guest-id',
      cloudStatus: 'synced',
    };

    const merged = mergeCompletedSync(
      latest,
      result,
      new Date('2026-07-30T12:01:00.000Z'),
    );

    expect(merged.activeSession?.currentIndex).toBe(1);
    expect(merged.reviewOutbox.map((event) => event.eventId)).toEqual([
      'new-event',
    ]);
    expect(merged.skillStates[stateKey].version).toBe(secondState.version);
    expect(merged.sync.acceptedCount).toBe(5);
  });
});
