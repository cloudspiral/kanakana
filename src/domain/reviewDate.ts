import type { LearnerSkillState } from './types';

/** Device-local calendar date for one independently scheduled review skill. */
export function reviewDateLabel(
  state: LearnerSkillState | undefined,
  now = new Date(),
  locales?: Intl.LocalesArgument,
): string | null {
  if (!state || state.reps === 0) {
    return null;
  }
  const due = new Date(state.due);
  if (Number.isNaN(due.getTime())) {
    return null;
  }
  return due.toLocaleDateString(locales, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(due.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Compact profile copy that distinguishes future and already-due work. */
export function reviewScheduleLabel(
  state: LearnerSkillState | undefined,
  now = new Date(),
  locales?: Intl.LocalesArgument,
): string | null {
  const date = reviewDateLabel(state, now, locales);
  if (!date || !state) {
    return null;
  }
  const due = new Date(state.due);
  return `${due.getTime() <= now.getTime() ? 'Due' : 'Next review'} · ${date}`;
}
