import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import { inkStrength } from '../ink';
import {
  applyReview,
  WEAK_ITEM_LIMIT,
  WEAK_STRENGTH_THRESHOLD,
  weakItems,
} from '../scheduler';
import { learnerStateKey, type LearnerSkillState } from '../types';

const now = new Date('2026-07-28T12:00:00.000Z');
const items = BUNDLED_MANIFEST.items;

const DAY = 24 * 60 * 60 * 1000;

interface Shape {
  lapses?: number;
  stability?: number;
  dueInDays?: number;
  reps?: number;
}

/** A learner state shaped by hand, so the ranking rules are readable. */
function stateFor(
  item: (typeof items)[number],
  { lapses = 0, stability = 30, dueInDays = 3, reps = 3 }: Shape = {},
): LearnerSkillState {
  return {
    itemId: item.id,
    skillId: 'kana_reading',
    version: 1,
    updatedAt: now.toISOString(),
    due: new Date(now.getTime() + dueInDays * DAY).toISOString(),
    stability,
    difficulty: 5,
    elapsed_days: 1,
    scheduled_days: dueInDays,
    learning_steps: 0,
    reps,
    lapses,
    state: State.Review,
    last_review: now.toISOString(),
  };
}

function pack(
  entries: [(typeof items)[number], Shape][],
): Record<string, LearnerSkillState> {
  return Object.fromEntries(
    entries.map(([item, shape]) => [
      learnerStateKey(item.id, 'kana_reading'),
      stateFor(item, shape),
    ]),
  );
}

describe('weak spots', () => {
  it('ignores characters that have not been introduced', () => {
    const [a, i] = items;
    const states = pack([[a, { lapses: 2 }]]);
    // `i` has no state at all, and a state with no reps is equally unmet.
    states[learnerStateKey(i.id, 'kana_reading')] = stateFor(i, {
      lapses: 4,
      reps: 0,
    });

    expect(weakItems(items, states, now).map((item) => item.id)).toEqual([a.id]);
  });

  it('leaves currently due characters to the due queue', () => {
    const [a, i] = items;
    const states = pack([
      [a, { lapses: 3, dueInDays: -1 }],
      [i, { lapses: 1, dueInDays: 2 }],
    ]);

    expect(weakItems(items, states, now).map((item) => item.id)).toEqual([i.id]);
  });

  it('includes a lapsed character even when its ink is dark', () => {
    const [a, i] = items;
    const strong = { stability: 500 };
    const states = pack([
      [a, { ...strong, lapses: 1 }],
      [i, strong],
    ]);

    expect(inkStrength(states[learnerStateKey(i.id, 'kana_reading')])).toBe(1);
    expect(weakItems(items, states, now).map((item) => item.id)).toEqual([a.id]);
  });

  it('includes a faint character that has never lapsed', () => {
    const [a] = items;
    const states = pack([[a, { lapses: 0, stability: 1 }]]);
    const state = states[learnerStateKey(a.id, 'kana_reading')];

    expect(inkStrength(state)).toBeLessThan(WEAK_STRENGTH_THRESHOLD);
    expect(weakItems(items, states, now).map((item) => item.id)).toEqual([a.id]);
  });

  it('treats the strength threshold as exclusive', () => {
    const [a] = items;
    // inkStrength is stability / 21, so this lands exactly on 0.62.
    const atThreshold = pack([
      [a, { stability: WEAK_STRENGTH_THRESHOLD * 21 }],
    ]);
    const justBelow = pack([
      [a, { stability: WEAK_STRENGTH_THRESHOLD * 21 - 0.1 }],
    ]);

    expect(weakItems(items, atThreshold, now)).toEqual([]);
    expect(weakItems(items, justBelow, now)).toHaveLength(1);
  });

  it('ranks by lapses first and weakness second', () => {
    const [a, i, u, e] = items;
    const states = pack([
      [a, { lapses: 1, stability: 2 }],
      [i, { lapses: 2, stability: 20 }],
      [u, { lapses: 2, stability: 4 }],
      [e, { lapses: 0, stability: 1 }],
    ]);

    expect(weakItems(items, states, now).map((item) => item.id)).toEqual([
      u.id, // 2 lapses, faintest
      i.id, // 2 lapses
      a.id, // 1 lapse
      e.id, // none, but faint
    ]);
  });

  it('caps the session at six', () => {
    const states = pack(
      items.slice(0, 12).map((item, index) => [
        item,
        { lapses: 12 - index, stability: 1 },
      ]),
    );
    const weak = weakItems(items, states, now);

    expect(weak).toHaveLength(WEAK_ITEM_LIMIT);
    expect(weak.map((item) => item.id)).toEqual(
      items.slice(0, WEAK_ITEM_LIMIT).map((item) => item.id),
    );
  });

  it('is empty when nothing is shaky', () => {
    const [a, i] = items;
    const states = pack([
      [a, { stability: 100 }],
      [i, { stability: 100 }],
    ]);

    expect(weakItems(items, states, now)).toEqual([]);
  });
});

describe('weak spots and the real scheduler', () => {
  it('surfaces a character that was just missed, once it is no longer due', () => {
    const item = items[0];
    const states = pack([[item, { lapses: 0, stability: 40, dueInDays: 5 }]]);
    const key = learnerStateKey(item.id, 'kana_reading');

    expect(weakItems(items, states, now)).toEqual([]);

    // A miss, then the relearning step passes.
    states[key] = applyReview(
      states[key],
      item.id,
      'kana_reading',
      Rating.Again,
      now,
    );
    const later = new Date(new Date(states[key].due).getTime() + 60 * 1000);
    states[key] = applyReview(
      states[key],
      item.id,
      'kana_reading',
      Rating.Good,
      later,
    );

    expect(states[key].lapses).toBe(1);
    expect(weakItems(items, states, later).map((entry) => entry.id)).toEqual([
      item.id,
    ]);
  });
});
