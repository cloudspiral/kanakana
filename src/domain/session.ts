import * as Crypto from 'expo-crypto';

import type {
  ActivePracticeSession,
  CurriculumManifest,
  CurriculumUnit,
  LearningItem,
  PracticeStep,
  SessionOutcomes,
  SkillId,
} from './types';

export function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function blankOutcomes(): SessionOutcomes {
  return {
    introducedItemIds: [],
    strengthenedItemIds: [],
    againItemIds: [],
    correctAttempts: 0,
    totalAttempts: 0,
  };
}

function step(
  itemId: string,
  moduleId: string,
  moduleType: PracticeStep['moduleType'],
  kind: PracticeStep['kind'],
  schemaVersion = 1,
  skillId: SkillId = 'kana_reading',
): PracticeStep {
  return {
    id: Crypto.randomUUID(),
    kind,
    moduleId,
    moduleType,
    moduleSchemaVersion: schemaVersion,
    itemId,
    skillId,
    isRecheck: false,
  };
}

export function buildLessonSession(
  manifest: CurriculumManifest,
  unit: CurriculumUnit,
  now = new Date(),
): ActivePracticeSession {
  const steps: PracticeStep[] = [];
  for (const module of unit.modules) {
    if (module.moduleType === 'session-summary-v1') {
      continue;
    }
    const kind =
      module.moduleType === 'kana-introduction-v1'
        ? 'introduction'
        : 'assessment';
    for (const target of module.targets) {
      steps.push(
        step(
          target.itemId,
          module.id,
          module.moduleType,
          kind,
          module.schemaVersion,
        ),
      );
    }
  }
  return {
    id: Crypto.randomUUID(),
    kind: 'lesson',
    unitId: unit.id,
    manifestVersion: manifest.version,
    localDate: localDateKey(now),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    steps,
    currentIndex: 0,
    outcomes: blankOutcomes(),
  };
}

/** One prompt in a review queue: a character, and which skill is being asked. */
export interface ReviewTarget {
  item: LearningItem;
  skillId: SkillId;
}

/** Stable UI/session identity for one independently scheduled review task. */
export function reviewTargetKey(target: ReviewTarget): string {
  return `${target.item.id}:${target.skillId}`;
}

function orderReviewTargets(targets: ReviewTarget[]): ReviewTarget[] {
  const result: ReviewTarget[] = [];
  const remaining = [...targets];
  while (remaining.length > 0) {
    const previous = result.at(-1);
    const differentRowIndex = remaining.findIndex(
      (target) =>
        target.item.content.rowId !== previous?.item.content.rowId,
    );
    const differentItemIndex = remaining.findIndex(
      (target) => target.item.id !== previous?.item.id,
    );
    const chosenIndex =
      differentRowIndex >= 0
        ? differentRowIndex
        : differentItemIndex >= 0
          ? differentItemIndex
          : 0;
    result.push(remaining.splice(chosenIndex, 1)[0]);
  }
  return result;
}

/**
 * Give a review event a server-safe session ID.
 *
 * The server requires a UUID, so standalone writing practice — which has no
 * session of its own — gets a fresh one-event session ID. The explicit
 * `practice` case repairs events queued by older clients without silently
 * replacing unrelated malformed values.
 */
export function resolveReviewSessionId(sessionId: string | undefined): string {
  return sessionId && sessionId !== 'practice'
    ? sessionId
    : Crypto.randomUUID();
}

export function buildReviewSession(
  manifest: CurriculumManifest,
  targets: ReviewTarget[],
  now = new Date(),
): ActivePracticeSession {
  // Keep reading and writing targets distinct while spreading repeats of the
  // same character apart whenever another prompt can intervene.
  const ordered = orderReviewTargets(targets);
  return {
    id: Crypto.randomUUID(),
    kind: 'review',
    manifestVersion: manifest.version,
    localDate: localDateKey(now),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    steps: ordered.map((target) =>
      step(
        target.item.id,
        'due-review',
        target.skillId === 'kana_writing'
          ? 'kana-writing-input-v1'
          : 'kana-reading-input-v1',
        'assessment',
        1,
        target.skillId,
      ),
    ),
    currentIndex: 0,
    outcomes: blankOutcomes(),
  };
}

export function insertRecheck(
  session: ActivePracticeSession,
  failedStep: PracticeStep,
): ActivePracticeSession {
  const insertionIndex = Math.min(
    session.currentIndex + 3,
    session.steps.length,
  );
  const recheck: PracticeStep = {
    ...failedStep,
    id: Crypto.randomUUID(),
    isRecheck: true,
  };
  const steps = [...session.steps];
  steps.splice(insertionIndex, 0, recheck);
  return { ...session, steps };
}

/**
 * Advance past a graded prompt: tally the outcome and, on a miss, re-queue the
 * same prompt for a recheck. Reading and writing are graded from different
 * evidence but are bookkept identically, so they share this.
 */
export function recordAttempt(
  session: ActivePracticeSession,
  gradedStep: PracticeStep,
  correct: boolean,
  now = new Date(),
): ActivePracticeSession {
  const { outcomes } = session;
  const advanced: ActivePracticeSession = {
    ...session,
    currentIndex: session.currentIndex + 1,
    updatedAt: now.toISOString(),
    outcomes: {
      ...outcomes,
      strengthenedItemIds: correct
        ? unique([...outcomes.strengthenedItemIds, gradedStep.itemId])
        : outcomes.strengthenedItemIds,
      againItemIds: correct
        ? outcomes.againItemIds
        : unique([...outcomes.againItemIds, gradedStep.itemId]),
      correctAttempts: outcomes.correctAttempts + (correct ? 1 : 0),
      totalAttempts: outcomes.totalAttempts + 1,
    },
  };
  return correct ? advanced : insertRecheck(advanced, gradedStep);
}

export function currentStep(
  session: ActivePracticeSession | null,
): PracticeStep | null {
  if (!session) {
    return null;
  }
  return session.steps[session.currentIndex] ?? null;
}

export function sessionProgress(session: ActivePracticeSession): number {
  if (session.steps.length === 0) {
    return 1;
  }
  return Math.min(1, session.currentIndex / session.steps.length);
}
