import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import {
  applyReview,
  dueItems,
  dueTargets,
  localDayEndsAt,
  stateLabel,
} from '../scheduler';
import { learnerStateKey, type LearnerSkillState } from '../types';

describe('independent item × skill scheduling', () => {
  it('moves only the assessed item and skill', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const [a, i] = BUNDLED_MANIFEST.items;
    const aState = applyReview(
      undefined,
      a.id,
      'kana_reading',
      Rating.Good,
      now,
    );
    const states = {
      [learnerStateKey(a.id, 'kana_reading')]: aState,
    };

    expect(aState.reps).toBe(1);
    expect(aState.state).toBe(State.Learning);
    expect(states[learnerStateKey(i.id, 'kana_reading')]).toBeUndefined();
  });

  it('brings Again back sooner than a successful review', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const item = BUNDLED_MANIFEST.items[0];
    const again = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Again,
      now,
    );
    const good = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      now,
    );
    expect(new Date(again.due).getTime()).toBeLessThan(
      new Date(good.due).getTime(),
    );
  });

  it('selects reviews due through today but not tomorrow', () => {
    const now = new Date(2026, 6, 28, 9);
    const [a, i] = BUNDLED_MANIFEST.items;
    const base = applyReview(
      undefined,
      a.id,
      'kana_reading',
      Rating.Good,
      new Date(2026, 6, 27, 9),
    );
    const due = { ...base, due: new Date(2026, 6, 28, 21).toISOString() };
    const future = {
      ...base,
      itemId: i.id,
      due: new Date(2026, 6, 29, 9).toISOString(),
    };
    const items = dueItems(
      [a, i],
      {
        [learnerStateKey(a.id, 'kana_reading')]: due,
        [learnerStateKey(i.id, 'kana_reading')]: future,
      },
      now,
    );
    expect(items.map((item) => item.id)).toEqual([a.id]);
    expect(stateLabel(due, now)).toBe('Due');
    expect(stateLabel(future, now)).toBe('Learning');
  });

  it('does not reopen a review already answered on the same local day', () => {
    const now = new Date(2026, 6, 28, 17);
    const item = BUNDLED_MANIFEST.items[0];
    const reviewedToday = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date(2026, 6, 28, 9),
    );
    const artificiallyDue = {
      ...reviewedToday,
      due: new Date(2026, 6, 28, 9, 10).toISOString(),
    };

    expect(dueItems([item], {
      [learnerStateKey(item.id, 'kana_reading')]: artificiallyDue,
    }, now)).toEqual([]);
    expect(stateLabel(artificiallyDue, now)).toBe('Learning');
  });

  it('counts reading and writing for one kana as two reviews', () => {
    const now = new Date(2026, 6, 28, 9);
    const item = BUNDLED_MANIFEST.items[0];
    const reviewedYesterday = new Date(2026, 6, 27, 9);
    const reading = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      reviewedYesterday,
    );
    const writing = applyReview(
      undefined,
      item.id,
      'kana_writing',
      Rating.Good,
      reviewedYesterday,
    );
    const targets = dueTargets(
      [item],
      {
        [learnerStateKey(item.id, 'kana_reading')]: {
          ...reading,
          due: new Date(2026, 6, 28, 12).toISOString(),
        },
        [learnerStateKey(item.id, 'kana_writing')]: {
          ...writing,
          due: new Date(2026, 6, 28, 13).toISOString(),
        },
      },
      now,
    );

    expect(targets.map((target) => target.skillId)).toEqual([
      'kana_reading',
      'kana_writing',
    ]);
  });

  it('uses the next device-local midnight as an exclusive queue boundary', () => {
    const now = new Date(2026, 6, 31, 23, 30, 15, 200);
    const boundary = localDayEndsAt(now);

    expect(boundary.getFullYear()).toBe(2026);
    expect(boundary.getMonth()).toBe(7);
    expect(boundary.getDate()).toBe(1);
    expect(boundary.getHours()).toBe(0);
    expect(boundary.getMinutes()).toBe(0);
    expect(boundary.getSeconds()).toBe(0);
    expect(boundary.getMilliseconds()).toBe(0);
  });
});

