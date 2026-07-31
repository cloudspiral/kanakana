import { beforeEach, describe, expect, it } from 'vitest';

import { createInitialSnapshot } from '../initialState';
import { BrowserLearningRepository } from '../repository.web';

class LocalStorageFake {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

describe('browser learning repository', () => {
  const storage = new LocalStorageFake();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
  });

  it('persists onboarding, active sessions, and outbox events across instances', async () => {
    const repository = new BrowserLearningRepository();
    const snapshot = createInitialSnapshot();
    snapshot.onboardingComplete = true;
    snapshot.reviewOutbox.push({
      eventId: 'event-1',
      sessionId: 'session-1',
      itemId: 'hiragana-vowels-a',
      skillId: 'kana_reading',
      answer: 'a',
      classification: 'exact',
      rating: 3,
      responseMs: 900,
      exerciseVersion: 1,
      reviewedAt: '2026-07-28T12:00:00.000Z',
      dayEndsAt: '2026-07-29T05:00:00.000Z',
      expectedStateVersion: 0,
    });
    await repository.saveSnapshot(snapshot);

    const restarted = new BrowserLearningRepository();
    const loaded = await restarted.loadSnapshot();
    expect(loaded.onboardingComplete).toBe(true);
    expect(loaded.reviewOutbox).toHaveLength(1);
    expect(loaded.reviewOutbox[0].eventId).toBe('event-1');
    expect(loaded.reviewOutbox[0].dayEndsAt).toBe(
      '2026-07-29T05:00:00.000Z',
    );
  });

  it('returns a clean durable default after reset', async () => {
    const repository = new BrowserLearningRepository();
    const snapshot = createInitialSnapshot();
    snapshot.onboardingComplete = true;
    await repository.saveSnapshot(snapshot);
    await repository.reset();
    expect(await repository.loadSnapshot()).toEqual(createInitialSnapshot());
  });
});
