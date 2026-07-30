import { Rating } from 'ts-fsrs';
import { describe, expect, it, vi } from 'vitest';

import { createInitialSnapshot } from '@/data/initialState';
import { BUNDLED_MANIFEST } from '../curriculum';
import {
  completeLessonDrawing,
  queuePracticeDrawing,
  visibleDrawingCount,
} from '../drawings';
import { applyReview } from '../scheduler';
import { buildLessonSession } from '../session';
import { learnerStateKey } from '../types';
import type { LearnerSnapshot } from '../types';

vi.mock('expo-crypto', () => {
  let id = 0;
  return { randomUUID: () => `drawing-test-${++id}` };
});

describe('visibleDrawingCount', () => {
  it('adds unsynced practice and review drawings to the canonical count', () => {
    const snapshot: LearnerSnapshot = {
      ...createInitialSnapshot(),
      drawingCounts: { 'hiragana-a': 4 },
      drawingOutbox: [
        {
          eventId: 'same-event',
          itemId: 'hiragana-a',
          source: 'lesson',
          sessionId: 'session-1',
          occurredAt: '2026-07-30T00:00:00.000Z',
        },
        {
          eventId: 'practice-event',
          itemId: 'hiragana-a',
          source: 'practice',
          sessionId: 'session-2',
          occurredAt: '2026-07-30T00:01:00.000Z',
        },
      ],
      reviewOutbox: [
        {
          eventId: 'same-event',
          sessionId: 'session-1',
          itemId: 'hiragana-a',
          skillId: 'kana_writing',
          answer: 'あ',
          classification: 'exact',
          rating: Rating.Good,
          responseMs: 0,
          exerciseVersion: 1,
          reviewedAt: '2026-07-30T00:00:00.000Z',
          expectedStateVersion: 0,
        },
        {
          eventId: 'review-event',
          sessionId: 'session-3',
          itemId: 'hiragana-a',
          skillId: 'kana_writing',
          answer: 'あ',
          classification: 'exact',
          rating: Rating.Good,
          responseMs: 600,
          exerciseVersion: 1,
          reviewedAt: '2026-07-30T00:02:00.000Z',
          expectedStateVersion: 1,
        },
      ],
    };

    expect(visibleDrawingCount(snapshot, 'hiragana-a')).toBe(7);
  });

  it('seeds lesson writing once and advances only after the trace event', () => {
    const snapshot = createInitialSnapshot();
    const unit = BUNDLED_MANIFEST.units[0];
    const session = buildLessonSession(
      BUNDLED_MANIFEST,
      unit,
      new Date('2026-07-30T00:00:00.000Z'),
    );
    snapshot.activeSession = session;
    const itemId = session.steps[0].itemId;
    const event = {
      eventId: session.steps[0].id,
      itemId,
      source: 'lesson' as const,
      sessionId: session.id,
      occurredAt: '2026-07-30T00:01:00.000Z',
    };

    expect(snapshot.activeSession.currentIndex).toBe(0);
    const first = completeLessonDrawing(snapshot, BUNDLED_MANIFEST, event);
    expect(first.session.currentIndex).toBe(1);
    expect(first.seededWriting).toBe(true);
    expect(
      first.snapshot.skillStates[learnerStateKey(itemId, 'kana_writing')].reps,
    ).toBe(1);
    expect(first.snapshot.reviewOutbox).toHaveLength(1);
    expect(first.snapshot.drawingOutbox).toHaveLength(1);

    const replay = completeLessonDrawing(
      first.snapshot,
      BUNDLED_MANIFEST,
      event,
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.snapshot.reviewOutbox).toHaveLength(1);
    expect(replay.snapshot.drawingOutbox).toHaveLength(1);
  });

  it('free practice changes no writing schedule fields', () => {
    const snapshot = createInitialSnapshot();
    const itemId = BUNDLED_MANIFEST.items[0].id;
    const state = applyReview(
      undefined,
      itemId,
      'kana_writing',
      Rating.Good,
      new Date('2026-07-29T00:00:00.000Z'),
    );
    snapshot.skillStates[learnerStateKey(itemId, 'kana_writing')] = state;

    const next = queuePracticeDrawing(snapshot, {
      eventId: 'practice-1',
      itemId,
      source: 'practice',
      sessionId: 'practice-session',
      occurredAt: '2026-07-30T00:00:00.000Z',
    });

    expect(next.skillStates[learnerStateKey(itemId, 'kana_writing')]).toEqual(
      state,
    );
    expect(next.reviewOutbox).toEqual([]);
    expect(next.drawingOutbox).toHaveLength(1);
  });
});
