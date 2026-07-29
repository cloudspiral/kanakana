import type { LearnerSkillState } from './types';

/**
 * Memory strength rendered as ink density.
 *
 * The design draws every glyph in the same ink and varies only its alpha, so a
 * freshly met character looks faint and a well-remembered one looks solid —
 * "fainter is newer". This replaces bars, percentages and scores entirely.
 *
 * The prototype carries its own 0–1 `strength` field. FSRS does not, so we
 * derive one from stability.
 */

/** Ink alpha for a character that has never been introduced. */
const UNTOUCHED_ALPHA = 0.1;

/** Alpha a character gets the moment it is introduced, before any strength. */
const BASE_ALPHA = 0.18;

/** Additional alpha earned across the full strength range. */
const EARNED_ALPHA = 0.8;

/**
 * Stability, in days, at which a character reads as fully inked. 21 is the top
 * of the interval ladder the design's scheduler uses, so a character at the end
 * of that ladder is exactly the one that should look solid.
 */
const FULL_INK_STABILITY_DAYS = 21;

const INK_RGB = '27, 26, 23';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function isIntroduced(state: LearnerSkillState | undefined): boolean {
  return Boolean(state && state.reps > 0);
}

/**
 * 0 for an unmet character, rising to 1 as stability reaches the top of the
 * interval ladder.
 */
export function inkStrength(state: LearnerSkillState | undefined): number {
  if (!isIntroduced(state)) {
    return 0;
  }
  return clamp01(state!.stability / FULL_INK_STABILITY_DAYS);
}

/** The ink colour for a glyph, as an rgba string. */
export function inkColor(state: LearnerSkillState | undefined): string {
  if (!isIntroduced(state)) {
    return `rgba(${INK_RGB}, ${UNTOUCHED_ALPHA})`;
  }
  const alpha = BASE_ALPHA + inkStrength(state) * EARNED_ALPHA;
  return `rgba(${INK_RGB}, ${alpha.toFixed(2)})`;
}

/**
 * How well the learner and this character know each other, in words.
 *
 * History is consulted BEFORE the strength ladder. Strength alone described a
 * character seen six times and missed three as "Newly met", which is both wrong
 * and discouraging — the misses are the whole story for that character.
 */
export function bondFor(state: LearnerSkillState | undefined): {
  label: string;
  detail: string;
} {
  if (!isIntroduced(state)) {
    return { label: 'Not met yet', detail: 'You have not been introduced.' };
  }
  const { lapses, reps } = state!;
  if (lapses >= 3) {
    return {
      label: 'Your nemesis',
      detail: `Missed ${lapses} times. It will keep coming back until it sticks — that is the system working, not you failing.`,
    };
  }
  if (lapses >= 2 && reps >= 3) {
    return {
      label: 'Still slippery',
      detail: 'It comes back to you, but not reliably yet. A few more passes.',
    };
  }
  const strength = inkStrength(state);
  if (strength >= 0.8) {
    return { label: 'Old friend', detail: 'You read this one without thinking.' };
  }
  if (strength >= 0.5) {
    return { label: 'On familiar terms', detail: 'Solid, with the odd pause.' };
  }
  if (strength >= 0.2) {
    return { label: 'Getting acquainted', detail: 'Coming along — keep meeting it.' };
  }
  return { label: 'Newly met', detail: 'Fresh. It will be back soon.' };
}
