insert into public.curriculum_releases (
  id, manifest_id, version, status, published_at
) values (
  '00000000-0000-4000-8000-000000000001',
  'kanakana-hiragana-beginner',
  1,
  'published',
  '2026-07-28T00:00:00.000Z'
);

insert into public.skill_definitions (
  release_id, id, schema_version, label, prompt, answer_field
) values (
  '00000000-0000-4000-8000-000000000001',
  'kana_reading',
  1,
  'Kana reading',
  'See a kana and recall its sound.',
  'content.acceptedAnswers'
);

insert into public.curriculum_units (
  release_id, id, title, short_title, sort_order
) values
  ('00000000-0000-4000-8000-000000000001', 'unit-vowels', 'The vowel row', 'Vowels', 0),
  ('00000000-0000-4000-8000-000000000001', 'unit-k', 'The K row', 'K row', 1),
  ('00000000-0000-4000-8000-000000000001', 'unit-s', 'The S row', 'S row', 2),
  ('00000000-0000-4000-8000-000000000001', 'unit-t', 'The T row', 'T row', 3),
  ('00000000-0000-4000-8000-000000000001', 'unit-n', 'The N row', 'N row', 4),
  ('00000000-0000-4000-8000-000000000001', 'unit-h', 'The H row', 'H row', 5),
  ('00000000-0000-4000-8000-000000000001', 'unit-m', 'The M row', 'M row', 6),
  ('00000000-0000-4000-8000-000000000001', 'unit-y', 'The Y row', 'Y row', 7),
  ('00000000-0000-4000-8000-000000000001', 'unit-r', 'The R row', 'R row', 8),
  ('00000000-0000-4000-8000-000000000001', 'unit-w', 'The W row', 'W row', 9),
  ('00000000-0000-4000-8000-000000000001', 'unit-final-n', 'The final N', 'Final N', 10);

