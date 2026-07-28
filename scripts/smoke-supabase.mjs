import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
}

function client() {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function functionErrorBody(error) {
  if (error?.context instanceof Response) {
    try {
      return await error.context.json();
    } catch {
      return { error: error.message };
    }
  }
  return { error: error?.message ?? 'Unknown function error' };
}

const learner = client();
const { data: auth, error: authError } =
  await learner.auth.signInAnonymously();
if (authError || !auth.user) {
  throw authError ?? new Error('Anonymous auth did not return a user.');
}

const { data: releases, error: releaseError } = await learner
  .from('curriculum_releases')
  .select('id, version, status');
if (releaseError) {
  throw releaseError;
}

const { data: manifest, error: manifestError } = await learner.rpc(
  'get_published_curriculum_manifest',
);
if (manifestError) {
  throw manifestError;
}

const eventId = randomUUID();
const event = {
  eventId,
  sessionId: randomUUID(),
  itemId: 'hiragana-vowels-a',
  skillId: 'kana_reading',
  answer: 'a',
  classification: 'exact',
  rating: 3,
  responseMs: 700,
  exerciseVersion: 1,
  reviewedAt: new Date().toISOString(),
  expectedStateVersion: 0,
};

const first = await learner.functions.invoke('submit-reviews', {
  body: { events: [event] },
});
if (first.error) {
  throw new Error(
    `First review submission failed: ${JSON.stringify(await functionErrorBody(first.error))}`,
  );
}

const duplicate = await learner.functions.invoke('submit-reviews', {
  body: { events: [event] },
});
if (duplicate.error) {
  throw new Error(
    `Duplicate review submission failed: ${JSON.stringify(
      await functionErrorBody(duplicate.error),
    )}`,
  );
}

const { data: storedEvents, error: eventError } = await learner
  .from('review_events')
  .select('*')
  .eq('event_id', eventId);
if (eventError) {
  throw eventError;
}

const otherLearner = client();
const { error: otherAuthError } =
  await otherLearner.auth.signInAnonymously();
if (otherAuthError) {
  throw otherAuthError;
}
const { data: otherEvents, error: otherEventError } = await otherLearner
  .from('review_events')
  .select('event_id')
  .eq('event_id', eventId);
if (otherEventError) {
  throw otherEventError;
}

const rawInputRetained = Object.hasOwn(storedEvents?.[0] ?? {}, 'answer');
const result = {
  anonymousAuth: auth.user.is_anonymous === true,
  publishedReleases: releases?.length ?? 0,
  manifestItems: manifest?.items?.length ?? 0,
  firstAccepted: first.data?.acceptedEventIds?.length ?? 0,
  duplicateAccepted: duplicate.data?.acceptedEventIds?.length ?? 0,
  storedEvents: storedEvents?.length ?? 0,
  otherUserCanReadEvent: (otherEvents?.length ?? 0) > 0,
  rawInputRetained,
};

if (
  !result.anonymousAuth ||
  result.publishedReleases !== 1 ||
  result.manifestItems !== 46 ||
  result.firstAccepted !== 1 ||
  result.duplicateAccepted !== 1 ||
  result.storedEvents !== 1 ||
  result.otherUserCanReadEvent ||
  result.rawInputRetained
) {
  throw new Error(`Supabase smoke assertions failed: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result, null, 2));
