import type { LearnerSnapshot } from '@/domain/types';

export function createInitialSnapshot(): LearnerSnapshot {
  return {
    schemaVersion: 1,
    onboardingComplete: false,
    completedUnitIds: [],
    settings: {
      hapticsEnabled: true,
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