describe('daily review settlement', () => {
  const item = BUNDLED_MANIFEST.items[0];

  it('keeps a first successful lesson review beyond the current day', () => {
    const reviewedAt = new Date(2026, 6, 28, 9);
    const dayEndsAt = localDayEndsAt(reviewedAt);
    const state = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      reviewedAt,
      dayEndsAt,
    );

    expect(new Date(state.due).getTime()).toBeGreaterThanOrEqual(
      dayEndsAt.getTime(),
    );
    expect(dueTargets([item], {
      [learnerStateKey(item.id, 'kana_reading')]: state,
    }, new Date(2026, 6, 28, 23))).toEqual([]);
  });

  it('fully settles a review scheduled for later today', () => {
    const reviewedAt = new Date(2026, 6, 28, 9);
    const dayEndsAt = localDayEndsAt(reviewedAt);
    const prior = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date(2026, 6, 27, 9),
    );
    const dueLaterToday = {
      ...prior,
      due: new Date(2026, 6, 28, 17).toISOString(),
    };
    const settled = applyReview(
      dueLaterToday,
      item.id,
      'kana_reading',
      Rating.Good,
      reviewedAt,
      dayEndsAt,
    );

    expect(new Date(settled.due).getTime()).toBeGreaterThanOrEqual(
      dayEndsAt.getTime(),
    );
    expect(dueTargets([item], {
      [learnerStateKey(item.id, 'kana_reading')]: settled,
    }, new Date(2026, 6, 28, 17))).toEqual([]);
  });

  it('clears a completed mixed-skill daily queue', () => {
    const reviewedAt = new Date(2026, 6, 28, 9);
    const dayEndsAt = localDayEndsAt(reviewedAt);
    const priorReview = (skillId: 'kana_reading' | 'kana_writing') => ({
      ...applyReview(
        undefined,
        item.id,
        skillId,
        Rating.Good,
        new Date(2026, 6, 27, 9),
      ),
      due: new Date(2026, 6, 28, 18).toISOString(),
    });
    const reading = applyReview(
      priorReview('kana_reading'),
      item.id,
      'kana_reading',
      Rating.Good,
      reviewedAt,
      dayEndsAt,
    );
    const writing = applyReview(
      priorReview('kana_writing'),
      item.id,
      'kana_writing',
      Rating.Good,
      new Date(2026, 6, 28, 9, 1),
      dayEndsAt,
    );

    expect(dueTargets(
      [item],
      {
        [learnerStateKey(item.id, 'kana_reading')]: reading,
        [learnerStateKey(item.id, 'kana_writing')]: writing,
      },
      new Date(2026, 6, 28, 20),
    )).toEqual([]);
  });

  it('keeps misses short-term but clears the day after the in-session recheck', () => {
    const reviewedAt = new Date(2026, 6, 28, 9);
    const dayEndsAt = localDayEndsAt(reviewedAt);
    const prior = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date(2026, 6, 27, 9),
    );
    const missed = applyReview(
      { ...prior, due: reviewedAt.toISOString() },
      item.id,
      'kana_reading',
      Rating.Again,
      reviewedAt,
      dayEndsAt,
    );
    expect(new Date(missed.due).getTime()).toBeLessThan(dayEndsAt.getTime());

    const recovered = applyReview(
      missed,
      item.id,
      'kana_reading',
      Rating.Good,
      new Date(2026, 6, 28, 9, 5),
      dayEndsAt,
    );
    expect(new Date(recovered.due).getTime()).toBeGreaterThanOrEqual(
      dayEndsAt.getTime(),
    );
    expect(dueTargets([item], {
      [learnerStateKey(item.id, 'kana_reading')]: recovered,
    }, new Date(2026, 6, 28, 20))).toEqual([]);
  });

  it('allows a completed review to return on the next local day', () => {
    const reviewedAt = new Date(2026, 6, 28, 9);
    const dayEndsAt = localDayEndsAt(reviewedAt);
    const state = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      reviewedAt,
      dayEndsAt,
    );

    expect(dueTargets([item], {
      [learnerStateKey(item.id, 'kana_reading')]: state,
    }, new Date(2026, 6, 29, 9))).toHaveLength(1);
  });
});