with row_seed(row_id, row_label, row_order, kana) as (
  values
    ('vowels', 'Vowels', 0, '[
      ["あ", "a", ["a"], 0],
      ["い", "i", ["i"], 1],
      ["う", "u", ["u"], 2],
      ["え", "e", ["e"], 3],
      ["お", "o", ["o"], 4]
    ]'::jsonb),
    ('k', 'K row', 1, '[
      ["か", "ka", ["ka"], 0],
      ["き", "ki", ["ki"], 1],
      ["く", "ku", ["ku"], 2],
      ["け", "ke", ["ke"], 3],
      ["こ", "ko", ["ko"], 4]
    ]'::jsonb),
    ('s', 'S row', 2, '[
      ["さ", "sa", ["sa"], 0],
      ["し", "shi", ["shi", "si"], 1],
      ["す", "su", ["su"], 2],
      ["せ", "se", ["se"], 3],
      ["そ", "so", ["so"], 4]
    ]'::jsonb),
    ('t', 'T row', 3, '[
      ["た", "ta", ["ta"], 0],
      ["ち", "chi", ["chi", "ti"], 1],
      ["つ", "tsu", ["tsu", "tu"], 2],
      ["て", "te", ["te"], 3],
      ["と", "to", ["to"], 4]
    ]'::jsonb),
    ('n', 'N row', 4, '[
      ["な", "na", ["na"], 0],
      ["に", "ni", ["ni"], 1],
      ["ぬ", "nu", ["nu"], 2],
      ["ね", "ne", ["ne"], 3],
      ["の", "no", ["no"], 4]
    ]'::jsonb),
    ('h', 'H row', 5, '[
      ["は", "ha", ["ha"], 0],
      ["ひ", "hi", ["hi"], 1],
      ["ふ", "fu", ["fu", "hu"], 2],
      ["へ", "he", ["he"], 3],
      ["ほ", "ho", ["ho"], 4]
    ]'::jsonb),
    ('m', 'M row', 6, '[
      ["ま", "ma", ["ma"], 0],
      ["み", "mi", ["mi"], 1],
      ["む", "mu", ["mu"], 2],
      ["め", "me", ["me"], 3],
      ["も", "mo", ["mo"], 4]
    ]'::jsonb),
    ('y', 'Y row', 7, '[
      ["や", "ya", ["ya"], 0],
      ["ゆ", "yu", ["yu"], 2],
      ["よ", "yo", ["yo"], 4]
    ]'::jsonb),
    ('r', 'R row', 8, '[
      ["ら", "ra", ["ra"], 0],
      ["り", "ri", ["ri"], 1],
      ["る", "ru", ["ru"], 2],
      ["れ", "re", ["re"], 3],
      ["ろ", "ro", ["ro"], 4]
    ]'::jsonb),
    ('w', 'W row', 9, '[
      ["わ", "wa", ["wa"], 0],
      ["を", "wo", ["wo", "o"], 4]
    ]'::jsonb),
    ('final-n', 'Final N', 10, '[
      ["ん", "n", ["n", "nn", "n''"], 2]
    ]'::jsonb)
),
expanded as (
  select
    row_seed.*,
    entry.value,
    entry.ordinality
  from row_seed
  cross join lateral jsonb_array_elements(row_seed.kana)
    with ordinality as entry(value, ordinality)
)
insert into public.learning_items (
  release_id, id, kind, schema_version, content
)
select
  '00000000-0000-4000-8000-000000000001',
  'hiragana-' || row_id || '-' || replace(value->>1, '''', ''),
  'hiragana',
  1,
  jsonb_build_object(
    'glyph', value->>0,
    'primaryAnswer', value->>1,
    'acceptedAnswers', value->2,
    'rowId', row_id,
    'rowLabel', row_label,
    'column', (value->>3)::integer,
    'curriculumOrder', row_order * 10 + ordinality
  )
from expanded;

with ranked_items as (
  select
    items.*,
    row_number() over (
      partition by items.content->>'rowId'
      order by (items.content->>'column')::integer
    ) as row_rank,
    count(*) over (partition by items.content->>'rowId') as row_count
  from public.learning_items items
  where items.release_id = '00000000-0000-4000-8000-000000000001'
),
row_content as (
  select
    content->>'rowId' as row_id,
    max(content->>'rowLabel') as row_label,
    count(*) as item_count,
    jsonb_agg(id order by row_rank) as all_ids,
    jsonb_agg(id order by row_rank) filter (where row_rank <= 2) as first_ids,
    jsonb_agg(id order by row_rank) filter (where row_rank > 2) as rest_ids,
    string_agg(content->>'glyph', '  ' order by row_rank)
      filter (where row_rank <= 2) as first_glyphs,
    string_agg(content->>'glyph', '  ' order by row_rank)
      filter (where row_rank > 2) as rest_glyphs
  from ranked_items
  group by content->>'rowId'
),
modules as (
  select row_id || '-intro-1' as id, 'unit-' || row_id as unit_id,
    'kana-introduction-v1' as module_type, 0 as sort_order,
    jsonb_build_object('itemIds', first_ids, 'heading', 'Meet ' || first_glyphs) as content
  from row_content
  union all
  select row_id || '-check-1', 'unit-' || row_id,
    'kana-reading-input-v1', 1,
    jsonb_build_object('itemIds', first_ids, 'prompt', 'What sound does this make?')
  from row_content
  union all
  select row_id || '-intro-2', 'unit-' || row_id,
    'kana-introduction-v1', 2,
    jsonb_build_object('itemIds', rest_ids, 'heading', 'Meet ' || rest_glyphs)
  from row_content where item_count > 2
  union all
  select row_id || '-check-all', 'unit-' || row_id,
    'kana-reading-input-v1', 3,
    jsonb_build_object('itemIds', all_ids, 'prompt', 'What sound does this make?')
  from row_content where item_count > 2
  union all
  select row_id || '-summary', 'unit-' || row_id,
    'session-summary-v1', case when item_count > 2 then 4 else 2 end,
    jsonb_build_object('heading', row_label || ' complete')
  from row_content
)
insert into public.teaching_modules (
  release_id, id, unit_id, module_type, schema_version, sort_order, content
)
select
  '00000000-0000-4000-8000-000000000001',
  id,
  unit_id,
  module_type,
  1,
  sort_order,
  content
from modules;

with ranked_items as (
  select
    items.*,
    row_number() over (
      partition by items.content->>'rowId'
      order by (items.content->>'column')::integer
    ) as row_rank
  from public.learning_items items
  where items.release_id = '00000000-0000-4000-8000-000000000001'
)
insert into public.module_targets (
  release_id, module_id, item_id, skill_id, sort_order
)
select
  modules.release_id,
  modules.id,
  items.id,
  'kana_reading',
  items.row_rank
from public.teaching_modules modules
join ranked_items items
  on items.content->>'rowId' = replace(
    replace(
      replace(
        replace(
          replace(modules.id, '-intro-1', ''),
          '-check-1', ''
        ),
        '-intro-2', ''
      ),
      '-check-all', ''
    ),
    '-summary', ''
  )
where modules.release_id = '00000000-0000-4000-8000-000000000001'
  and (
    (modules.id like '%-intro-1' and items.row_rank <= 2)
    or (modules.id like '%-check-1' and items.row_rank <= 2)
    or (modules.id like '%-intro-2' and items.row_rank > 2)
    or modules.id like '%-check-all'
    or modules.id like '%-summary'
  );
