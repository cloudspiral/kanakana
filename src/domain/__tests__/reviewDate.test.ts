import { describe, expect, it } from 'vitest';

import { reviewDateLabel, reviewScheduleLabel } from '../reviewDate';
import type { LearnerSkillState } from '../types';

function scheduledFor(due: Date): LearnerSkillState {
  return {
    itemId: 'hiragana-k-ka',
    skillId: 'kana_reading',
    due: due.toISOString(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: 1,
    learning_steps: 0,
    reps: 1,
    lapses: 0,
    state: 1,
    version: 1,
    updatedAt: due.toISOString(),
  };
}

describe('review date labels', () => {
  it('formats the scheduled date in the learner local calendar', () => {
    const now = new Date(2026, 6, 31, 12);
    const due = new Date(2026, 7, 4, 9);

    expect(reviewDateLabel(scheduledFor(due), now, 'en-US')).toBe(
      'Tue, Aug 4',
    );
  });

  it('adds the year when the review crosses into another year', () => {
    const now = new Date(2026, 11, 31, 12);
    const due = new Date(2027, 0, 2, 9);

    expect(reviewDateLabel(scheduledFor(due), now, 'en-US')).toBe(
      'Sat, Jan 2, 2027',
    );
  });

  it('does not invent a date for an unstarted skill', () => {
    expect(reviewDateLabel(undefined, new Date(), 'en-US')).toBeNull();
  });

  it('marks an overdue review as due instead of calling it next', () => {
    const now = new Date(2026, 6, 31, 12);
    const due = new Date(2026, 6, 23, 9);

    expect(reviewScheduleLabel(scheduledFor(due), now, 'en-US')).toBe(
      'Due · Thu, Jul 23',
    );
  });
});
