import { Rating } from 'ts-fsrs';

import { getItem } from './curriculum';
import { applyReview, localDayEndsAt, WRITING_SKILL } from './scheduler';
import { currentStep, unique } from './session';
import {
  learnerStateKey,
  type ActivePracticeSession,
  type CurriculumManifest,
  type DrawingEvent,
  type LearnerSnapshot,
} from './types';

/**
 * Count completed drawings without treating FSRS repetitions as practice.
 *
 * Canonical totals come from the server. Until an event is accepted, its
 * outbox entry keeps the UI responsive offline. Writing review events count as
 * drawings too, and an event ID present in both queues is counted only once.
 */
export function visibleDrawingCount(
  snapshot: LearnerSnapshot,
  itemId: string,
): number {
  const pendingIds = new Set(
    snapshot.drawingOutbox
      .filter((event) => event.itemId === itemId)
      .map((event) => event.eventId),
  );
  for (const event of snapshot.reviewOutbox) {
    if (event.itemId === itemId && event.skillId === 'kana_writing') {
      pendingIds.add(event.eventId);
    }
  }
  return (snapshot.drawingCounts[itemId] ?? 0) + pendingIds.size;
}

function hasEvent(snapshot: LearnerSnapshot, eventId: string): boolean {
  return (
    snapshot.drawingOutbox.some((event) => event.eventId === eventId) ||
    snapshot.reviewOutbox.some((event) => event.eventId === eventId)
  );
}

/** Queue schedule-neutral drawing practice exactly once. */
export function queuePracticeDrawing(
  snapshot: LearnerSnapshot,
  event: DrawingEvent,
): LearnerSnapshot {
  if (event.source === 'lesson') {
    throw new Error('Lesson drawings must complete their active introduction.');
  }
  return hasEvent(snapshot, event.eventId)
    ? snapshot
    : {
        ...snapshot,
        drawingOutbox: [...snapshot.drawingOutbox, event],
      };
}

export interface LessonDrawingCompletion {
  snapshot: LearnerSnapshot;
  session: ActivePracticeSession;
  seededWriting: boolean;
  duplicate: boolean;
}

/**
 * Complete the active introduction as one idempotent local transaction.
 *
 * The drawing is always counted. The first lesson trace also creates the
 * writing card; later lessons for an already-scheduled character leave that
 * card untouched.
 */
export function completeLessonDrawing(
  snapshot: LearnerSnapshot,
  manifest: CurriculumManifest,
  event: DrawingEvent,
): LessonDrawingCompletion {
  const session = snapshot.activeSession;
  if (hasEvent(snapshot, event.eventId)) {
    if (!session) {
      throw new Error('The completed lesson is no longer active.');
    }
    return {
      snapshot,
      session,
      seededWriting: false,
      duplicate: true,
    };
  }
  const activeStep = currentStep(session);
  if (
    event.source !== 'lesson' ||
    !session ||
    !activeStep ||
    activeStep.kind !== 'introduction' ||
    activeStep.itemId !== event.itemId ||
    event.sessionId !== session.id
  ) {
    throw new Error('This lesson trace is no longer the active introduction.');
  }

  const item = getItem(manifest, event.itemId);
  const reviewedAt = new Date(event.occurredAt);
  if (Number.isNaN(reviewedAt.getTime())) {
    throw new Error('The drawing completion time is invalid.');
  }
  const dayEndsAt = localDayEndsAt(reviewedAt);
  const stateKey = learnerStateKey(event.itemId, WRITING_SKILL);
  const previousState = snapshot.skillStates[stateKey];
  const nextSession: ActivePracticeSession = {
    ...session,
    currentIndex: session.currentIndex + 1,
    updatedAt: event.occurredAt,
    outcomes: {
      ...session.outcomes,
      introducedItemIds: unique([
        ...session.outcomes.introducedItemIds,
        activeStep.itemId,
      ]),
    },
  };

  return {
    session: nextSession,
    seededWriting: !previousState,
    duplicate: false,
    snapshot: {
      ...snapshot,
      activeSession: nextSession,
      drawingOutbox: [...snapshot.drawingOutbox, event],
      skillStates: previousState
        ? snapshot.skillStates
        : {
            ...snapshot.skillStates,
            [stateKey]: applyReview(
              undefined,
              event.itemId,
              WRITING_SKILL,
              Rating.Good,
              reviewedAt,
              dayEndsAt,
            ),
          },
      reviewOutbox: previousState
        ? snapshot.reviewOutbox
        : [
            ...snapshot.reviewOutbox,
            {
              eventId: event.eventId,
              sessionId: session.id,
              itemId: event.itemId,
              skillId: WRITING_SKILL,
              answer: item.content.glyph,
              classification: 'exact',
              rating: Rating.Good,
              responseMs: 0,
              exerciseVersion: activeStep.moduleSchemaVersion,
              reviewedAt: event.occurredAt,
              dayEndsAt: dayEndsAt.toISOString(),
              expectedStateVersion: 0,
            },
          ],
    },
  };
}
