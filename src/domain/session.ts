import * as Crypto from 'expo-crypto';

import type {
  ActivePracticeSession,
  CurriculumManifest,
  CurriculumUnit,
  LearningItem,
  PracticeStep,
  SessionOutcomes,
} from './types';

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
): PracticeStep {
  return {
    id: Crypto.randomUUID(),
    kind,
    moduleId,
    moduleType,
    moduleSchemaVersion: schemaVersion,
    itemId,
    skillId: 'kana_reading',
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

function avoidImmediateRepeats(items: LearningItem[]): LearningItem[] {
  const result: LearningItem[] = [];
  const remaining = [...items];
  while (remaining.length > 0) {
    const previous = result.at(-1);
    const index = remaining.findIndex(
      (item) => item.content.rowId !== previous?.content.rowId,
    );
    const chosenIndex = index >= 0 ? index : 0;
    result.push(remaining.splice(chosenIndex, 1)[0]);
  }
  return result;
}

export function buildReviewSession(
  manifest: CurriculumManifest,
  items: LearningItem[],
  now = new Date(),
): ActivePracticeSession {
  const ordered = avoidImmediateRepeats(items);
  return {
    id: Crypto.randomUUID(),
    kind: 'review',
    manifestVersion: manifest.version,
    localDate: localDateKey(now),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    steps: ordered.map((item) =>
      step(
        item.id,
        'due-review',
        'kana-reading-input-v1',
        'assessment',
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
