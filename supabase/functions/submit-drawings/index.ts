import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { z } from 'npm:zod@4.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const eventSchema = z.object({
  eventId: z.string().uuid(),
  itemId: z.string().min(1).max(160),
  source: z.enum(['lesson', 'review', 'practice']),
  sessionId: z.string().uuid(),
  occurredAt: z.string().datetime(),
});

const requestSchema = z.object({
  // Empty batches are count refreshes for a newly hydrated device.
  events: z.array(eventSchema).max(50),
});

interface RejectedEvent {
  eventId: string;
  reason: string;
  permanent: boolean;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return Response.json(
      { error: 'method_not_allowed' },
      { status: 405, headers: corsHeaders },
    );
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return Response.json(
      { error: 'authentication_required' },
      { status: 401, headers: corsHeaders },
    );
  }

  try {
    const body = requestSchema.parse(await request.json());
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    // The request contains no user ID. Every write RPC derives ownership from
    // auth.uid(), and this explicit lookup rejects an invalid bearer token.
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      return Response.json(
        { error: 'invalid_token' },
        { status: 401, headers: corsHeaders },
      );
    }

    const rejected: RejectedEvent[] = [];
    let validEvents = body.events;
    if (body.events.length > 0) {
      const { data: release, error: releaseError } = await client
        .from('curriculum_releases')
        .select('id')
        .eq('status', 'published')
        .order('version', { ascending: false })
        .limit(1)
        .single();
      if (releaseError || !release) {
        throw new Error(
          `published_curriculum_unavailable: ${releaseError?.message ?? 'no published release'}`,
        );
      }

      const requestedIds = [
        ...new Set(body.events.map((event) => event.itemId)),
      ];
      const { data: items, error: itemsError } = await client
        .from('learning_items')
        .select('id')
        .eq('release_id', release.id)
        .in('id', requestedIds);
      if (itemsError) {
        throw itemsError;
      }
      const knownIds = new Set(
        ((items ?? []) as { id: string }[]).map((item) => item.id),
      );
      validEvents = body.events.filter((event) => {
        if (knownIds.has(event.itemId)) {
          return true;
        }
        rejected.push({
          eventId: event.eventId,
          reason: 'unknown_curriculum_item',
          permanent: true,
        });
        return false;
      });
    }

    let acceptedEventIds: string[] = [];
    if (validEvents.length > 0) {
      const { data: commit, error: commitError } = await client.rpc(
        'commit_drawing_events',
        { p_events: validEvents },
      );
      if (commitError) {
        throw commitError;
      }
      acceptedEventIds = (commit?.acceptedEventIds ?? []) as string[];
    }

    const { data: canonicalCounts, error: countsError } = await client.rpc(
      'get_my_drawing_counts',
    );
    if (countsError) {
      throw countsError;
    }

    return Response.json(
      {
        acceptedEventIds,
        canonicalCounts: canonicalCounts ?? {},
        rejected,
      },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const malformed = error instanceof z.ZodError;
    return Response.json(
      {
        error: malformed ? 'malformed_batch' : 'drawing_submission_failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: malformed ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
