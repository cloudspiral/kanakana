create extension if not exists pgcrypto;

create table public.curriculum_releases (
  id uuid primary key default gen_random_uuid(),
  manifest_id text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (manifest_id, version)
);

create table public.learning_items (
  release_id uuid not null references public.curriculum_releases(id) on delete cascade,
  id text not null,
  kind text not null,
  schema_version integer not null check (schema_version > 0),
  content jsonb not null,
  primary key (release_id, id)
);

create table public.skill_definitions (
  release_id uuid not null references public.curriculum_releases(id) on delete cascade,
  id text not null,
  schema_version integer not null check (schema_version > 0),
  label text not null,
  prompt text not null,
  answer_field text not null,
  primary key (release_id, id)
);

create table public.curriculum_units (
  release_id uuid not null references public.curriculum_releases(id) on delete cascade,
  id text not null,
  title text not null,
  short_title text not null,
  sort_order integer not null,
  primary key (release_id, id),
  unique (release_id, sort_order)
);

create table public.teaching_modules (
  release_id uuid not null,
  id text not null,
  unit_id text not null,
  module_type text not null,
  schema_version integer not null check (schema_version > 0),
  sort_order integer not null,
  content jsonb not null,
  primary key (release_id, id),
  foreign key (release_id, unit_id)
    references public.curriculum_units(release_id, id) on delete cascade,
  unique (release_id, unit_id, sort_order)
);

create table public.module_targets (
  release_id uuid not null,
  module_id text not null,
  item_id text not null,
  skill_id text not null,
  sort_order integer not null,
  primary key (release_id, module_id, item_id, skill_id),
  foreign key (release_id, module_id)
    references public.teaching_modules(release_id, id) on delete cascade,
  foreign key (release_id, item_id)
    references public.learning_items(release_id, id) on delete cascade,
  foreign key (release_id, skill_id)
    references public.skill_definitions(release_id, id) on delete cascade
);

create table public.learner_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  haptics_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.learner_skill_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  skill_id text not null,
  version integer not null default 0 check (version >= 0),
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days integer not null,
  scheduled_days integer not null,
  learning_steps integer not null,
  reps integer not null,
  lapses integer not null,
  state smallint not null check (state between 0 and 3),
  last_review timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id, skill_id)
);

create index learner_skill_states_due_idx
  on public.learner_skill_states(user_id, due);

create table public.review_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  item_id text not null,
  skill_id text not null,
  rating smallint not null check (rating in (1, 3)),
  correct boolean not null,
  classification text not null
    check (classification in ('exact', 'accepted_alias', 'incorrect', 'revealed')),
  response_ms integer not null check (response_ms >= 0),
  exercise_version integer not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index review_events_user_reviewed_idx
  on public.review_events(user_id, reviewed_at desc);

create table public.activity_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  event_type text not null,
  module_id text,
  item_id text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.practice_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lesson', 'review')),
  unit_id text,
  manifest_version integer not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.curriculum_releases enable row level security;
alter table public.learning_items enable row level security;
alter table public.skill_definitions enable row level security;
alter table public.curriculum_units enable row level security;
alter table public.teaching_modules enable row level security;
alter table public.module_targets enable row level security;
alter table public.learner_settings enable row level security;
alter table public.learner_skill_states enable row level security;
alter table public.review_events enable row level security;
alter table public.activity_events enable row level security;
alter table public.practice_sessions enable row level security;

create policy "authenticated users read published releases"
  on public.curriculum_releases for select to authenticated
  using (status = 'published');

create policy "authenticated users read published items"
  on public.learning_items for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_releases releases
      where releases.id = learning_items.release_id
        and releases.status = 'published'
    )
  );

create policy "authenticated users read published skills"
  on public.skill_definitions for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_releases releases
      where releases.id = skill_definitions.release_id
        and releases.status = 'published'
    )
  );

create policy "authenticated users read published units"
  on public.curriculum_units for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_releases releases
      where releases.id = curriculum_units.release_id
        and releases.status = 'published'
    )
  );

create policy "authenticated users read published modules"
  on public.teaching_modules for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_releases releases
      where releases.id = teaching_modules.release_id
        and releases.status = 'published'
    )
  );

create policy "authenticated users read published module targets"
  on public.module_targets for select to authenticated
  using (
    exists (
      select 1 from public.curriculum_releases releases
      where releases.id = module_targets.release_id
        and releases.status = 'published'
    )
  );

