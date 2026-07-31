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
import { createReturningLearnerSeed } from '@/data/demoSeed';
import {
  BUNDLED_MANIFEST,
  getItem,
} from '@/domain/curriculum';
import {
  completeLessonDrawing,
  queuePracticeDrawing,
} from '@/domain/drawings';
import {
  classifyAnswer,
  isCorrectClassification,
  isNearMiss,
} from '@/domain/answers';
import {
  applyReview,
  dueTargets,
  localDayEndsAt,
} from '@/domain/scheduler';
import {
  buildLessonSession,
  buildReviewSession,
  currentStep,
  localDateKey,
  recordAttempt,
  type ReviewTarget,
  unique,
} from '@/domain/session';
import { mergeCompletedSync } from '@/domain/syncMerge';
import {
  learnerStateKey,
  type ActivePracticeSession,
  type AnswerClassification,
  type CurriculumManifest,
  type DrawingEvent,
  type LearnerSettings,
  type LearnerSnapshot,
  type RepositoryDiagnostics,
} from '@/domain/types';
import { syncService } from '@/services/sync';

interface AnswerResult {
  correct: boolean;
  classification: AnswerClassification;
  primaryAnswer: string;
  sessionComplete: boolean;
}

interface SyncSummary {
  pending: number;
  accepted: number;
}

