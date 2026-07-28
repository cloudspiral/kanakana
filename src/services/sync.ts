import type {
  CurriculumManifest,
  LearnerSkillState,
  LearnerSnapshot,
  SyncResult,
  SyncService,
} from '@/domain/types';
import {
  curriculumManifestSchema,
  validateSupportedModules,
} from '@/domain/schemas';
import {
  ensureAnonymousUser,
  isCloudConfigured,
  supabase,
} from './supabase';

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
        acceptedCount: 0,
        acceptedEventIds: [],
        canonicalStates: [],
        cloudStatus: 'unconfigured',
      };
    }

    try {
      const guestId = await ensureAnonymousUser();
      if (snapshot.reviewOutbox.length === 0) {
        return {
          pendingCount: 0,
          acceptedCount: 0,
          acceptedEventIds: [],
          canonicalStates: [],
          guestId,
          cloudStatus: 'synced',
        };
      }

      const { data, error } = await supabase.functions.invoke(
        'submit-reviews',
        {
          body: { events: snapshot.reviewOutbox },
        },
      );
      if (error) {
        let detail = error.message;
        const context = 'context' in error ? error.context : undefined;
        if (context instanceof Response) {
          try {
            const payload = (await context.json()) as {
              error?: string;
              detail?: string;
            };
            detail = [payload.error, payload.detail].filter(Boolean).join(': ');
          } catch {
            // Preserve the SDK error when the response has no JSON body.
          }
        }
        throw new Error(detail);
      }

      const acceptedEventIds = (data?.acceptedEventIds ?? []) as string[];
      return {
        pendingCount: Math.max(
          0,
          snapshot.reviewOutbox.length - acceptedEventIds.length,
        ),
        acceptedCount: acceptedEventIds.length,
        acceptedEventIds,
        canonicalStates: (data?.canonicalStates ?? []) as LearnerSkillState[],
        guestId,
        cloudStatus: 'synced',
      };
    } catch (error) {
      return {
        pendingCount: snapshot.reviewOutbox.length,
        acceptedCount: 0,
        acceptedEventIds: [],
        canonicalStates: [],
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
