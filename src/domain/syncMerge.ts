import {
  learnerStateKey,
  type LearnerSkillState,
  type LearnerSnapshot,
  type SyncResult,
} from './types';

/**
 * Apply a completed cloud sync to the newest local snapshot.
 *
 * The snapshot sent to the server may be older than the learner's current
 * session by the time the request finishes. Always preserve newer local
 * navigation, settings, summaries and queued events; only remove events the
 * server settled and adopt canonical skill states that are at least as new as
 * the local copy.
 */
export function mergeCompletedSync(
  latest: LearnerSnapshot,
  result: SyncResult,
  completedAt = new Date(),
): LearnerSnapshot {
  const skillStates = { ...latest.skillStates };
  for (const canonical of result.canonicalStates) {
    const key = learnerStateKey(canonical.itemId, canonical.skillId);
    const local: LearnerSkillState | undefined = skillStates[key];
    if (!local || canonical.version >= local.version) {
      skillStates[key] = canonical;
    }
  }

  const settledIds = new Set([
    ...result.acceptedEventIds,
    ...result.discardedEventIds,
  ]);
  const drawingsFullySynced = result.cloudStatus === 'synced';
  const settledDrawingIds = new Set(
    drawingsFullySynced
      ? [
          ...result.acceptedDrawingEventIds,
          ...result.discardedDrawingEventIds,
        ]
      : [],
  );
  const acceptedDelta =
    result.acceptedCount +
    (drawingsFullySynced ? result.acceptedDrawingEventIds.length : 0);

  return {
    ...latest,
    skillStates,
    reviewOutbox: latest.reviewOutbox.filter(
      (event) => !settledIds.has(event.eventId),
    ),
    drawingCounts: drawingsFullySynced
      ? result.canonicalDrawingCounts
      : latest.drawingCounts,
    drawingOutbox: latest.drawingOutbox.filter(
      (event) => !settledDrawingIds.has(event.eventId),
    ),
    sync: {
      cloudStatus: result.cloudStatus,
      guestId: result.guestId ?? latest.sync.guestId,
      lastSyncAt:
        result.cloudStatus === 'synced'
          ? completedAt.toISOString()
          : latest.sync.lastSyncAt,
      lastError: result.error,
      acceptedCount: latest.sync.acceptedCount + acceptedDelta,
    },
  };
}
