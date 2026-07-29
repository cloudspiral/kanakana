import { createClient } from 'npm:@supabase/supabase-js@2.110.9';
import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card,
} from 'npm:ts-fsrs@5.4.1';
import { z } from 'npm:zod@4.4.3';

import {
  classificationIsCorrect,
  classifyReviewAnswer,
  FSRS_CONFIG,
  settleEarlyReview,
} from '../_shared/review-policy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const eventSchema = z.object({
  eventId: z.string().uuid(),
  sessionId: z.string().uuid(),
  itemId: z.string().min(1).max(160),
  skillId: z.string().min(1).max(160),
  answer: z.string().max(64),
  classification: z.enum([
    'exact',
    'accepted_alias',
    'incorrect',
    'revealed',
  ]),
  responseMs: z.number().int().min(0).max(60 * 60 * 1000),
  exerciseVersion: z.number().int().positive(),
  reviewedAt: z.string().datetime(),
  expectedStateVersion: z.number().int().nonnegative(),
});

const requestSchema = z.object({
  events: z.array(eventSchema).min(1).max(50),
});

interface StateRow {
  item_id: string;
  skill_id: string;
  version: number;
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
  updated_at: string;
}

interface ItemRow {
  id: string;
  content: {
    primaryAnswer: string;
    acceptedAnswers: string[];
  };
}

const scheduler = fsrs(FSRS_CONFIG);

function stateKey(itemId: string, skillId: string) {
  return `${itemId}::${skillId}`;
}

function toCard(state?: StateRow): Card {
  if (!state) {
    return createEmptyCard();
  }
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
}

/**
 * Canonical scheduling for one review.
 *
 * The early-review rule is applied here, not only on the client: this function
 * is the source of truth and its result overwrites whatever the client
 * computed, so leaving it out here would silently undo the rule on every sync.
 * It is shared with src/domain/scheduler.ts so both sides cannot drift.
 */
function schedule(
  previous: StateRow | undefined,
  reviewedAt: Date,
  rating: Rating.Again | Rating.Good,
): Card {
  const before = toCard(previous);
  const next = scheduler.next(before, reviewedAt, rating).card;
  if (!previous || rating === Rating.Again) {
    return next;
  }
  return settleEarlyReview(before, next, reviewedAt);
}

function statePayload(card: Card) {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString() ?? '',
  };
}

function canonicalState(row: StateRow) {
  return {
    itemId: row.item_id,
    skillId: row.skill_id,
    version: row.version,
    updatedAt: row.updated_at,
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ?? undefined,
  };
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
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      return Response.json(
        { error: 'invalid_token' },
        { status: 401, headers: corsHeaders },
      );
    }

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

    const itemIds = [...new Set(body.events.map((event) => event.itemId))];
    const skillIds = [...new Set(body.events.map((event) => event.skillId))];
    const [
      { data: items, error: itemsError },
      { data: skills, error: skillsError },
    ] = await Promise.all([
      client
        .from('learning_items')
        .select('id, content')
        .eq('release_id', release.id)
        .in('id', itemIds),
      client
        .from('skill_definitions')
        .select('id')
        .eq('release_id', release.id)
        .in('id', skillIds),
    ]);
    if (itemsError || skillsError) {
      throw itemsError ?? skillsError;
    }
    if (items?.length !== itemIds.length || skills?.length !== skillIds.length) {
      return Response.json(
        { error: 'unknown_item_or_skill' },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: initialStates, error: statesError } = await client
      .from('learner_skill_states')
      .select('*')
      .in('item_id', itemIds)
      .in('skill_id', skillIds);
    if (statesError) {
      throw statesError;
    }

    const itemMap = new Map(
      (items as ItemRow[]).map((item) => [item.id, item]),
    );
    const stateMap = new Map(
      ((initialStates ?? []) as StateRow[]).map((state) => [
        stateKey(state.item_id, state.skill_id),
        state,
      ]),
    );
    const acceptedEventIds: string[] = [];
    const canonicalStates = new Map<
      string,
      ReturnType<typeof canonicalState>
    >();

    for (const event of body.events) {
      const item = itemMap.get(event.itemId)!;
      const classification = classifyReviewAnswer(
        item.content.primaryAnswer,
        item.content.acceptedAnswers,
        event.answer,
        event.classification === 'revealed',
      );
      const correct = classificationIsCorrect(classification);
      const rating = correct ? Rating.Good : Rating.Again;
      const key = stateKey(event.itemId, event.skillId);
      let previous = stateMap.get(key);
      let expectedVersion = previous?.version ?? 0;
      let scheduleAt = new Date(event.reviewedAt);
      if (
        previous?.last_review &&
        new Date(previous.last_review).getTime() > scheduleAt.getTime()
      ) {
        scheduleAt = new Date(previous.last_review);
      }

      let nextCard = schedule(previous, scheduleAt, rating);
      const safeEvent = {
        eventId: event.eventId,
        sessionId: event.sessionId,
        itemId: event.itemId,
        skillId: event.skillId,
        rating,
        correct,
        classification,
        responseMs: event.responseMs,
        exerciseVersion: event.exerciseVersion,
        reviewedAt: event.reviewedAt,
      };
      let commit = await client.rpc('commit_review_event', {
        p_event: safeEvent,
        p_state: statePayload(nextCard),
        p_expected_version: expectedVersion,
      });

      if (commit.error?.message.includes('state_version_conflict')) {
        const { data: refreshed, error: refreshError } = await client
          .from('learner_skill_states')
          .select('*')
          .eq('item_id', event.itemId)
          .eq('skill_id', event.skillId)
          .single();
        if (refreshError) {
          throw refreshError;
        }
        previous = refreshed as StateRow;
        expectedVersion = previous.version;
        const rebasedAt =
          previous.last_review &&
          new Date(previous.last_review).getTime() > scheduleAt.getTime()
            ? new Date(previous.last_review)
            : scheduleAt;
        nextCard = schedule(previous, rebasedAt, rating);
        commit = await client.rpc('commit_review_event', {
          p_event: safeEvent,
          p_state: statePayload(nextCard),
          p_expected_version: expectedVersion,
        });
      }

      if (commit.error) {
        throw commit.error;
      }
      const committed = commit.data.state as StateRow;
      stateMap.set(key, committed);
      canonicalStates.set(key, canonicalState(committed));
      acceptedEventIds.push(event.eventId);
    }

    return Response.json(
      {
        acceptedEventIds,
        canonicalStates: [...canonicalStates.values()],
      },
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const malformed = error instanceof z.ZodError;
    return Response.json(
      {
        error: malformed ? 'malformed_batch' : 'review_submission_failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      {
        status: malformed ? 400 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
