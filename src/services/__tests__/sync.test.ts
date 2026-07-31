import { Rating } from 'ts-fsrs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialSnapshot } from '@/data/initialState';
import { BUNDLED_MANIFEST } from '@/domain/curriculum';
import type {
  DrawingEvent,
  LearnerSnapshot,
  ReviewAttempt,
} from '@/domain/types';

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
    (name: string, options: { body: { events: (ReviewAttempt | DrawingEvent)[] } }) =>
      Promise.resolve(name === 'submit-drawings' ? {
        data: {
          acceptedEventIds: options.body.events.map((event) => event.eventId),
          canonicalCounts: { kana_a: 7 },
        },
        error: null,
      } : {
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

    const reviewCalls = invoke.mock.calls.filter(
      (call) => call[0] === 'submit-reviews',
    );
    expect(reviewCalls).toHaveLength(3);
    expect(
      reviewCalls.map((call) => call[1].body.events.length),
    ).toEqual([50, 50, 20]);
    expect(invoke).toHaveBeenLastCalledWith('submit-drawings', {
      body: { events: [] },
    });
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

    expect(
      invoke.mock.calls.filter((call) => call[0] === 'submit-reviews'),
    ).toHaveLength(2);
    expect(result.cloudStatus).toBe('error');
    expect(result.acceptedCount).toBe(50);
    expect(result.pendingCount).toBe(70);
    expect(result.acceptedEventIds).toHaveLength(50);
  });

  it('drops events the server will never take', async () => {
    const events = outboxOf(3);
    invoke.mockImplementation((name: string) => {
      if (name === 'submit-drawings') {
        return Promise.resolve({
          data: { acceptedEventIds: [], canonicalCounts: {} },
          error: null,
        });
      }
      return Promise.resolve({
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

    const reviewCall = invoke.mock.calls.find(
      (call) => call[0] === 'submit-reviews',
    )!;
    expect(reviewCall[1].body.events[0].sessionId).not.toBe(
      'practice',
    );
  });

  it('forwards new day boundaries while preserving legacy events without one', async () => {
    acceptAll();
    const [legacy, current] = outboxOf(2);
    current.dayEndsAt = '2026-07-30T05:00:00.000Z';

    await syncService.sync(
      snapshotWith([legacy, current]),
      BUNDLED_MANIFEST,
    );

    const reviewCall = invoke.mock.calls.find(
      (call) => call[0] === 'submit-reviews',
    )!;
    const sentEvents = reviewCall[1].body.events as ReviewAttempt[];
    expect('dayEndsAt' in sentEvents[0]).toBe(false);
    expect(sentEvents[1]).toMatchObject({
      eventId: current.eventId,
      dayEndsAt: current.dayEndsAt,
    });
  });

  it('batches offline drawing events and returns canonical totals', async () => {
    acceptAll();
    const drawingOutbox: DrawingEvent[] = Array.from(
      { length: 61 },
      (_, index) => ({
        eventId: `drawing-${index}`,
        itemId: 'kana_a',
        source: 'practice',
        sessionId: `drawing-session-${index}`,
        occurredAt: '2026-07-29T00:00:00.000Z',
      }),
    );

    const result = await syncService.sync(
      { ...createInitialSnapshot(), drawingOutbox },
      BUNDLED_MANIFEST,
    );

    const drawingCalls = invoke.mock.calls.filter(
      (call) => call[0] === 'submit-drawings',
    );
    expect(drawingCalls.map((call) => call[1].body.events.length)).toEqual([
      50, 11,
    ]);
    expect(result.acceptedDrawingEventIds).toHaveLength(61);
    expect(result.pendingDrawingCount).toBe(0);
    expect(result.canonicalDrawingCounts).toEqual({ kana_a: 7 });
  });
});