interface AppContextValue {
  ready: boolean;
  snapshot: LearnerSnapshot;
  manifest: CurriculumManifest;
  activeSession: ActivePracticeSession | null;
  dueReviewTargets: ReviewTarget[];
  dueReviewCount: number;
  nextUnitId?: string;
  repositoryDiagnostics: RepositoryDiagnostics | null;
  completeOnboarding(): Promise<void>;
  startContinue(): Promise<'practice' | 'complete'>;
  startUnit(unitId: string): Promise<void>;
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
  /** Persist one completed trace without conflating practice and scheduling. */
  recordCompletedDrawing(
    event: DrawingEvent,
  ): Promise<{ sessionComplete: boolean }>;
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
  syncNow(): Promise<SyncSummary>;
  refreshDiagnostics(): Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function getPinnedManifest(snapshot: LearnerSnapshot): CurriculumManifest {
  if (
    snapshot.cachedManifest &&
    snapshot.cachedManifest.version >= BUNDLED_MANIFEST.version
  ) {
    return snapshot.cachedManifest;
  }
  return BUNDLED_MANIFEST;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState<LearnerSnapshot>(
    createInitialSnapshot,
  );
  const [reviewDay, setReviewDay] = useState(() => new Date());
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
  const syncInFlight = useRef<Promise<SyncSummary> | null>(null);

  const persist = useCallback(async (next: LearnerSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
    await learningRepository.saveSnapshot(next);
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    setRepositoryDiagnostics(await learningRepository.diagnostics());
  }, []);

  const syncNow = useCallback((): Promise<SyncSummary> => {
    if (syncInFlight.current) {
      return syncInFlight.current;
    }

    const operation = (async () => {
      const current = snapshotRef.current;
      const syncing = {
        ...current,
        sync: { ...current.sync, cloudStatus: 'syncing' as const },
      };
      snapshotRef.current = syncing;
      setSnapshot(syncing);
      const result = await syncService.sync(
        syncing,
        getPinnedManifest(syncing),
      );
      // The learner may have answered more prompts while the network request
      // was in flight. Merge into that newest snapshot instead of persisting
      // the stale copy that was originally sent to the server.
      const next = mergeCompletedSync(snapshotRef.current, result);
      await persist(next);
      const drawingsFullySynced = result.cloudStatus === 'synced';
      return {
        pending: next.reviewOutbox.length + next.drawingOutbox.length,
        accepted:
          result.acceptedCount +
          (drawingsFullySynced
            ? result.acceptedDrawingEventIds.length
            : 0),
      };
    })();

    syncInFlight.current = operation;
    void operation.then(
      () => {
        if (syncInFlight.current === operation) {
          syncInFlight.current = null;
        }
      },
      () => {
        if (syncInFlight.current === operation) {
          syncInFlight.current = null;
        }
      },
    );
    return operation;
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
      } else if (state === 'active') {
        setReviewDay(new Date());
      }
    });
    return () => subscription.remove();
  }, [syncNow]);

  useEffect(() => {
    const now = new Date();
    const delay = Math.max(
      1_000,
      localDayEndsAt(now).getTime() - now.getTime() + 50,
    );
    const timer = setTimeout(() => setReviewDay(new Date()), delay);
    return () => clearTimeout(timer);
  }, [reviewDay]);

  const manifest = useMemo(() => getPinnedManifest(snapshot), [snapshot]);
  const activeSession = snapshot.activeSession;
  const dueReviews = useMemo(
    () => dueTargets(manifest.items, snapshot.skillStates, reviewDay),
    [manifest.items, reviewDay, snapshot.skillStates],
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
      });
      void syncNow();
      return true;
    },
    [persist, syncNow],
  );

  /**
   * The two things every graded answer owes the learner, whichever skill was
   * asked: the feel of the verdict, and a chance to get the work off the device.
   */
  const afterAnswer = useCallback(
    (next: LearnerSnapshot, correct: boolean, sessionComplete: boolean) => {
      if (snapshotRef.current.settings.hapticsEnabled) {
        void Haptics.notificationAsync(
          correct
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
      }
      // A completed session syncs on its own; mid-session this keeps a long
      // queue from only ever draining at the end.
      if (
        !sessionComplete &&
        next.reviewOutbox.length > 0 &&
        next.reviewOutbox.length % 5 === 0
      ) {
        void syncNow();
      }
    },
    [syncNow],
  );

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
      const dayEndsAt = localDayEndsAt(reviewedAt);
      const stateKey = learnerStateKey(activeStep.itemId, activeStep.skillId);
      const previousState = current.skillStates[stateKey];
      const nextState = applyReview(
        previousState,
        activeStep.itemId,
        activeStep.skillId,
        rating,
        reviewedAt,
        dayEndsAt,
      );

      const nextSession = recordAttempt(
        session,
        activeStep,
        correct,
        reviewedAt,
      );

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
        dayEndsAt: dayEndsAt.toISOString(),
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
      afterAnswer(next, correct, sessionComplete);
      return {
        correct,
        classification,
        primaryAnswer: item.content.primaryAnswer,
        sessionComplete,
      };
    },
    [afterAnswer, finishIfComplete],
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
      const dayEndsAt = localDayEndsAt(reviewedAt);
      const stateKey = learnerStateKey(activeStep.itemId, activeStep.skillId);
      const previousState = current.skillStates[stateKey];
      const nextState = applyReview(
        previousState,
        activeStep.itemId,
        activeStep.skillId,
        rating,
        reviewedAt,
        dayEndsAt,
      );

      const nextSession = recordAttempt(
        session,
        activeStep,
        correct,
        reviewedAt,
      );

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
            dayEndsAt: dayEndsAt.toISOString(),
            expectedStateVersion: previousState?.version ?? 0,
          },
        ],
      };

      const sessionComplete = await finishIfComplete(nextSession, next);
      afterAnswer(next, correct, sessionComplete);
      return {
        correct,
        classification: correct ? 'exact' : 'incorrect',
        primaryAnswer: item.content.primaryAnswer,
        sessionComplete,
      };
    },
    [afterAnswer, finishIfComplete],
  );

  const recordCompletedDrawing = useCallback(
    async (event: DrawingEvent): Promise<{ sessionComplete: boolean }> => {
      const current = snapshotRef.current;

      if (event.source !== 'lesson') {
        await persist(queuePracticeDrawing(current, event));
        void syncNow();
        return { sessionComplete: false };
      }

      const completion = completeLessonDrawing(
        current,
        getPinnedManifest(current),
        event,
      );
      if (completion.duplicate) {
        return { sessionComplete: false };
      }
      const sessionComplete = await finishIfComplete(
        completion.session,
        completion.snapshot,
      );
      if (!sessionComplete) {
        void syncNow();
      }
      return { sessionComplete };
    },
    [finishIfComplete, persist, syncNow],
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
    const seeded = createReturningLearnerSeed({
      current,
      manifest: currentManifest,
      guestId,
      now: new Date(),
      createId: () => Crypto.randomUUID(),
    });
    await persist(seeded);
    await syncNow();
  }, [persist, syncNow]);

  const value: AppContextValue = {
    ready,
    snapshot,
    manifest,
    activeSession,
    dueReviewTargets: dueReviews,
    dueReviewCount: dueReviews.length,
    nextUnitId: nextUnit?.id,
    repositoryDiagnostics,
    completeOnboarding,
    startContinue,
    startUnit,
    answerCurrent,
    answerWriting,
    recordCompletedDrawing,
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
