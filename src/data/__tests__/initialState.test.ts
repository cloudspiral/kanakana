import { describe, expect, it } from 'vitest';

import { createInitialSnapshot, hydrateSnapshot } from '../initialState';

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

  it('falls back to a fresh snapshot for unusable input', () => {
    expect(hydrateSnapshot(null)).toEqual(createInitialSnapshot());
    expect(hydrateSnapshot('nonsense')).toEqual(createInitialSnapshot());
  });
});
