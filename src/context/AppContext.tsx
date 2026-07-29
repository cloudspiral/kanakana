import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { Rating } from 'ts-fsrs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { learningRepository } from '@/data/repository';
import { createInitialSnapshot } from '@/data/initialState';
import {
  BUNDLED_MANIFEST,
  getItem,
} from '@/domain/curriculum';
import {
  classifyAnswer,
  isCorrectClassification,
  isNearMiss,
} from '@/domain/answers';
import {
  applyReview,
  dueItems,
  dueTargets,
  weakItems,
  WRITING_SKILL,
} from '@/domain/scheduler';
import {
  buildLessonSession,
  buildReviewSession,
  currentStep,
  insertRecheck,
  localDateKey,
} from '@/domain/session';
import {
  learnerStateKey,
  type ActivePracticeSession,
  type AnswerClassification,
  type CurriculumManifest,
  type LearnerSettings,
  type LearnerSnapshot,
  type LearningItem,
  type RepositoryDiagnostics,
  type ReviewAttempt,
} from '@/domain/types';
import { syncService } from '@/services/sync';

interface AnswerResult {
  correct: boolean;
  classification: AnswerClassification;
  primaryAnswer: string;
  sessionComplete: boolean;
}

interface AppContextValue {
  ready: boolean;
  snapshot: LearnerSnapshot;
  manifest: CurriculumManifest;
  activeSession: ActivePracticeSession | null;
  dueCount: number;
  nextUnitId?: string;
  repositoryDiagnostics: RepositoryDiagnostics | null;
  completeOnboarding(): Promise<void>;
  startContinue(): Promise<'practice' | 'complete'>;
  /** Massed practice on trouble spots. Distinct from the due queue. */
  startWeakSpots(): Promise<'practice' | 'complete'>;
  startUnit(unitId: string): Promise<void>;
  advanceIntroduction(): Promise<boolean>;
  answerCurrent(
    answer: string,
    responseMs: number,
    revealed?: boolean,
  ): Promise<AnswerResult>;
  /**
   * Grade the current writing prompt. Correctness is decided on the client from
   * stroke geometry (and the learner's own call), not from a typed answer.
   */
  answerWriting(correct: boolean, responseMs: number): Promise<AnswerResult>;
  /**
   * Seed the writing schedule from the no-stakes practice trace after an
   * introduction. Only ever recorded as a success, so practising cannot hurt.
   */
  recordWritingPractice(itemId: string): Promise<void>;
  /**
   * Revert the last miss and count it as recalled. Offered only for a one-edit
   * slip, and never after the answer was revealed.
   */
  undoLastMiss(): Promise<AnswerResult | null>;
  closeSummary(): Promise<void>;
  updateSettings(partial: Partial<LearnerSettings>): Promise<void>;
  resetProgress(): Promise<void>;
  freshGuest(): Promise<void>;
  seedReturningLearner(): Promise<void>;
  syncNow(): Promise<{ pending: number; accepted: number }>;
  refreshDiagnostics(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function getPinnedManifest(snapshot: LearnerSnapshot): CurriculumManifest {
  if (snapshot.cachedManifest) {
    return snapshot.cachedManifest;
  }
  return BUNDLED_MANIFEST;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<LearnerSnapshot>(
    createInitialSnapshot,
  );
  const snapshotRef = useRef(snapshot);
  const [ready, setReady] = useState(false);
  const [repositoryDiagnostics, setRepositoryDiagnostics] =
    useState<RepositoryDiagnostics | null>(null);
  /** The last near-miss, kept only long enough to offer the typo override. */
  const lastAttempt = useRef<{
    snapshot: LearnerSnapshot;
    answer: string;
    responseMs: number;
  } | null>(null);

  const persist = useCallback(async (next: LearnerSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    await learningRepository.saveSnapshot(next);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    setRepositoryDiagnostics(await learningRepository.diagnostics());
  }, []);

  const syncNow = useCallback(async () => {
    const current = snapshotRef.current;
    const syncing = {
      ...current,
      sync: { ...current.sync, cloudStatus: 'syncing' as const },
    };
    snapshotRef.current = syncing;
    setSnapshot(syncing);
    const result = await syncService.sync(syncing, getPinnedManifest(syncing));
    const canonicalByKey = Object.fromEntries(
      result.canonicalStates.map((state) => [
        learnerStateKey(state.itemId, state.skillId),
        state,
      ]),
    );
    const acceptedIds = new Set(result.acceptedEventIds);
    const next: LearnerSnapshot = {
      ...syncing,
      skillStates: { ...syncing.skillStates, ...canonicalByKey },
      reviewOutbox: syncing.reviewOutbox.filter(
        (event) => !acceptedIds.has(event.eventId),
      ),
      sync: {
        cloudStatus: result.cloudStatus,
        guestId: result.guestId ?? syncing.sync.guestId,
        lastSyncAt:
          result.cloudStatus === 'synced'
            ? new Date().toISOString()
            : syncing.sync.lastSyncAt,
        lastError: result.error,
        acceptedCount: syncing.sync.acceptedCount + result.acceptedCount,
      },
    };
    await persist(next);
    return {
      pending: next.reviewOutbox.length,
      accepted: result.acceptedCount,
    };
  }, [persist]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await learningRepository.initialize();
      let loaded = await learningRepository.loadSnapshot();
      if (
        loaded.activeSession &&
        loaded.activeSession.localDate !== localDateKey()
      ) {
        loaded = { ...loaded, activeSession: null };
        await learningRepository.saveSnapshot(loaded);
      }
      if (!mounted) {
        return;
      }
      snapshotRef.current = loaded;
      setSnapshot(loaded);
      setReady(true);
      await refreshDiagnostics();

      if (!loaded.activeSession) {
        try {
          const remoteManifest = await syncService.fetchManifest();
          if (
            remoteManifest &&
            remoteManifest.version > getPinnedManifest(loaded).version
          ) {
            loaded = { ...loaded, cachedManifest: remoteManifest };
            await persist(loaded);
          }
        } catch {
          // A bundled, validated curriculum is always available offline.
        }
      }
      await syncNow();
    })();
    return () => {
      mounted = false;
    };
  }, [persist, refreshDiagnostics, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        void syncNow();
      }
    });
    return () => subscription.remove();
  }, [syncNow]);

  const manifest = useMemo(() => getPinnedManifest(snapshot), [snapshot]);
  const activeSession = snapshot.activeSession;
  const due = useMemo(
    () => dueItems(manifest.items, snapshot.skillStates),
    [manifest.items, snapshot.skillStates],
  );
  const nextUnit = manifest.units
    .slice()
    .sort((left, right) => left.order - right.order)
    .find((unit) => !snapshot.completedUnitIds.includes(unit.id));

  const completeOnboarding = useCallback(async () => {
    await persist({ ...snapshotRef.current, onboardingComplete: true });
  }, [persist]);

  const startUnit = useCallback(
    async (unitId: string) => {
      const current = snapshotRef.current;
      const currentManifest = getPinnedManifest(current);
      const unit = currentManifest.units.find(
        (candidate) => candidate.id === unitId,
      );
      if (!unit) {
        throw new Error(`Unknown curriculum unit: ${unitId}`);
      }
      const session = buildLessonSession(currentManifest, unit);
      await persist({
        ...current,
        activeSession: session,
        lastSummary: null,
        activityEvents: [
          ...current.activityEvents,
          {
            id: session.id,
            type: 'module_started',
            sessionId: session.id,
            moduleId: unit.modules[0]?.id,
            occurredAt: new Date().toISOString(),
          },
        ],
      });
    },
    [persist],
  );

  const startContinue = useCallback(async (): Promise<
    'practice' | 'complete'
  > => {
    const current = snapshotRef.current;
    if (current.activeSession) {
      return 'practice';
    }
    const currentManifest = getPinnedManifest(current);
    const currentDue = dueTargets(currentManifest.items, current.skillStates);
    if (currentDue.length > 0) {
      await persist({
        ...current,
        activeSession: buildReviewSession(currentManifest, currentDue),
        lastSummary: null,
      });
      return 'practice';
    }
    const upcoming = currentManifest.units
      .slice()
      .sort((left, right) => left.order - right.order)
      .find((unit) => !current.completedUnitIds.includes(unit.id));
    if (!upcoming) {
      return 'complete';
    }
    await startUnit(upcoming.id);
    return 'practice';
  }, [persist, startUnit]);

  const startWeakSpots = useCallback(async (): Promise<'practice' | 'complete'> => {
    const current = snapshotRef.current;
    if (current.activeSession) {
      return 'practice';
    }
    const currentManifest = getPinnedManifest(current);
    const weak = weakItems(currentManifest.items, current.skillStates);
    if (weak.length === 0) {
      return 'complete';
    }
    // Safe to offer at any time: the early-review rule means answering ahead of
    // schedule can only rescue an interval, never inflate it.
    await persist({
      ...current,
      activeSession: buildReviewSession(
        currentManifest,
        weak.map((item) => ({ item, skillId: 'kana_reading' as const })),
      ),
      lastSummary: null,
    });
    return 'practice';
  }, [persist]);

  const finishIfComplete = useCallback(
    async (session: ActivePracticeSession, current: LearnerSnapshot) => {
      if (session.currentIndex < session.steps.length) {
        await persist({ ...current, activeSession: session });
        return false;
      }
      const completedUnitIds =
        session.kind === 'lesson' && session.unitId
          ? unique([...current.completedUnitIds, session.unitId])
          : current.completedUnitIds;
      const completedAt = new Date().toISOString();
      await persist({
        ...current,
        completedUnitIds,
        activeSession: null,
        lastSummary: {
          sessionId: session.id,
          kind: session.kind,
          unitId: session.unitId,
          outcomes: session.outcomes,
          completedAt,
        },
        activityEvents: [
          ...current.activityEvents,
          {
            id: `complete-${session.id}`,
            type: 'session_completed',
            sessionId: session.id,
            occurredAt: completedAt,
          },
        ],
      });
      void syncNow();
      return true;
    },
    [persist, syncNow],
  );

  const advanceIntroduction = useCallback(async () => {
    const current = snapshotRef.current;
    const session = current.activeSession;
    const activeStep = currentStep(session);
    if (!session || !activeStep || activeStep.kind !== 'introduction') {
      return false;
    }
    const now = new Date().toISOString();
    const nextSession: ActivePracticeSession = {
      ...session,
      currentIndex: session.currentIndex + 1,
      updatedAt: now,
      outcomes: {
        ...session.outcomes,
        introducedItemIds: unique([
          ...session.outcomes.introducedItemIds,
          activeStep.itemId,
        ]),
      },
    };
    const next = {
      ...current,
      activityEvents: [
        ...current.activityEvents,
        {
          id: activeStep.id,
          type: 'item_exposed' as const,
          sessionId: session.id,
          moduleId: activeStep.moduleId,
          itemId: activeStep.itemId,
          occurredAt: now,
        },
      ],
    };
    return finishIfComplete(nextSession, next);
  }, [finishIfComplete]);

  const answerCurrent = useCallback(
    async (
      answer: string,
      responseMs: number,
      revealed = false,
      forceCorrect = false,
    ): Promise<AnswerResult> => {
      const current = snapshotRef.current;
      // Snapshotting the whole pre-answer state is what makes the typo revert
      // exact: strength, interval, lapses and the session tallies all come back
      // together, rather than being unwound field by field.
      if (!forceCorrect) {
        lastAttempt.current = null;
      }
      const session = current.activeSession;
      const activeStep = currentStep(session);
      if (!session || !activeStep || activeStep.kind !== 'assessment') {
        throw new Error('There is no active reading prompt.');
      }

      const item = getItem(getPinnedManifest(current), activeStep.itemId);
      const classification = forceCorrect
        ? ('exact' as const)
        : revealed
          ? ('revealed' as const)
          : classifyAnswer(item, answer);
      const correct = forceCorrect || isCorrectClassification(classification);
      const rating: Rating.Good | Rating.Again = correct
        ? Rating.Good
        : Rating.Again;
      const reviewedAt = new Date();
      const stateKey = learnerStateKey(activeStep.itemId, activeStep.skillId);
      const previousState = current.skillStates[stateKey];
      const nextState = applyReview(
        previousState,
        activeStep.itemId,
        activeStep.skillId,
        rating,
        reviewedAt,
      );

      let nextSession: ActivePracticeSession = {
        ...session,
        currentIndex: session.currentIndex + 1,
        updatedAt: reviewedAt.toISOString(),
        outcomes: {
          ...session.outcomes,
          strengthenedItemIds: correct
            ? unique([
                ...session.outcomes.strengthenedItemIds,
                activeStep.itemId,
              ])
            : session.outcomes.strengthenedItemIds,
          againItemIds: correct
            ? session.outcomes.againItemIds
            : unique([...session.outcomes.againItemIds, activeStep.itemId]),
          correctAttempts:
            session.outcomes.correctAttempts + (correct ? 1 : 0),
          totalAttempts: session.outcomes.totalAttempts + 1,
        },
      };
      if (!correct) {
        nextSession = insertRecheck(nextSession, activeStep);
      }

      const event = {
        eventId: activeStep.id,
        sessionId: session.id,
        itemId: activeStep.itemId,
        skillId: activeStep.skillId,
        answer,
        classification,
        rating,
        responseMs,
        exerciseVersion: activeStep.moduleSchemaVersion,
        reviewedAt: reviewedAt.toISOString(),
        expectedStateVersion: previousState?.version ?? 0,
      };
      const next: LearnerSnapshot = {
        ...current,
        skillStates: {
          ...current.skillStates,
          [stateKey]: nextState,
        },
        reviewOutbox: [...current.reviewOutbox, event],
      };

      if (!correct && !revealed && isNearMiss(item, answer)) {
        lastAttempt.current = {
          snapshot: current,
          answer,
          responseMs,
        };
      }

      const sessionComplete = await finishIfComplete(nextSession, next);
      if (
        !sessionComplete &&
        next.reviewOutbox.length > 0 &&
        next.reviewOutbox.length % 5 === 0
      ) {
        void syncNow();
      }
      if (snapshotRef.current.settings.hapticsEnabled) {
        void Haptics.notificationAsync(
          correct
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
      return {
        correct,
        classification,
        primaryAnswer: item.content.primaryAnswer,
        sessionComplete,
      };
    },
    [finishIfComplete, syncNow],
  );

  const answerWriting = useCallback(
    async (correct: boolean, responseMs: number): Promise<AnswerResult> => {
      const current = snapshotRef.current;
      const session = current.activeSession;
      const activeStep = currentStep(session);
      if (!session || !activeStep || activeStep.kind !== 'assessment') {
        throw new Error('There is no active writing prompt.');
      }
      const item = getItem(getPinnedManifest(current), activeStep.itemId);
      const rating: Rating.Again | Rating.Good = correct
        ? Rating.Good
        : Rating.Again;
      const reviewedAt = new Date();
      const stateKey = learnerStateKey(activeStep.itemId, activeStep.skillId);
      const previousState = current.skillStates[stateKey];
      const nextState = applyReview(
        previousState,
        activeStep.itemId,
        activeStep.skillId,
        rating,
        reviewedAt,
      );

      let nextSession: ActivePracticeSession = {
        ...session,
        currentIndex: session.currentIndex + 1,
        updatedAt: reviewedAt.toISOString(),
        outcomes: {
          ...session.outcomes,
          strengthenedItemIds: correct
            ? unique([...session.outcomes.strengthenedItemIds, activeStep.itemId])
            : session.outcomes.strengthenedItemIds,
          againItemIds: correct
            ? session.outcomes.againItemIds
            : unique([...session.outcomes.againItemIds, activeStep.itemId]),
          correctAttempts: session.outcomes.correctAttempts + (correct ? 1 : 0),
          totalAttempts: session.outcomes.totalAttempts + 1,
        },
      };
      if (!correct) {
        nextSession = insertRecheck(nextSession, activeStep);
      }

      const next: LearnerSnapshot = {
        ...current,
        skillStates: { ...current.skillStates, [stateKey]: nextState },
        reviewOutbox: [
          ...current.reviewOutbox,
          {
            eventId: activeStep.id,
            sessionId: session.id,
            itemId: activeStep.itemId,
            skillId: activeStep.skillId,
            // No typed answer exists for a drawing; the glyph identifies what
            // was asked and the database never stores raw input anyway.
            answer: item.content.glyph,
            classification: correct ? ('exact' as const) : ('incorrect' as const),
            rating,
            responseMs,
            exerciseVersion: activeStep.moduleSchemaVersion,
            reviewedAt: reviewedAt.toISOString(),
            expectedStateVersion: previousState?.version ?? 0,
          },
        ],
      };

      const sessionComplete = await finishIfComplete(nextSession, next);
      return {
        correct,
        classification: correct ? 'exact' : 'incorrect',
        primaryAnswer: item.content.primaryAnswer,
        sessionComplete,
      };
    },
    [finishIfComplete],
  );

  const recordWritingPractice = useCallback(
    async (itemId: string) => {
      const current = snapshotRef.current;
      const stateKey = learnerStateKey(itemId, WRITING_SKILL);
      // Practice is no-stakes: it can start the writing schedule but never
      // damage one, so an existing state is left alone.
      if (current.skillStates[stateKey]) {
        return;
      }
      const reviewedAt = new Date();
      const nextState = applyReview(
        undefined,
        itemId,
        WRITING_SKILL,
        Rating.Good,
        reviewedAt,
      );
      await persist({
        ...current,
        skillStates: { ...current.skillStates, [stateKey]: nextState },
        reviewOutbox: [
          ...current.reviewOutbox,
          {
            eventId: Crypto.randomUUID(),
            sessionId: current.activeSession?.id ?? 'practice',
            itemId,
            skillId: WRITING_SKILL,
            answer: '',
            classification: 'exact' as const,
            rating: Rating.Good,
            responseMs: 0,
            exerciseVersion: 1,
            reviewedAt: reviewedAt.toISOString(),
            expectedStateVersion: 0,
          },
        ],
      });
    },
    [persist],
  );

  const undoLastMiss = useCallback(async (): Promise<AnswerResult | null> => {
    const attempt = lastAttempt.current;
    if (!attempt) {
      return null;
    }
    lastAttempt.current = null;
    // Restore the exact pre-answer state, then replay the same answer as a
    // success so every downstream consequence is recomputed rather than patched.
    await persist(attempt.snapshot);
    return answerCurrent(attempt.answer, attempt.responseMs, false, true);
  }, [answerCurrent, persist]);

  const closeSummary = useCallback(async () => {
    await persist({ ...snapshotRef.current, lastSummary: null });
  }, [persist]);

  const updateSettings = useCallback(
    async (partial: Partial<LearnerSettings>) => {
      const current = snapshotRef.current;
      await persist({
        ...current,
        settings: { ...current.settings, ...partial },
      });
    },
    [persist],
  );

  const resetProgress = useCallback(async () => {
    const current = snapshotRef.current;
    await persist({
      ...createInitialSnapshot(),
      onboardingComplete: current.onboardingComplete,
      settings: current.settings,
      cachedManifest: current.cachedManifest,
      sync: current.sync,
    });
  }, [persist]);

  const freshGuest = useCallback(async () => {
    await learningRepository.reset();
    const guestId = await syncService.startFreshGuest();
    const initial = createInitialSnapshot();
    initial.sync.guestId = guestId;
    initial.sync.cloudStatus = guestId ? 'synced' : 'unconfigured';
    await persist(initial);
    await refreshDiagnostics();
  }, [persist, refreshDiagnostics]);

  const seedReturningLearner = useCallback(async () => {
    const current = snapshotRef.current;
    const currentManifest = getPinnedManifest(current);
    const guestId = await syncService.startFreshGuest();
    const seeded: LearnerSnapshot = {
      ...createInitialSnapshot(),
      onboardingComplete: true,
      completedUnitIds: currentManifest.units.slice(0, 3).map((unit) => unit.id),
      settings: current.settings,
      cachedManifest: current.cachedManifest,
      sync: {
        cloudStatus: guestId ? 'synced' : 'unconfigured',
        guestId,
        acceptedCount: 0,
      },
    };
    const now = new Date();
    const seedItems = currentManifest.items.slice(0, 15);
    const sessionId = Crypto.randomUUID();
    const outbox: ReviewAttempt[] = [];
    seedItems.forEach((item: LearningItem, index) => {
      const key = learnerStateKey(item.id, 'kana_reading');
      const firstDate = new Date(now);
      if (index % 4 === 0) {
        firstDate.setDate(now.getDate() - 14);
      } else if (index % 4 === 1) {
        firstDate.setDate(now.getDate() - 2);
      } else if (index % 4 === 2) {
        firstDate.setDate(now.getDate() - 1);
      }
      const firstRating = index % 4 === 2 ? Rating.Again : Rating.Good;
      const firstClassification =
        firstRating === Rating.Good ? ('exact' as const) : ('incorrect' as const);
      let state = applyReview(
        undefined,
        item.id,
        'kana_reading',
        firstRating,
        firstDate,
      );
      outbox.push({
        eventId: Crypto.randomUUID(),
        sessionId,
        itemId: item.id,
        skillId: 'kana_reading',
        answer:
          firstRating === Rating.Good ? item.content.primaryAnswer : '',
        classification: firstClassification,
        rating: firstRating,
        responseMs: 700 + index * 11,
        exerciseVersion: 1,
        reviewedAt: firstDate.toISOString(),
        expectedStateVersion: 0,
      });
      if (index % 4 === 0) {
        const secondDate = new Date(now);
        secondDate.setDate(now.getDate() - 7);
        const secondExpectedVersion = state.version;
        state = applyReview(
          state,
          item.id,
          'kana_reading',
          Rating.Good,
          secondDate,
        );
        outbox.push({
          eventId: Crypto.randomUUID(),
          sessionId,
          itemId: item.id,
          skillId: 'kana_reading',
          answer: item.content.primaryAnswer,
          classification: 'exact',
          rating: Rating.Good,
          responseMs: 610 + index * 7,
          exerciseVersion: 1,
          reviewedAt: secondDate.toISOString(),
          expectedStateVersion: secondExpectedVersion,
        });
        const thirdExpectedVersion = state.version;
        state = applyReview(
          state,
          item.id,
          'kana_reading',
          Rating.Good,
          now,
        );
        outbox.push({
          eventId: Crypto.randomUUID(),
          sessionId,
          itemId: item.id,
          skillId: 'kana_reading',
          answer: item.content.primaryAnswer,
          classification: 'exact',
          rating: Rating.Good,
          responseMs: 540 + index * 5,
          exerciseVersion: 1,
          reviewedAt: now.toISOString(),
          expectedStateVersion: thirdExpectedVersion,
        });
      }
      seeded.skillStates[key] = state;
    });
    seeded.reviewOutbox = outbox.sort((left, right) =>
      left.reviewedAt.localeCompare(right.reviewedAt),
    );
    await persist(seeded);
    await syncNow();
  }, [persist, syncNow]);

  const value: AppContextValue = {
    ready,
    snapshot,
    manifest,
    activeSession,
    dueCount: due.length,
    nextUnitId: nextUnit?.id,
    repositoryDiagnostics,
    completeOnboarding,
    startContinue,
    startWeakSpots,
    startUnit,
    advanceIntroduction,
    answerCurrent,
    answerWriting,
    recordWritingPractice,
    undoLastMiss,
    closeSummary,
    updateSettings,
    resetProgress,
    freshGuest,
    seedReturningLearner,
    syncNow,
    refreshDiagnostics,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider.');
  }
  return context;
}
