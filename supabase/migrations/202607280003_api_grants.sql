grant select on table
  public.curriculum_releases,
  public.learning_items,
  public.skill_definitions,
  public.curriculum_units,
  public.teaching_modules,
  public.module_targets
to authenticated;

grant select, insert, update on table public.learner_settings
to authenticated;

grant select on table
  public.learner_skill_states,
  public.review_events
to authenticated;

grant select, insert on table public.activity_events
to authenticated;

grant select, insert, update on table public.practice_sessions
to authenticated;
