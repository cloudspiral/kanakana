import { describe, expect, it, vi } from 'vitest';

import { createInitialSnapshot } from '../initialState';
import { createReturningLearnerSeed } from '../demoSeed';
import { BUNDLED_MANIFEST } from '@/domain/curriculum';
import { dueTargets, WRITING_SKILL } from '@/domain/scheduler';
import { buildReviewSession } from '@/domain/session';

vi.mock('expo-crypto', () => {
  let id = 0;
  return { randomUUID: () => `session-test-${++id}` };
});

describe('returning learner demo seed', () => {
  it('puts three syncable writing cases into the due review session', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    let id = 0;
    const snapshot = createReturningLearnerSeed({
      current: createInitialSnapshot(),
      manifest: BUNDLED_MANIFEST,
      guestId: 'demo-guest',
      now,
      createId: () => `seed-event-${++id}`,
    });
    const due = dueTargets(
      BUNDLED_MANIFEST.items,
      snapshot.skillStates,
      now,
    );
    const writingTargets = due.filter(
      (target) => target.skillId === WRITING_SKILL,
    );

    expect(
      new Set(writingTargets.map((target) => target.item.content.rowId)),
    ).toEqual(new Set(['vowels', 'k', 'g']));
    expect(
      snapshot.reviewOutbox.filter(
        (event) => event.skillId === WRITING_SKILL,
      ),
    ).toHaveLength(3);

    const session = buildReviewSession(BUNDLED_MANIFEST, due, now);
    const sequence = session.steps.map((step) => ({
      glyph: BUNDLED_MANIFEST.items.find((item) => item.id === step.itemId)!
        .content.glyph,
      skillId: step.skillId,
    }));
    expect(sequence.slice(5, 8)).toEqual([
      { glyph: 'き', skillId: 'kana_reading' },
      { glyph: 'が', skillId: 'kana_reading' },
      { glyph: 'か', skillId: 'kana_writing' },
    ]);
    expect(
      session.steps.every(
        (step, index, steps) =>
          index === 0 || step.itemId !== steps[index - 1].itemId,
      ),
    ).toBe(true);
    expect(
      session.steps
        .filter((step) => step.skillId === WRITING_SKILL)
        .map((step) => step.moduleType),
    ).toEqual([
      'kana-writing-input-v1',
      'kana-writing-input-v1',
      'kana-writing-input-v1',
    ]);
  });
});
