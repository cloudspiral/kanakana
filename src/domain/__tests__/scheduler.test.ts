import { Rating, State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';

import { BUNDLED_MANIFEST } from '../curriculum';
import { applyReview, dueItems, stateLabel } from '../scheduler';
import { learnerStateKey } from '../types';

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

  it('selects only states due at the requested time', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const [a, i] = BUNDLED_MANIFEST.items;
    const due = applyReview(
      undefined,
      a.id,
      'kana_reading',
      Rating.Again,
      new Date('2026-07-28T11:00:00.000Z'),
    );
    const future = applyReview(
      undefined,
      i.id,
      'kana_reading',
      Rating.Good,
      now,
    );
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
});
