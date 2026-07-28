import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card,
} from 'ts-fsrs';

import type {
  LearnerSkillState,
  LearningItem,
  SkillId,
} from './types';
import { learnerStateKey } from './types';
import { FSRS_CONFIG } from '../../supabase/functions/_shared/review-policy';

const scheduler = fsrs(FSRS_CONFIG);

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
  const result = scheduler.next(toCard(previous), reviewedAt, rating);
  return {
    itemId,
    skillId,
    version: (previous?.version ?? 0) + 1,
    updatedAt: reviewedAt.toISOString(),
    due: result.card.due.toISOString(),
    stability: result.card.stability,
    difficulty: result.card.difficulty,
    elapsed_days: result.card.elapsed_days,
    scheduled_days: result.card.scheduled_days,
    learning_steps: result.card.learning_steps,
    reps: result.card.reps,
    lapses: result.card.lapses,
    state: result.card.state,
    last_review: result.card.last_review?.toISOString(),
  };
}

export function dueItems(
  items: LearningItem[],
  states: Record<string, LearnerSkillState>,
  now = new Date(),
): LearningItem[] {
  return items
    .filter((item) => {
      const state = states[learnerStateKey(item.id, 'kana_reading')];
      return Boolean(state && state.reps > 0 && new Date(state.due) <= now);
    })
    .sort((left, right) => {
      const leftDue = states[learnerStateKey(left.id, 'kana_reading')].due;
      const rightDue = states[learnerStateKey(right.id, 'kana_reading')].due;
      return leftDue.localeCompare(rightDue);
    });
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
