import { useFocusEffect, useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { Button, Pill } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { KanaWritingInput } from '@/components/KanaWritingInput';
import { SoundBars } from '@/components/SoundBars';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { getItem } from '@/domain/curriculum';
import { isNearMiss } from '@/domain/answers';
import { currentStep } from '@/domain/session';
import { isKanaAudioAvailable, playKana, preloadKana } from '@/services/audio';
import type { AnswerClassification, LearningItem, SkillId } from '@/domain/types';
import {
  KanaIntroductionRenderer,
  KanaReadingInputRenderer,
  PRACTICE_SQUARE,
} from '@/modules/registry';

interface Feedback {
  correct: boolean;
  classification: AnswerClassification;
  primaryAnswer: string;
  item: LearningItem;
  /** Which skill was graded — the overlay reports a drawing differently. */
  skillId: SkillId;
  sessionComplete: boolean;
  revealed: boolean;
  responseMs: number;
  answer: string;
}

export default function PracticeRoute() {
  const app = useApp();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const questionStartedAt = useRef<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  /**
   * The character to keep showing while the drawing screen slides in.
   *
   * Completing the trace advances the active step while this route is still
   * underneath the closing trace screen. Holding the outgoing view keeps that
   * transition still until the detour is fully dismissed.
   */
  const [heldItem, setHeldItem] = useState<LearningItem | null>(null);
  /**
   * The pending auto-advance off a correct answer. Held so that closing practice
   * inside the feedback beat cannot fire a navigation onto a screen the learner
   * has already left.
   */
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width } = useWindowDimensions();
  const soundOn = app.snapshot.settings.soundEnabled;

  const session = app.activeSession;
  const step = currentStep(session);
  const item = step ? getItem(app.manifest, step.itemId) : null;
  const module = useMemo(
    () =>
      app.manifest.units
        .flatMap((unit) => unit.modules)
        .find((candidate) => candidate.id === step?.moduleId),
    [app.manifest.units, step?.moduleId],
  );

  useEffect(
    () => () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);

  // Warm the clips for the rest of the session so the first tap has no delay.
  // The ref keeps this to once per session: `session` itself changes on every
  // answer, and re-preloading the same glyphs each time would be wasteful.
  const preloadedSession = useRef<string | null>(null);
  useEffect(() => {
    if (!session || preloadedSession.current === session.id) {
      return;
    }
    preloadedSession.current = session.id;
    const glyphs = session.steps
      .map((sessionStep) => getItem(app.manifest, sessionStep.itemId).content.glyph)
      .filter((glyph, index, all) => all.indexOf(glyph) === index);
    void preloadKana(glyphs);
  }, [app.manifest, session]);

  // Back from the drawing detour and fully visible again — release the held
  // view. Doing it on focus rather than on navigation means the swap happens
  // after the trace screen has finished dismissing, not during it.
  useFocusEffect(
    useCallback(() => {
      setHeldItem(null);
    }, []),
  );

  useEffect(() => {
    if (step?.kind === 'assessment' && !feedback) {
      questionStartedAt.current = Date.now();
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [step?.id, step?.kind, feedback]);

  if (!app.ready) {
    return <LoadingScreen />;
  }

  if (!session || !step || !item) {
    return (
      <AppScreen scroll={false} contentStyle={styles.centered}>
        <AppText variant="sectionTitle">This practice is complete.</AppText>
        <Button label="See summary" arrow onPress={() => router.replace('/summary')} />
      </AppScreen>
    );
  }

  const square = Math.min(
    PRACTICE_SQUARE,
    Math.min(width, MaxContentWidth) - Spacing.gutter * 2,
  );

  async function submit(revealed = false) {
    if (submitting || (!revealed && !answer.trim()) || !item || !step) {
      return;
    }
    setSubmitting(true);
    try {
      const responseMs = Math.max(
        0,
        Date.now() - (questionStartedAt.current ?? Date.now()),
      );
      const result = await app.answerCurrent(answer, responseMs, revealed);
      const nextFeedback: Feedback = {
        ...result,
        item,
        skillId: step.skillId,
        revealed,
        responseMs,
        answer,
      };
      setFeedback(nextFeedback);
      // A correct answer needs no decision, so it clears itself. A miss waits —
      // it carries the "draw it once" offer.
      if (result.correct) {
        advanceTimer.current = setTimeout(
          () => advanceAfterFeedback(nextFeedback),
          reducedMotion ? 0 : 900,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Meet → Trace → Recall. The introduction stays active until the trace route
   * records a completed drawing, so backing out cannot silently skip it.
   */
  async function meetThenDraw() {
    if (!item || !step || !app.activeSession) {
      return;
    }
    const glyph = item.content.glyph;
    setHeldItem(item);
    router.push({
      pathname: '/trace',
      params: {
        glyph,
        source: 'lesson',
        eventId: step.id,
        sessionId: app.activeSession.id,
      },
    });
  }

  /** A writing prompt is graded from strokes plus the learner's own call. */
  async function submitWriting(correct: boolean) {
    if (submitting || !item || !step) {
      return;
    }
    setSubmitting(true);
    try {
      const responseMs = Math.max(
        0,
        Date.now() - (questionStartedAt.current ?? Date.now()),
      );
      const result = await app.answerWriting(correct, responseMs);
      const nextFeedback: Feedback = {
        ...result,
        item,
        skillId: step.skillId,
        revealed: false,
        responseMs,
        answer: '',
      };
      setFeedback(nextFeedback);
      if (result.correct) {
        advanceTimer.current = setTimeout(
          () => advanceAfterFeedback(nextFeedback),
          reducedMotion ? 0 : 900,
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  /** "I typed it wrong — I knew this." Reverts the miss exactly. */
  async function undoTypo() {
    const result = await app.undoLastMiss();
    setFeedback(null);
    setAnswer('');
    questionStartedAt.current = Date.now();
    if (result?.sessionComplete) {
      router.replace('/summary');
    }
  }

  function advanceAfterFeedback(currentFeedback = feedback) {
    if (!currentFeedback) {
      return;
    }
    setFeedback(null);
    setAnswer('');
    questionStartedAt.current = Date.now();
    if (currentFeedback.sessionComplete) {
      router.replace('/summary');
    }
  }

  return (
    <AppScreen keyboardAvoiding scroll={false} contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Leave practice"
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={styles.close}>
          <AppText style={styles.closeMark}>×</AppText>
        </Pressable>
        {/* One segment per session step: past ink, current accent, future pale. */}
        <View
          accessibilityLabel={`Step ${session.currentIndex + 1} of ${session.steps.length}`}
          accessibilityRole="progressbar"
          style={styles.ticks}>
          {session.steps.map((sessionStep, index) => (
            <View
              key={sessionStep.id}
              style={[
                styles.tick,
                index < session.currentIndex
                  ? styles.tickPast
                  : index === session.currentIndex
                    ? styles.tickCurrent
                    : styles.tickFuture,
              ]}
            />
          ))}
        </View>
      </View>

      {heldItem ? (
        // Frozen copy of the character just met. Interaction is disabled: the
        // drawing screen owns the interaction until it is dismissed.
        <KanaIntroductionRenderer
          heading=""
          item={heldItem}
          square={square}
          canHear={false}
          onContinue={() => {}}
        />
      ) : step.kind === 'introduction' ? (
        <KanaIntroductionRenderer
          heading={
            typeof module?.content.heading === 'string'
              ? module.content.heading
              : 'Meet this kana'
          }
          item={item}
          square={square}
          canHear={soundOn && isKanaAudioAvailable(item.content.glyph)}
          onHear={() => void playKana(item.content.glyph)}
          onContinue={() => void meetThenDraw()}
        />
      ) : step.moduleType === 'kana-writing-input-v1' ? (
        <KanaWritingInput
          key={step.id}
          item={item}
          square={square}
          canHear={soundOn && isKanaAudioAvailable(item.content.glyph)}
          onHear={() => void playKana(item.content.glyph)}
          onDecide={(correct) => void submitWriting(correct)}
        />
      ) : (
        <KanaReadingInputRenderer
          ref={inputRef}
          answer={answer}
          disabled={submitting}
          item={item}
          square={square}
          onAnswerChange={setAnswer}
          onReveal={() => void submit(true)}
          onSubmit={() => void submit(false)}
          prompt={
            step.isRecheck
              ? 'One more time'
              : typeof module?.content.prompt === 'string'
                ? module.content.prompt
                : 'What sound is this?'
          }
        />
      )}

      {feedback ? (
        <FeedbackOverlay
          feedback={feedback}
          square={square}
          canHear={soundOn && isKanaAudioAvailable(feedback.item.content.glyph)}
          onHear={() => void playKana(feedback.item.content.glyph)}
          canUndoTypo={
            !feedback.correct &&
            !feedback.revealed &&
            isNearMiss(feedback.item, feedback.answer)
          }
          onUndoTypo={() => void undoTypo()}
          onContinue={() => advanceAfterFeedback()}
        />
      ) : null}
    </AppScreen>
  );
}

/** Design screen 7 — full-bleed feedback. */
function FeedbackOverlay({
  feedback,
  square,
  canHear,
  onHear,
  canUndoTypo,
  onUndoTypo,
  onContinue,
}: {
  feedback: Feedback;
  square: number;
  canHear: boolean;
  onHear(): void;
  canUndoTypo: boolean;
  onUndoTypo(): void;
  onContinue(): void;
}) {
  const accent = feedback.correct ? Colors.ink : Colors.accent;
  const kicker = feedback.correct ? 'Yes' : feedback.revealed ? 'Here it is' : 'Not yet';
  return (
    <View style={styles.overlay}>
      <AppText variant="kicker" color={accent} style={styles.overlayKicker}>
        {kicker}
      </AppText>

      <GuideSquare
        size={square}
        guides={false}
        borderColor={accent}
        borderWidth={1.5}
        style={styles.overlaySquare}>
        <Kana style={{ fontFamily: Fonts.kanaThin, fontSize: square * 0.57, lineHeight: square * 0.62 }}>
          {feedback.item.content.glyph}
        </Kana>
        <AppText style={[styles.overlayRomaji, { color: accent }]}>
          {feedback.primaryAnswer}
        </AppText>
      </GuideSquare>

      {canHear ? (
        <Pill
          label="Hear it"
          icon={<SoundBars />}
          onPress={onHear}
          style={styles.overlayHear}
        />
      ) : null}

      <AppText variant="bodySmall" style={styles.overlayCopy}>
        {feedback.correct
          ? feedback.classification === 'accepted_alias'
            ? 'That spelling works — we show the standard Hepburn form.'
            : 'That link just got a little stronger.'
          : 'No harm done — it comes back in a few prompts.'}
      </AppText>

      {feedback.correct && feedback.responseMs > 0 ? (
        <AppText style={styles.overlaySpeed}>
          {feedback.skillId === 'kana_writing' ? 'drawn' : 'read'} in{' '}
          {(feedback.responseMs / 1000).toFixed(1)}s
        </AppText>
      ) : null}

      {/* No "draw it to fix the shape" here. Drawing is assessed by its own
          review prompt, and the tracing surface is reached by meeting a
          character or by choosing to practise one — not as a detour out of a
          reading miss. */}
      {!feedback.correct ? (
        <View style={styles.overlayActions}>
          {canUndoTypo ? (
            <Pressable
              accessibilityRole="button"
              onPress={onUndoTypo}
              style={styles.typoRow}>
              <AppText style={styles.typoLabel}>
                I typed it wrong — I knew this
              </AppText>
              <AppText style={styles.typoLabel} aria-hidden>
                ↺
              </AppText>
            </Pressable>
          ) : null}
          <Button label="Keep going" variant="link" onPress={onContinue} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.gutter,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 44,
  },
  close: {
    width: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  closeMark: {
    fontSize: 26,
    lineHeight: 30,
    color: Colors.inkMuted,
  },
  ticks: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  tick: {
    flex: 1,
    height: 3,
  },
  tickPast: { backgroundColor: Colors.ink },
  tickCurrent: { backgroundColor: Colors.accent },
  tickFuture: { backgroundColor: Colors.segmentFuture },

  overlay: {
    // Absolute children position from the border box, so the screen gutter does
    // not apply here — the overlay carries its own.
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.paper,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
    gap: Spacing.lg,
  },
  overlayKicker: {
    textAlign: 'center',
  },
  overlaySquare: {
    alignSelf: 'center',
    gap: 6,
  },
  overlayRomaji: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 34,
  },
  overlayHear: {
    alignSelf: 'center',
  },
  overlayCopy: {
    textAlign: 'center',
    paddingHorizontal: Spacing.xs,
  },
  overlaySpeed: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.7,
    color: Colors.inkMuted,
    marginTop: -Spacing.sm,
  },
  overlayActions: {
    gap: 10,
  },
  typoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: Colors.fieldBorder,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  typoLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.inkMuted,
  },
});
