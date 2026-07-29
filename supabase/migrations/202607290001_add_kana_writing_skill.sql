-- Adds `kana_writing` as a second independently scheduled skill.
--
-- The same character can be due for reading and not for writing, and vice
-- versa: progress is keyed by user x item x skill, so nothing else in the
-- schema changes. A learner can recognise ら long before they can write it.
--
-- submit-reviews validates every incoming event's skill against this table, so
-- writing reviews are rejected until this row exists.

insert into public.skill_definitions (
  release_id, id, schema_version, label, prompt, answer_field
) values (
  '00000000-0000-4000-8000-000000000001',
  'kana_writing',
  1,
  'Kana writing',
  'Hear a sound and write its kana.',
  -- Graded from stroke geometry on the client rather than a typed answer; the
  -- field names what is being produced, not something the server compares.
  'content.glyph'
)
on conflict (release_id, id) do nothing;
