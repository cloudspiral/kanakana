import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialSnapshot } from '@/data/initialState';
import { BUNDLED_MANIFEST } from '@/domain/curriculum';
import type { LearnerSnapshot, ReviewAttempt } from '@/domain/types';

const invoke = vi.fn();

vi.mock('expo-crypto', () => {
  let id = 0;
  return { randomUUID: () => `test-id-${++id}` };
});

vi.mock('../supabase', () => ({
  isCloudConfigured: true,
  supabase: { functions: { invoke } },
  ensureAnonymousUser: () => Promise.resolve('guest-1'),
}));

const { syncService } = await import('../sync');

function outboxOf(count: number): ReviewAttempt[] {
  return Array.from({ length: count }, (_, index) => ({
    eventId: `event-${index}`,
    sessionId: `session-${index}`,
    itemId: 'kana_a',
    skillId: 'kana_reading' as const,
    answer: 'a',
    classification: 'exact' as const,
    rating: Rating.Good as Rating.Good,
    responseMs: 500,
    exerciseVersion: 1,
    reviewedAt: '2026-07-29T00:00:00.000Z',
    expectedStateVersion: 0,
  }));
}

function snapshotWith(outbox: ReviewAttempt[]): LearnerSnapshot {
  return { ...createInitialSnapshot(), reviewOutbox: outbox };
}

function acceptAll() {
  invoke.mockImplementation(
    (_name: string, options: { body: { events: ReviewAttempt[] } }) =>
      Promise.resolve({
        data: {
          acceptedEventIds: options.body.events.map((event) => event.eventId),
          canonicalStates: [],
        },
        error: null,
      }),
  );
}

describe('review outbox submission', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('sends a long queue in batches the function will accept', async () => {
    acceptAll();

    const result = await syncService.sync(
      snapshotWith(outboxOf(120)),
      BUNDLED_MANIFEST,
    );

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(
      invoke.mock.calls.map((call) => call[1].body.events.length),
    ).toEqual([50, 50, 20]);
    expect(result.acceptedCount).toBe(120);
    expect(result.pendingCount).toBe(0);
    expect(result.cloudStatus).toBe('synced');
  });

  it('keeps the batches that landed when a later one fails', async () => {
    acceptAll();
    invoke.mockImplementationOnce(
      (_name: string, options: { body: { events: ReviewAttempt[] } }) =>
        Promise.resolve({
          data: {
            acceptedEventIds: options.body.events.map((event) => event.eventId),
            canonicalStates: [],
          },
          error: null,
        }),
    );
    invoke.mockImplementationOnce(() =>
      Promise.resolve({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code' },
      }),
    );

    const result = await syncService.sync(
      snapshotWith(outboxOf(120)),
      BUNDLED_MANIFEST,
    );

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(result.cloudStatus).toBe('error');
    expect(result.acceptedCount).toBe(50);
    expect(result.pendingCount).toBe(70);
    expect(result.acceptedEventIds).toHaveLength(50);
  });

  it('drops events the server will never take', async () => {
    const events = outboxOf(3);
    invoke.mockResolvedValue({
      data: {
        acceptedEventIds: ['event-0'],
        canonicalStates: [],
        rejected: [
          { eventId: 'event-1', reason: 'unknown_item_or_skill', permanent: true },
          { eventId: 'event-2', reason: 'deadlock detected', permanent: false },
        ],
      },
      error: null,
    });

    const result = await syncService.sync(snapshotWith(events), BUNDLED_MANIFEST);

    expect(result.acceptedEventIds).toEqual(['event-0']);
    expect(result.discardedEventIds).toEqual(['event-1']);
    // Only the transient one stays queued — the permanent one would jam it.
    expect(result.pendingCount).toBe(1);
    expect(result.acceptedCount).toBe(1);
    expect(result.error).toBe('1 review awaiting retry');
  });

  it('repairs the legacy practice session placeholder before sending', async () => {
    acceptAll();
    const [event] = outboxOf(1);

    await syncService.sync(
      snapshotWith([{ ...event, sessionId: 'practice' }]),
      BUNDLED_MANIFEST,
    );

    expect(invoke.mock.calls[0][1].body.events[0].sessionId).not.toBe(
      'practice',
    );
  });
});
