import type { LearnerSnapshot } from '@/domain/types';

/**
 * Merge a stored snapshot onto current defaults.
 *
 * A plain top-level spread is not enough: `settings` is a nested object, so a
 * snapshot written before a setting existed would replace the defaults wholesale
 * and leave the new key undefined for every returning learner.
 */
export function hydrateSnapshot(stored: unknown): LearnerSnapshot {
  const initial = createInitialSnapshot();
  if (!stored || typeof stored !== 'object') {
    return initial;
  }
  const partial: Partial<LearnerSnapshot> & { activityEvents?: unknown } = {
    ...(stored as Partial<LearnerSnapshot>),
  };
  // activityEvents was a local trail nothing ever read. Dropping it on load is
  // what actually clears it from snapshots written before it was removed —
  // otherwise the spread below would carry it forward for good.
  delete partial.activityEvents;
  const legacyDrawingCounts =
    partial.drawingCounts ??
    Object.fromEntries(
      Object.values(partial.skillStates ?? {})
        .filter((state) => state.skillId === 'kana_writing' && state.reps > 0)
        .map((state) => [state.itemId, state.reps]),
    );
  return {
    ...initial,
    ...partial,
    schemaVersion: initial.schemaVersion,
    settings: { ...initial.settings, ...partial.settings },
    drawingCounts: legacyDrawingCounts,
    drawingOutbox: partial.drawingOutbox ?? [],
    sync: { ...initial.sync, ...partial.sync },
  };
}

export function createInitialSnapshot(): LearnerSnapshot {
  return {
    schemaVersion: 2,
    onboardingComplete: false,
    completedUnitIds: [],
    settings: {
      hapticsEnabled: true,
      tracingGuideEnabled: true,
      soundEnabled: true,
    },
    skillStates: {},
    reviewOutbox: [],
    drawingCounts: {},
    drawingOutbox: [],
    activeSession: null,
    lastSummary: null,
    cachedManifest: null,
    sync: {
      cloudStatus: 'unconfigured',
      acceptedCount: 0,
    },
  };
}