describe('early reviews', () => {
  const item = BUNDLED_MANIFEST.items[0];
  const firstMet = new Date('2026-07-01T09:00:00.000Z');

  /** A state that has been through enough successful reviews to be spaced out. */
  function settledState(): LearnerSkillState {
    let state = applyReview(undefined, item.id, 'kana_reading', Rating.Good, firstMet);
    let at = firstMet;
    for (let round = 0; round < 4; round += 1) {
      at = new Date(state.due);
      state = applyReview(state, item.id, 'kana_reading', Rating.Good, at);
    }
    return state;
  }

  function daysBetween(from: Date, to: Date): number {
    return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  }

  it('never pushes the next review further out than it already was', () => {
    const state = settledState();
    const previousDue = new Date(state.due);
    // Well inside the interval, where FSRS would otherwise still extend it.
    const early = new Date(previousDue.getTime() - 2 * 24 * 60 * 60 * 1000);
    const settled = applyReview(state, item.id, 'kana_reading', Rating.Good, early);

    expect(new Date(settled.due).getTime()).toBeLessThanOrEqual(
      previousDue.getTime(),
    );
    expect(new Date(settled.due).getTime()).toBeGreaterThan(early.getTime());
  });

  it('holds the clamp however early the answer comes', () => {
    const state = settledState();
    const previousDue = new Date(state.due);
    const span = previousDue.getTime() - new Date(state.updatedAt).getTime();
    for (const fraction of [0.05, 0.25, 0.5, 0.9]) {
      const early = new Date(previousDue.getTime() - span * fraction);
      const settled = applyReview(state, item.id, 'kana_reading', Rating.Good, early);
      expect(new Date(settled.due).getTime()).toBeLessThanOrEqual(
        previousDue.getTime(),
      );
    }
  });

  it('earns a smaller stability gain than answering at due time', () => {
    const state = settledState();
    const dueAt = new Date(state.due);
    const early = new Date(dueAt.getTime() - 2 * 24 * 60 * 60 * 1000);

    const earlyGain =
      applyReview(state, item.id, 'kana_reading', Rating.Good, early).stability -
      state.stability;
    const dueGain =
      applyReview(state, item.id, 'kana_reading', Rating.Good, dueAt).stability -
      state.stability;

    // Still progress — an early answer is never wasted — but materially less
    // than waiting for the card to come back on its own.
    expect(earlyGain).toBeGreaterThan(0);
    expect(earlyGain).toBeLessThan(dueGain * 0.5);
  });

  it('still extends the interval normally when the card is actually due', () => {
    const state = settledState();
    const dueAt = new Date(state.due);
    const settled = applyReview(state, item.id, 'kana_reading', Rating.Good, dueAt);

    expect(new Date(settled.due).getTime()).toBeGreaterThan(dueAt.getTime());
    expect(daysBetween(dueAt, new Date(settled.due))).toBeGreaterThan(
      daysBetween(new Date(state.updatedAt), dueAt) * 0.9,
    );
    expect(settled.stability).toBeGreaterThan(state.stability);
  });

  it('does not soften an early miss', () => {
    const state = settledState();
    const previousDue = new Date(state.due);
    const early = new Date(previousDue.getTime() - 2 * 24 * 60 * 60 * 1000);
    const missed = applyReview(state, item.id, 'kana_reading', Rating.Again, early);

    expect(missed.lapses).toBe(state.lapses + 1);
    expect(missed.stability).toBeLessThan(state.stability);
    // Shortened in full: back within the hour, not merely clamped to the old due.
    expect(new Date(missed.due).getTime()).toBeLessThan(
      early.getTime() + 60 * 60 * 1000,
    );
  });

  it('leaves a first-ever review untouched by the rule', () => {
    const first = applyReview(
      undefined,
      item.id,
      'kana_reading',
      Rating.Good,
      firstMet,
    );
    expect(new Date(first.due).getTime()).toBeGreaterThan(firstMet.getTime());
    expect(first.reps).toBe(1);
  });
});
