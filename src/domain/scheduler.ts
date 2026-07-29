import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
} from 'ts-fsrs';

import { inkStrength, isIntroduced } from './ink';
import type {
  LearnerSkillState,
  LearningItem,
  SkillId,
} from './types';
import { learnerStateKey } from './types';
import {
  FSRS_CONFIG,
  settleEarlyReview,
} from '../../supabase/functions/_shared/review-policy';

const scheduler = fsrs(FSRS_CONFIG);

/** The skill the reading queue is built from. */
const REVIEW_SKILL: SkillId = 'kana_reading';

/** The writing skill, scheduled independently of reading for the same character. */
export const WRITING_SKILL: SkillId = 'kana_writing';


/** A character is a weak spot below this ink strength, even with no lapses. */
export const WEAK_STRENGTH_THRESHOLD = 0.62;

/** Weak spots are massed practice, not a queue — six is a session, not a chore. */
export const WEAK_ITEM_LIMIT = 6;

function toCard(state?: LearnerSkillState): Card {
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

export function applyReview(
  previous: LearnerSkillState | undefined,
  itemId: string,
  skillId: SkillId,
  rating: Rating.Again | Rating.Good,
  reviewedAt: Date,
): LearnerSkillState {
  const before = toCard(previous);
  const scheduled = scheduler.next(before, reviewedAt, rating).card;
  const card =
    previous && rating !== Rating.Again
      ? settleEarlyReview(before, scheduled, reviewedAt)
      : scheduled;
  return {
    itemId,
    skillId,
    version: (previous?.version ?? 0) + 1,
    updatedAt: reviewedAt.toISOString(),
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

export function dueItems(
  items: LearningItem[],
  states: Record<string, LearnerSkillState>,
  now = new Date(),
  skillId: SkillId = REVIEW_SKILL,
): LearningItem[] {
  return items
    .filter((item) => {
      const state = states[learnerStateKey(item.id, skillId)];
      return Boolean(state && state.reps > 0 && new Date(state.due) <= now);
    })
    .sort((left, right) => {
      const leftDue = states[learnerStateKey(left.id, skillId)].due;
      const rightDue = states[learnerStateKey(right.id, skillId)].due;
      return leftDue.localeCompare(rightDue);
    });
}

/**
 * The characters the learner keeps missing.
 *
 * Deliberately *not* the due queue: these are introduced characters that are
 * not due yet but are still shaky — they have lapsed at least once, or their
 * ink has not darkened past {@link WEAK_STRENGTH_THRESHOLD}. Ranked by lapses
 * first and weakness second, so the nemesis characters lead.
 *
 * Practising them early is safe because {@link applyReview} refuses to let an
 * early success push a schedule further out.
 */
export function weakItems(
  items: LearningItem[],
  states: Record<string, LearnerSkillState>,
  now = new Date(),
): LearningItem[] {
  // Reading only for now: writing weakness would want its own copy tuned to
  // stroke accuracy rather than recall.
  const stateFor = (item: LearningItem) =>
    states[learnerStateKey(item.id, REVIEW_SKILL)];
  return items
    .filter((item) => {
      const state = stateFor(item);
      if (!state || !isIntroduced(state) || new Date(state.due) <= now) {
        return false;
      }
      return state.lapses >= 1 || inkStrength(state) < WEAK_STRENGTH_THRESHOLD;
    })
    .sort((left, right) => {
      const leftState = stateFor(left);
      const rightState = stateFor(right);
      if (leftState.lapses !== rightState.lapses) {
        return rightState.lapses - leftState.lapses;
      }
      return inkStrength(leftState) - inkStrength(rightState);
    })
    .slice(0, WEAK_ITEM_LIMIT);
}

export function stateLabel(
  state: LearnerSkillState | undefined,
  now = new Date(),
): 'Not started' | 'Learning' | 'Strong' | 'Due' {
  if (!state || state.reps === 0) {
    return 'Not started';
  }
  if (new Date(state.due) <= now) {
    return 'Due';
  }
  if (state.state === State.Review && state.stability >= 7) {
    return 'Strong';
  }
  return 'Learning';
}

/**
 * Every prompt owed right now, across both skills.
 *
 * Reading and writing are scheduled independently, so the same character can be
 * due for one and not the other — that is the whole point of keying progress by
 * item x skill. A character only enters the writing queue once it has a writing
 * state, which the practice trace after an introduction creates.
 */
export function dueTargets(
  items: LearningItem[],
  states: Record<string, LearnerSkillState>,
  now = new Date(),
): { item: LearningItem; skillId: SkillId }[] {
  const targets: { item: LearningItem; skillId: SkillId }[] = [];
  for (const skillId of [REVIEW_SKILL, WRITING_SKILL]) {
    for (const item of dueItems(items, states, now, skillId)) {
      targets.push({ item, skillId });
    }
  }
  return targets;
}
