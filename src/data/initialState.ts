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
  const partial = stored as Partial<LearnerSnapshot>;
  return {
    ...initial,
    ...partial,
    settings: { ...initial.settings, ...partial.settings },
    sync: { ...initial.sync, ...partial.sync },
  };
}

export function createInitialSnapshot(): LearnerSnapshot {
  return {
    schemaVersion: 1,
    onboardingComplete: false,
    completedUnitIds: [],
    settings: {
      hapticsEnabled: true,
      tracingGuideEnabled: true,
      soundEnabled: true,
    },
    skillStates: {},
    reviewOutbox: [],
    activityEvents: [],
    activeSession: null,
    lastSummary: null,
    cachedManifest: null,
    sync: {
      cloudStatus: 'unconfigured',
      acceptedCount: 0,
    },
  };
}
