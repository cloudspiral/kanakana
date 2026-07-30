import { Rating } from 'ts-fsrs';

import { createInitialSnapshot } from './initialState';
import { applyReview, WRITING_SKILL } from '@/domain/scheduler';
import {
  learnerStateKey,
  type CurriculumManifest,
  type LearnerSnapshot,
  type LearningItem,
  type ReviewAttempt,
  type SkillId,
} from '@/domain/types';

interface ReturningLearnerSeedOptions {
  current: LearnerSnapshot;
  manifest: CurriculumManifest;
  guestId?: string;
  now: Date;
  createId(): string;
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function addReview(
  snapshot: LearnerSnapshot,
  outbox: ReviewAttempt[],
  item: LearningItem,
  skillId: SkillId,
  rating: Rating.Again | Rating.Good,
  reviewedAt: Date,
  sessionId: string,
  responseMs: number,
  createId: () => string,
): void {
  const key = learnerStateKey(item.id, skillId);
  const previous = snapshot.skillStates[key];
  const correct = rating === Rating.Good;
  snapshot.skillStates[key] = applyReview(
    previous,
    item.id,
    skillId,
    rating,
    reviewedAt,
  );
  outbox.push({
    eventId: createId(),
    sessionId,
    itemId: item.id,
    skillId,
    answer: correct
      ? skillId === WRITING_SKILL
        ? item.content.glyph
        : item.content.primaryAnswer
      : '',
    classification: correct ? 'exact' : 'incorrect',
    rating,
    responseMs,
    exerciseVersion: 1,
    reviewedAt: reviewedAt.toISOString(),
    expectedStateVersion: previous?.version ?? 0,
  });
}

/**
 * Build the deterministic presenter scenario without coupling it to React.
 *
 * Reading history retains the original mixed-strength pattern. Writing history
 * adds one due character from each of the first three completed units, so
 * "Begin review" necessarily includes real drawing prompts after the seed is
 * synced as well as while it is still local.
 */
export function createReturningLearnerSeed({
  current,
  manifest,
  guestId,
  now,
  createId,
}: ReturningLearnerSeedOptions): LearnerSnapshot {
  const completedUnits = manifest.units.slice(0, 3);
  const seeded: LearnerSnapshot = {
    ...createInitialSnapshot(),
    onboardingComplete: true,
    completedUnitIds: completedUnits.map((unit) => unit.id),
    settings: current.settings,
    cachedManifest: current.cachedManifest,
    sync: {
      cloudStatus: guestId ? 'synced' : 'unconfigured',
      guestId,
      acceptedCount: 0,
    },
  };
  const completedItemIds = new Set(
    completedUnits.flatMap((unit) =>
      unit.modules.flatMap((module) =>
        module.targets.map((target) => target.itemId),
      ),
    ),
  );
  const seedItems = manifest.items.filter((item) =>
    completedItemIds.has(item.id),
  );
  const sessionId = createId();
  const outbox: ReviewAttempt[] = [];

  seedItems.forEach((item, index) => {
    const firstDate =
      index % 4 === 0
        ? daysBefore(now, 14)
        : index % 4 === 1
          ? daysBefore(now, 2)
          : index % 4 === 2
            ? daysBefore(now, 1)
            : now;
    const firstRating = index % 4 === 2 ? Rating.Again : Rating.Good;
    addReview(
      seeded,
      outbox,
      item,
      'kana_reading',
      firstRating,
      firstDate,
      sessionId,
      700 + index * 11,
      createId,
    );

    if (index % 4 === 0) {
      addReview(
        seeded,
        outbox,
        item,
        'kana_reading',
        Rating.Good,
        daysBefore(now, 7),
        sessionId,
        610 + index * 7,
        createId,
      );
      addReview(
        seeded,
        outbox,
        item,
        'kana_reading',
        Rating.Good,
        now,
        sessionId,
        540 + index * 5,
        createId,
      );
    }
  });

  // One character from each completed unit keeps the scenario stable even
  // when derived rows are inserted into the curriculum. A week-old first
  // success is unambiguously due under the shared scheduler.
  const writingItems = completedUnits.map((unit) => {
    const itemId = unit.modules
      .flatMap((module) => module.targets)
      .find((target) => target.itemId)?.itemId;
    const item = manifest.items.find((candidate) => candidate.id === itemId);
    if (!item) {
      throw new Error(`Demo seed unit has no learning item: ${unit.id}`);
    }
    return item;
  });
  for (const [caseIndex, item] of writingItems.entries()) {
    addReview(
      seeded,
      outbox,
      item,
      WRITING_SKILL,
      Rating.Good,
      daysBefore(now, 7 + caseIndex),
      sessionId,
      980 + caseIndex * 90,
      createId,
    );
  }

  seeded.reviewOutbox = outbox.sort((left, right) =>
    left.reviewedAt.localeCompare(right.reviewedAt),
  );
  return seeded;
}
