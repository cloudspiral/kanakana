import {
  learnerStateKey,
  type CurriculumManifest,
  type DrawingEvent,
  type LearnerSkillState,
  type LearnerSnapshot,
  type ReviewAttempt,
  type SyncResult,
  type SyncService,
} from '@/domain/types';
import {
  curriculumManifestSchema,
  validateSupportedModules,
} from '@/domain/schemas';
import { resolveReviewSessionId } from '@/domain/session';
import {
  ensureAnonymousUser,
  isCloudConfigured,
  supabase,
} from './supabase';

/**
 * The submit-reviews function rejects an oversized batch outright, so a long
 * offline stretch has to be sent in instalments. Keep this in step with the
 * `max` on its request schema.
 */
const MAX_EVENTS_PER_REQUEST = 50;

/** Unwrap the function's own JSON error body, which says more than the SDK does. */
async function describeInvokeError(error: {
  message: string;
  context?: unknown;
}): Promise<string> {
  const context = 'context' in error ? error.context : undefined;
  if (context instanceof Response) {
    try {
      const payload = (await context.json()) as {
        error?: string;
        detail?: string;
      };
      const detail = [payload.error, payload.detail].filter(Boolean).join(': ');
      if (detail) {
        return detail;
      }
    } catch {
      // Preserve the SDK error when the response has no JSON body.
    }
  }
  return error.message;
}

/** An event the function declined, mirroring its own `rejected` payload. */
interface RejectedEvent {
  eventId: string;
  reason: string;
  permanent: boolean;
}

function inBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

class SupabaseSyncService implements SyncService {
  async fetchManifest(): Promise<CurriculumManifest | null> {
    if (!supabase) {
      return null;
    }
    await ensureAnonymousUser();
    const { data, error } = await supabase.rpc(
      'get_published_curriculum_manifest',
    );
    if (error) {
      throw error;
    }
    return validateSupportedModules(
      curriculumManifestSchema.parse(data),
    ) as CurriculumManifest;
  }

  async sync(
    snapshot: LearnerSnapshot,
    _manifest: CurriculumManifest,
  ): Promise<SyncResult> {
    if (!isCloudConfigured || !supabase) {
      return {
        pendingCount: snapshot.reviewOutbox.length,
        pendingDrawingCount: snapshot.drawingOutbox.length,
        acceptedCount: 0,
        acceptedEventIds: [],
        discardedEventIds: [],
        acceptedDrawingEventIds: [],
        discardedDrawingEventIds: [],
        canonicalDrawingCounts: {},
        canonicalStates: [],
        cloudStatus: 'unconfigured',
      };
    }

    // Accumulated outside the try so that a batch failing partway through still
    // reports what the server did accept, rather than re-sending it forever.
    const acceptedEventIds: string[] = [];
    const discardedEventIds: string[] = [];
    const acceptedDrawingEventIds: string[] = [];
    const discardedDrawingEventIds: string[] = [];
    const stalled: string[] = [];
    const drawingStalled: string[] = [];
    const canonicalByKey = new Map<string, LearnerSkillState>();
    let canonicalDrawingCounts: Record<string, number> = {};
    let guestId: string | undefined;
    const errors: string[] = [];

    try {
      guestId = await ensureAnonymousUser();

      const events: ReviewAttempt[] = snapshot.reviewOutbox.map((event) => ({
        ...event,
        sessionId: resolveReviewSessionId(event.sessionId),
      }));
      for (const batch of inBatches(events, MAX_EVENTS_PER_REQUEST)) {
        const { data, error } = await supabase.functions.invoke(
          'submit-reviews',
          {
            body: { events: batch },
          },
        );
        if (error) {
          errors.push(await describeInvokeError(error));
          break;
        }
        acceptedEventIds.push(...((data?.acceptedEventIds ?? []) as string[]));
        for (const state of (data?.canonicalStates ??
          []) as LearnerSkillState[]) {
          canonicalByKey.set(learnerStateKey(state.itemId, state.skillId), state);
        }
        for (const event of (data?.rejected ?? []) as RejectedEvent[]) {
          (event.permanent ? discardedEventIds : stalled).push(event.eventId);
        }
      }

      // An empty drawing batch is intentional: it hydrates canonical counts on
      // a new device even when this device has no local drawings to submit.
      const drawingBatches =
        snapshot.drawingOutbox.length > 0
          ? inBatches(snapshot.drawingOutbox, MAX_EVENTS_PER_REQUEST)
          : [[]];
      for (const batch of drawingBatches) {
        const { data, error } = await supabase.functions.invoke(
          'submit-drawings',
          {
            body: { events: batch as DrawingEvent[] },
          },
        );
        if (error) {
          errors.push(await describeInvokeError(error));
          break;
        }
        acceptedDrawingEventIds.push(
          ...((data?.acceptedEventIds ?? []) as string[]),
        );
        canonicalDrawingCounts = {
          ...canonicalDrawingCounts,
          ...((data?.canonicalCounts ?? {}) as Record<string, number>),
        };
        for (const event of (data?.rejected ?? []) as RejectedEvent[]) {
          (event.permanent ? discardedDrawingEventIds : drawingStalled).push(
            event.eventId,
          );
        }
      }

      const settled = acceptedEventIds.length + discardedEventIds.length;
      const settledDrawings =
        acceptedDrawingEventIds.length + discardedDrawingEventIds.length;
      const retryNotices = [
        stalled.length
          ? `${stalled.length} review${stalled.length === 1 ? '' : 's'} awaiting retry`
          : '',
        drawingStalled.length
          ? `${drawingStalled.length} drawing${drawingStalled.length === 1 ? '' : 's'} awaiting retry`
          : '',
      ].filter(Boolean);
      return {
        pendingCount: Math.max(0, snapshot.reviewOutbox.length - settled),
        pendingDrawingCount: Math.max(
          0,
          snapshot.drawingOutbox.length - settledDrawings,
        ),
        acceptedCount: acceptedEventIds.length,
        acceptedEventIds,
        discardedEventIds,
        acceptedDrawingEventIds,
        discardedDrawingEventIds,
        canonicalDrawingCounts,
        canonicalStates: [...canonicalByKey.values()],
        guestId,
        cloudStatus: errors.length ? 'error' : 'synced',
        error: [...errors, ...retryNotices].join('; ') || undefined,
      };
    } catch (error) {
      return {
        pendingCount:
          snapshot.reviewOutbox.length -
          acceptedEventIds.length -
          discardedEventIds.length,
        pendingDrawingCount:
          snapshot.drawingOutbox.length -
          acceptedDrawingEventIds.length -
          discardedDrawingEventIds.length,
        acceptedCount: acceptedEventIds.length,
        acceptedEventIds,
        discardedEventIds,
        acceptedDrawingEventIds,
        discardedDrawingEventIds,
        canonicalDrawingCounts,
        canonicalStates: [...canonicalByKey.values()],
        guestId,
        cloudStatus: 'error',
        error: error instanceof Error ? error.message : 'Cloud sync failed',
      };
    }
  }

  async startFreshGuest(): Promise<string | undefined> {
    if (!supabase) {
      return undefined;
    }
    await supabase.auth.signOut();
    return ensureAnonymousUser();
  }
}

export const syncService: SyncService = new SupabaseSyncService();
