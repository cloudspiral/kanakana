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

function validV3Manifest(value) {
  const items = value?.items ?? [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const derived = items.filter((item) => item.content.derivedFrom);
  const markCounts = Object.groupBy(
    derived,
    (item) => item.content.mark ?? 'missing',
  );
  const reciprocal = derived.every((item) => {
    const parent = byId.get(item.content.derivedFrom);
    return (
      parent &&
      parent.content.column === item.content.column &&
      parent.content.derivedForms?.includes(item.id)
    );
  });
  const hParents = items.filter(
    (item) => item.content.rowId === 'h' && !item.content.derivedFrom,
  );
  const aliases = Object.fromEntries(
    items.map((item) => [item.content.glyph, item.content.acceptedAnswers]),
  );
  return (
    items.length === 71 &&
    derived.length === 25 &&
    (markCounts.dakuten?.length ?? 0) === 20 &&
    (markCounts.handakuten?.length ?? 0) === 5 &&
    reciprocal &&
    hParents.length === 5 &&
    hParents.every((item) => item.content.derivedForms?.length === 2) &&
    JSON.stringify(aliases['じ']) === JSON.stringify(['ji', 'zi']) &&
    JSON.stringify(aliases['ぢ']) === JSON.stringify(['ji', 'di']) &&
    JSON.stringify(aliases['づ']) === JSON.stringify(['zu', 'du']) &&
    JSON.stringify(value.units?.map((unit) => unit.id)) ===
      JSON.stringify([
        'unit-vowels', 'unit-k', 'unit-g', 'unit-s', 'unit-z', 'unit-t',
        'unit-d', 'unit-n', 'unit-h', 'unit-b', 'unit-p', 'unit-m',
        'unit-y', 'unit-r', 'unit-w', 'unit-final-n',
      ])
  );
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

const writingEvent = {
  eventId: randomUUID(),
  sessionId: randomUUID(),
  itemId: 'hiragana-vowels-a',
  skillId: 'kana_writing',
  answer: 'あ',
  classification: 'exact',
  rating: 3,
  responseMs: 900,
  exerciseVersion: 1,
  reviewedAt: new Date().toISOString(),
  expectedStateVersion: 0,
};
const writing = await learner.functions.invoke('submit-reviews', {
  body: { events: [writingEvent] },
});
if (writing.error) {
  throw new Error(
    `Writing review submission failed: ${JSON.stringify(await functionErrorBody(writing.error))}`,
  );
}

const { data: writingBeforePractice, error: writingBeforeError } = await learner
  .from('learner_skill_states')
  .select('version, due, stability, lapses, reps')
  .eq('item_id', writingEvent.itemId)
  .eq('skill_id', writingEvent.skillId)
  .single();
if (writingBeforeError) {
  throw writingBeforeError;
}

const drawingEvent = {
  eventId: randomUUID(),
  sessionId: randomUUID(),
  itemId: 'hiragana-vowels-a',
  source: 'practice',
  occurredAt: new Date().toISOString(),
};
const firstDrawing = await learner.functions.invoke('submit-drawings', {
  body: { events: [drawingEvent] },
});
if (firstDrawing.error) {
  throw new Error(
    `First drawing submission failed: ${JSON.stringify(await functionErrorBody(firstDrawing.error))}`,
  );
}
const duplicateDrawing = await learner.functions.invoke('submit-drawings', {
  body: { events: [drawingEvent] },
});
if (duplicateDrawing.error) {
  throw new Error(
    `Duplicate drawing submission failed: ${JSON.stringify(await functionErrorBody(duplicateDrawing.error))}`,
  );
}
const invalidDrawing = await learner.functions.invoke('submit-drawings', {
  body: {
    events: [
      {
        ...drawingEvent,
        eventId: randomUUID(),
        itemId: 'not-in-the-current-curriculum',
      },
    ],
  },
});
if (invalidDrawing.error) {
  throw new Error(
    `Invalid drawing batch failed instead of rejecting one event: ${JSON.stringify(await functionErrorBody(invalidDrawing.error))}`,
  );
}

const { data: writingAfterPractice, error: writingAfterError } = await learner
  .from('learner_skill_states')
  .select('version, due, stability, lapses, reps')
  .eq('item_id', writingEvent.itemId)
  .eq('skill_id', writingEvent.skillId)
  .single();
if (writingAfterError) {
  throw writingAfterError;
}
const { data: storedDrawings, error: drawingError } = await learner
  .from('drawing_events')
  .select('*')
  .in('event_id', [writingEvent.eventId, drawingEvent.eventId]);
if (drawingError) {
  throw drawingError;
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
const { data: otherDrawings, error: otherDrawingError } = await otherLearner
  .from('drawing_events')
  .select('event_id')
  .in('event_id', [writingEvent.eventId, drawingEvent.eventId]);
if (otherDrawingError) {
  throw otherDrawingError;
}

const rawInputRetained = Object.hasOwn(storedEvents?.[0] ?? {}, 'answer');
const rawDrawingRetained = (storedDrawings ?? []).some(
  (row) =>
    Object.hasOwn(row, 'strokes') ||
    Object.hasOwn(row, 'geometry') ||
    Object.hasOwn(row, 'points'),
);
const result = {
  anonymousAuth: auth.user.is_anonymous === true,
  publishedReleases: releases?.length ?? 0,
  manifestVersion: manifest?.version ?? 0,
  manifestItems: manifest?.items?.length ?? 0,
  manifestUnits: manifest?.units?.length ?? 0,
  remoteManifestValid: validV3Manifest(manifest),
  firstAccepted: first.data?.acceptedEventIds?.length ?? 0,
  duplicateAccepted: duplicate.data?.acceptedEventIds?.length ?? 0,
  storedEvents: storedEvents?.length ?? 0,
  otherUserCanReadEvent: (otherEvents?.length ?? 0) > 0,
  rawInputRetained,
  writingAccepted: writing.data?.acceptedEventIds?.length ?? 0,
  firstDrawingAccepted: firstDrawing.data?.acceptedEventIds?.length ?? 0,
  duplicateDrawingAccepted:
    duplicateDrawing.data?.acceptedEventIds?.length ?? 0,
  drawingCount:
    duplicateDrawing.data?.canonicalCounts?.[drawingEvent.itemId] ?? 0,
  invalidDrawingRejected:
    invalidDrawing.data?.rejected?.[0]?.permanent === true,
  storedDrawings: storedDrawings?.length ?? 0,
  otherUserCanReadDrawing: (otherDrawings?.length ?? 0) > 0,
  rawDrawingRetained,
  practiceChangedSchedule:
    JSON.stringify(writingBeforePractice) !==
    JSON.stringify(writingAfterPractice),
};

if (
  !result.anonymousAuth ||
  result.publishedReleases !== 1 ||
  result.manifestVersion !== 3 ||
  result.manifestItems !== 71 ||
  result.manifestUnits !== 16 ||
  !result.remoteManifestValid ||
  result.firstAccepted !== 1 ||
  result.duplicateAccepted !== 1 ||
  result.storedEvents !== 1 ||
  result.otherUserCanReadEvent ||
  result.rawInputRetained ||
  result.writingAccepted !== 1 ||
  result.firstDrawingAccepted !== 1 ||
  result.duplicateDrawingAccepted !== 1 ||
  result.drawingCount !== 2 ||
  !result.invalidDrawingRejected ||
  result.storedDrawings !== 2 ||
  result.otherUserCanReadDrawing ||
  result.rawDrawingRetained ||
  result.practiceChangedSchedule
) {
  throw new Error(`Supabase smoke assertions failed: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result, null, 2));
