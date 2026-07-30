-- Voiced Kana and Practice-Sync release.
--
-- Curriculum v3 is immutable and keeps every v1 base item/unit ID stable while
-- interleaving 25 independently scheduled derived kana. The drawing ledger
-- stores only completion metadata: never raw strokes or geometry.

create table public.drawing_events (
  event_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  item_id text not null,
  source text not null check (source in ('lesson', 'review', 'practice')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index drawing_events_user_item_idx
  on public.drawing_events(user_id, item_id);

alter table public.drawing_events enable row level security;

create policy "learners read own drawing events"
  on public.drawing_events for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.drawing_events to authenticated;

-- Existing writing reviews are already trustworthy drawing completions. Their
-- review event ID becomes the drawing event ID, so replay remains idempotent.
insert into public.drawing_events (
  event_id, user_id, session_id, item_id, source, occurred_at, created_at
)
select
  event_id, user_id, session_id, item_id, 'review', reviewed_at, created_at
from public.review_events
where skill_id = 'kana_writing'
on conflict (user_id, event_id) do nothing;

create or replace function public.count_writing_review_as_drawing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.skill_id = 'kana_writing' then
    insert into public.drawing_events (
      event_id, user_id, session_id, item_id, source, occurred_at
    ) values (
      new.event_id, new.user_id, new.session_id, new.item_id, 'review', new.reviewed_at
    )
    on conflict (user_id, event_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger count_writing_review_as_drawing
after insert on public.review_events
for each row execute function public.count_writing_review_as_drawing();

create or replace function public.commit_drawing_events(p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event jsonb;
  v_accepted jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'events_must_be_an_array';
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    insert into public.drawing_events (
      event_id, user_id, session_id, item_id, source, occurred_at
    ) values (
      (v_event->>'eventId')::uuid,
      v_user_id,
      nullif(v_event->>'sessionId', '')::uuid,
      v_event->>'itemId',
      v_event->>'source',
      (v_event->>'occurredAt')::timestamptz
    )
    on conflict (user_id, event_id) do update
      -- A lesson seed also arrives through submit-reviews. Preserve the richer
      -- lesson source regardless of which idempotent channel lands first.
      set source = case
        when excluded.source = 'lesson' then 'lesson'
        else public.drawing_events.source
      end;
    v_accepted := v_accepted || jsonb_build_array(v_event->>'eventId');
  end loop;

  return jsonb_build_object('acceptedEventIds', v_accepted);
end;
$$;

revoke all on function public.commit_drawing_events(jsonb) from public;
grant execute on function public.commit_drawing_events(jsonb) to authenticated;

create or replace function public.get_my_drawing_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(counts.item_id, counts.total), '{}'::jsonb)
  from (
    select item_id, count(*)::integer as total
    from public.drawing_events
    where user_id = auth.uid()
    group by item_id
  ) counts;
$$;

revoke all on function public.get_my_drawing_counts() from public;
grant execute on function public.get_my_drawing_counts() to authenticated;

-- Build the full v3 release as draft. It is published only after every item,
-- unit, module, and target below has been inserted and validated.
insert into public.curriculum_releases (
  id, manifest_id, version, status, published_at
) values (
  '00000000-0000-4000-8000-000000000003',
  'kanakana-hiragana-beginner',
  3,
  'draft',
  '2026-07-30T00:00:00.000Z'
);

insert into public.skill_definitions (
  release_id, id, schema_version, label, prompt, answer_field
) values
  (
    '00000000-0000-4000-8000-000000000003',
    'kana_reading', 1, 'Kana reading',
    'See a kana and recall its sound.', 'content.acceptedAnswers'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'kana_writing', 1, 'Kana writing',
    'Hear a sound and write its kana.', 'content.glyph'
  );

create temporary table v3_seed_rows (
  row_id text primary key,
  title text not null,
  short_title text not null,
  row_order integer not null,
  kana jsonb not null
) on commit drop;

insert into v3_seed_rows (row_id, title, short_title, row_order, kana) values
  ('vowels', 'The vowel row', 'Vowels', 0, $json$[
    ["あ","a",["a"],0,null,null],["い","i",["i"],1,null,null],
    ["う","u",["u"],2,null,null],["え","e",["e"],3,null,null],
    ["お","o",["o"],4,null,null]
  ]$json$::jsonb),
  ('k', 'The K row', 'K row', 1, $json$[
    ["か","ka",["ka"],0,null,null],["き","ki",["ki"],1,null,null],
    ["く","ku",["ku"],2,null,null],["け","ke",["ke"],3,null,null],
    ["こ","ko",["ko"],4,null,null]
  ]$json$::jsonb),
  ('g', 'The G row', 'G row', 2, $json$[
    ["が","ga",["ga"],0,"か","dakuten"],["ぎ","gi",["gi"],1,"き","dakuten"],
    ["ぐ","gu",["gu"],2,"く","dakuten"],["げ","ge",["ge"],3,"け","dakuten"],
    ["ご","go",["go"],4,"こ","dakuten"]
  ]$json$::jsonb),
  ('s', 'The S row', 'S row', 3, $json$[
    ["さ","sa",["sa"],0,null,null],["し","shi",["shi","si"],1,null,null],
    ["す","su",["su"],2,null,null],["せ","se",["se"],3,null,null],
    ["そ","so",["so"],4,null,null]
  ]$json$::jsonb),
  ('z', 'The Z row', 'Z row', 4, $json$[
    ["ざ","za",["za"],0,"さ","dakuten"],["じ","ji",["ji","zi"],1,"し","dakuten"],
    ["ず","zu",["zu"],2,"す","dakuten"],["ぜ","ze",["ze"],3,"せ","dakuten"],
    ["ぞ","zo",["zo"],4,"そ","dakuten"]
  ]$json$::jsonb),
  ('t', 'The T row', 'T row', 5, $json$[
    ["た","ta",["ta"],0,null,null],["ち","chi",["chi","ti"],1,null,null],
    ["つ","tsu",["tsu","tu"],2,null,null],["て","te",["te"],3,null,null],
    ["と","to",["to"],4,null,null]
  ]$json$::jsonb),
  ('d', 'The D row', 'D row', 6, $json$[
    ["だ","da",["da"],0,"た","dakuten"],["ぢ","ji",["ji","di"],1,"ち","dakuten"],
    ["づ","zu",["zu","du"],2,"つ","dakuten"],["で","de",["de"],3,"て","dakuten"],
    ["ど","do",["do"],4,"と","dakuten"]
  ]$json$::jsonb),
  ('n', 'The N row', 'N row', 7, $json$[
    ["な","na",["na"],0,null,null],["に","ni",["ni"],1,null,null],
    ["ぬ","nu",["nu"],2,null,null],["ね","ne",["ne"],3,null,null],
    ["の","no",["no"],4,null,null]
  ]$json$::jsonb),
  ('h', 'The H row', 'H row', 8, $json$[
    ["は","ha",["ha"],0,null,null],["ひ","hi",["hi"],1,null,null],
    ["ふ","fu",["fu","hu"],2,null,null],["へ","he",["he"],3,null,null],
    ["ほ","ho",["ho"],4,null,null]
  ]$json$::jsonb),
  ('b', 'The B row', 'B row', 9, $json$[
    ["ば","ba",["ba"],0,"は","dakuten"],["び","bi",["bi"],1,"ひ","dakuten"],
    ["ぶ","bu",["bu"],2,"ふ","dakuten"],["べ","be",["be"],3,"へ","dakuten"],
    ["ぼ","bo",["bo"],4,"ほ","dakuten"]
  ]$json$::jsonb),
  ('p', 'The P row', 'P row', 10, $json$[
    ["ぱ","pa",["pa"],0,"は","handakuten"],["ぴ","pi",["pi"],1,"ひ","handakuten"],
    ["ぷ","pu",["pu"],2,"ふ","handakuten"],["ぺ","pe",["pe"],3,"へ","handakuten"],
    ["ぽ","po",["po"],4,"ほ","handakuten"]
  ]$json$::jsonb),
  ('m', 'The M row', 'M row', 11, $json$[
    ["ま","ma",["ma"],0,null,null],["み","mi",["mi"],1,null,null],
    ["む","mu",["mu"],2,null,null],["め","me",["me"],3,null,null],
    ["も","mo",["mo"],4,null,null]
  ]$json$::jsonb),
  ('y', 'The Y row', 'Y row', 12, $json$[
    ["や","ya",["ya"],0,null,null],["ゆ","yu",["yu"],2,null,null],
    ["よ","yo",["yo"],4,null,null]
  ]$json$::jsonb),
  ('r', 'The R row', 'R row', 13, $json$[
    ["ら","ra",["ra"],0,null,null],["り","ri",["ri"],1,null,null],
    ["る","ru",["ru"],2,null,null],["れ","re",["re"],3,null,null],
    ["ろ","ro",["ro"],4,null,null]
  ]$json$::jsonb),
  ('w', 'The W row', 'W row', 14, $json$[
    ["わ","wa",["wa"],0,null,null],["を","wo",["wo","o"],4,null,null]
  ]$json$::jsonb),
  ('final-n', 'The final N', 'Final N', 15, $json$[
    ["ん","n",["n","nn","n'"],2,null,null]
  ]$json$::jsonb);

create temporary table v3_items on commit drop as
select
  rows.row_id,
  rows.short_title as row_label,
  rows.row_order,
  (entry.ordinality - 1)::integer as item_order,
  'hiragana-' || rows.row_id || '-' || replace(entry.value->>1, '''', '') as id,
  entry.value->>0 as glyph,
  entry.value->>1 as primary_answer,
  entry.value->2 as accepted_answers,
  (entry.value->>3)::integer as grid_column,
  entry.value->>4 as base_glyph,
  entry.value->>5 as mark
from v3_seed_rows rows
cross join lateral jsonb_array_elements(rows.kana)
  with ordinality as entry(value, ordinality);

insert into public.learning_items (
  release_id, id, kind, schema_version, content
)
select
  '00000000-0000-4000-8000-000000000003',
  item.id,
  'hiragana',
  1,
  jsonb_strip_nulls(jsonb_build_object(
    'glyph', item.glyph,
    'primaryAnswer', item.primary_answer,
    'acceptedAnswers', item.accepted_answers,
    'rowId', item.row_id,
    'rowLabel', item.row_label,
    'column', item.grid_column,
    'curriculumOrder', item.row_order * 10 + item.item_order,
    'derivedFrom', (
      select parent.id from v3_items parent
      where parent.glyph = item.base_glyph
    ),
    'derivedForms', (
      select jsonb_agg(child.id order by child.row_order, child.item_order)
      from v3_items child
      where child.base_glyph = item.glyph
    ),
    'mark', item.mark
  ))
from v3_items item;

insert into public.curriculum_units (
  release_id, id, title, short_title, sort_order
)
select
  '00000000-0000-4000-8000-000000000003',
  'unit-' || row_id,
  title,
  short_title,
  row_order
from v3_seed_rows;

insert into public.teaching_modules (
  release_id, id, unit_id, module_type, schema_version, sort_order, content
)
select
  '00000000-0000-4000-8000-000000000003',
  rows.row_id || modules.suffix,
  'unit-' || rows.row_id,
  modules.module_type,
  1,
  modules.sort_order,
  case modules.module_type
    when 'kana-introduction-v1' then jsonb_build_object(
      'itemIds', (
        select jsonb_agg(item.id order by item.item_order)
        from v3_items item where item.row_id = rows.row_id
      ),
      'heading', 'Meet ' || (
        select string_agg(item.glyph, '  ' order by item.item_order)
        from v3_items item where item.row_id = rows.row_id
      )
    )
    when 'kana-reading-input-v1' then jsonb_build_object(
      'itemIds', (
        select jsonb_agg(item.id order by item.item_order)
        from v3_items item where item.row_id = rows.row_id
      ),
      'prompt', 'What sound does this make?'
    )
    else jsonb_build_object('heading', rows.title || ' complete')
  end
from v3_seed_rows rows
cross join (
  values
    ('-intro', 'kana-introduction-v1', 0),
    ('-check-all', 'kana-reading-input-v1', 1),
    ('-summary', 'session-summary-v1', 2)
) as modules(suffix, module_type, sort_order);

insert into public.module_targets (
  release_id, module_id, item_id, skill_id, sort_order
)
select
  modules.release_id,
  modules.id,
  item.id,
  'kana_reading',
  item.item_order
from public.teaching_modules modules
join v3_items item
  on modules.unit_id = 'unit-' || item.row_id
where modules.release_id = '00000000-0000-4000-8000-000000000003';

do $$
declare
  v_items integer;
  v_base integer;
  v_dakuten integer;
  v_handakuten integer;
  v_units integer;
begin
  select
    count(*),
    count(*) filter (where not content ? 'derivedFrom'),
    count(*) filter (where content->>'mark' = 'dakuten'),
    count(*) filter (where content->>'mark' = 'handakuten')
  into v_items, v_base, v_dakuten, v_handakuten
  from public.learning_items
  where release_id = '00000000-0000-4000-8000-000000000003';

  select count(*) into v_units
  from public.curriculum_units
  where release_id = '00000000-0000-4000-8000-000000000003';

  if v_items <> 71 or v_base <> 46 or v_dakuten <> 20
    or v_handakuten <> 5 or v_units <> 16 then
    raise exception
      'v3 curriculum incomplete: items %, base %, dakuten %, handakuten %, units %',
      v_items, v_base, v_dakuten, v_handakuten, v_units;
  end if;
end;
$$;

-- Retire v1 only after v3 is complete. Returning learners keep their stable
-- base unit IDs and encounter the missing voiced units in manifest order.
update public.curriculum_releases
set status = case
  when id = '00000000-0000-4000-8000-000000000001' then 'retired'
  when id = '00000000-0000-4000-8000-000000000003' then 'published'
  else status
end
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000003'
);