create policy "learners read own settings"
  on public.learner_settings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "learners insert own settings"
  on public.learner_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "learners update own settings"
  on public.learner_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "learners read own skill states"
  on public.learner_skill_states for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "learners read own review events"
  on public.review_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "learners read own activity events"
  on public.activity_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "learners insert own activity events"
  on public.activity_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "learners read own sessions"
  on public.practice_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "learners insert own sessions"
  on public.practice_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "learners update own sessions"
  on public.practice_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.get_published_curriculum_manifest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select releases.*
    from public.curriculum_releases releases
    where releases.status = 'published'
    order by releases.version desc
    limit 1
  )
  select jsonb_build_object(
    'id', latest.manifest_id,
    'version', latest.version,
    'publishedAt', to_char(latest.published_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', items.id,
          'kind', items.kind,
          'schemaVersion', items.schema_version,
          'content', items.content
        )
        order by (items.content->>'curriculumOrder')::integer
      )
      from public.learning_items items
      where items.release_id = latest.id
    ), '[]'::jsonb),
    'skills', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', skills.id,
          'schemaVersion', skills.schema_version,
          'label', skills.label,
          'prompt', skills.prompt,
          'answerField', skills.answer_field
        )
        order by skills.id
      )
      from public.skill_definitions skills
      where skills.release_id = latest.id
    ), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', units.id,
          'title', units.title,
          'shortTitle', units.short_title,
          'order', units.sort_order,
          'modules', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', modules.id,
                'moduleType', modules.module_type,
                'schemaVersion', modules.schema_version,
                'content', modules.content,
                'targets', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'itemId', targets.item_id,
                      'skillId', targets.skill_id
                    )
                    order by targets.sort_order
                  )
                  from public.module_targets targets
                  where targets.release_id = modules.release_id
                    and targets.module_id = modules.id
                ), '[]'::jsonb)
              )
              order by modules.sort_order
            )
            from public.teaching_modules modules
            where modules.release_id = units.release_id
              and modules.unit_id = units.id
          ), '[]'::jsonb)
        )
        order by units.sort_order
      )
      from public.curriculum_units units
      where units.release_id = latest.id
    ), '[]'::jsonb)
  )
  from latest;
$$;

revoke all on function public.get_published_curriculum_manifest() from public;
grant execute on function public.get_published_curriculum_manifest() to authenticated;

create or replace function public.commit_review_event(
  p_event jsonb,
  p_state jsonb,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id uuid := (p_event->>'eventId')::uuid;
  v_item_id text := p_event->>'itemId';
  v_skill_id text := p_event->>'skillId';
  v_rows integer;
  v_state public.learner_skill_states%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  if exists (
    select 1 from public.review_events
    where event_id = v_event_id and user_id = v_user_id
  ) then
    select * into v_state
    from public.learner_skill_states
    where user_id = v_user_id and item_id = v_item_id and skill_id = v_skill_id;
    return jsonb_build_object('duplicate', true, 'state', to_jsonb(v_state));
  end if;

  if p_expected_version = 0 then
    insert into public.learner_skill_states (
      user_id, item_id, skill_id, version, due, stability, difficulty,
      elapsed_days, scheduled_days, learning_steps, reps, lapses, state,
      last_review, updated_at
    ) values (
      v_user_id, v_item_id, v_skill_id, 1,
      (p_state->>'due')::timestamptz,
      (p_state->>'stability')::double precision,
      (p_state->>'difficulty')::double precision,
      (p_state->>'elapsed_days')::integer,
      (p_state->>'scheduled_days')::integer,
      (p_state->>'learning_steps')::integer,
      (p_state->>'reps')::integer,
      (p_state->>'lapses')::integer,
      (p_state->>'state')::smallint,
      nullif(p_state->>'last_review', '')::timestamptz,
      now()
    )
    on conflict (user_id, item_id, skill_id) do nothing;
  else
    update public.learner_skill_states
    set
      version = p_expected_version + 1,
      due = (p_state->>'due')::timestamptz,
      stability = (p_state->>'stability')::double precision,
      difficulty = (p_state->>'difficulty')::double precision,
      elapsed_days = (p_state->>'elapsed_days')::integer,
      scheduled_days = (p_state->>'scheduled_days')::integer,
      learning_steps = (p_state->>'learning_steps')::integer,
      reps = (p_state->>'reps')::integer,
      lapses = (p_state->>'lapses')::integer,
      state = (p_state->>'state')::smallint,
      last_review = nullif(p_state->>'last_review', '')::timestamptz,
      updated_at = now()
    where user_id = v_user_id
      and item_id = v_item_id
      and skill_id = v_skill_id
      and version = p_expected_version;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'state_version_conflict';
  end if;

  insert into public.review_events (
    event_id, user_id, session_id, item_id, skill_id, rating, correct,
    classification, response_ms, exercise_version, reviewed_at
  ) values (
    v_event_id,
    v_user_id,
    (p_event->>'sessionId')::uuid,
    v_item_id,
    v_skill_id,
    (p_event->>'rating')::smallint,
    (p_event->>'correct')::boolean,
    p_event->>'classification',
    (p_event->>'responseMs')::integer,
    (p_event->>'exerciseVersion')::integer,
    (p_event->>'reviewedAt')::timestamptz
  );

  select * into v_state
  from public.learner_skill_states
  where user_id = v_user_id and item_id = v_item_id and skill_id = v_skill_id;

  return jsonb_build_object('duplicate', false, 'state', to_jsonb(v_state));
end;
$$;

revoke all on function public.commit_review_event(jsonb, jsonb, integer) from public;
grant execute on function public.commit_review_event(jsonb, jsonb, integer) to authenticated;
