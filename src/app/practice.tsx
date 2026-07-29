import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { getItem } from '@/domain/curriculum';
import { currentStep } from '@/domain/session';
import type { AnswerClassification, LearningItem } from '@/domain/types';
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
  sessionComplete: boolean;
  revealed: boolean;
  responseMs: number;
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
  const { width } = useWindowDimensions();

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

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );
    return () => subscription.remove();
  }, []);

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
    if (submitting || (!revealed && !answer.trim()) || !item) {
      return;
    }
    setSubmitting(true);
    try {
      const responseMs = Math.max(
        0,
        Date.now() - (questionStartedAt.current ?? Date.now()),
      );
      const result = await app.answerCurrent(answer, responseMs, revealed);
      const nextFeedback: Feedback = { ...result, item, revealed, responseMs };
      setFeedback(nextFeedback);
      // A correct answer needs no decision, so it clears itself. A miss waits —
      // it carries the "draw it once" offer.
      if (result.correct) {
        setTimeout(() => advanceAfterFeedback(nextFeedback), reducedMotion ? 0 : 900);
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Meet → Trace → Recall. The introduction is marked seen before the detour so
   * that returning from the drawing lands on the next step rather than back on
   * the character just met.
   */
  async function meetThenDraw() {
    if (!item) {
      return;
    }
    const glyph = item.content.glyph;
    const complete = await app.advanceIntroduction();
    if (complete) {
      router.replace('/summary');
      return;
    }
    router.push({ pathname: '/trace', params: { glyph } });
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

      {step.kind === 'introduction' ? (
        <KanaIntroductionRenderer
          heading={
            typeof module?.content.heading === 'string'
              ? module.content.heading
              : 'Meet this kana'
          }
          item={item}
          square={square}
          onContinue={() => void meetThenDraw()}
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
          onContinue={() => advanceAfterFeedback()}
          onDraw={() => {
            const glyph = feedback.item.content.glyph;
            advanceAfterFeedback();
            router.push({ pathname: '/trace', params: { glyph } });
          }}
        />
      ) : null}
    </AppScreen>
  );
}

/** Design screen 7 — full-bleed feedback. */
function FeedbackOverlay({
  feedback,
  square,
  onContinue,
  onDraw,
}: {
  feedback: Feedback;
  square: number;
  onContinue(): void;
  onDraw(): void;
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

      <AppText variant="bodySmall" style={styles.overlayCopy}>
        {feedback.correct
          ? feedback.classification === 'accepted_alias'
            ? 'That spelling works — we show the standard Hepburn form.'
            : 'That link just got a little stronger.'
          : 'No harm done — it comes back in a few prompts.'}
      </AppText>

      {feedback.correct && feedback.responseMs > 0 ? (
        <AppText style={styles.overlaySpeed}>
          read in {(feedback.responseMs / 1000).toFixed(1)}s
        </AppText>
      ) : null}

      {!feedback.correct ? (
        <View style={styles.overlayActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onDraw}
            style={styles.drawRow}>
            <AppText variant="button">Draw it once to fix the shape</AppText>
            <AppText style={styles.drawArrow} aria-hidden>
              →
            </AppText>
          </Pressable>
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
  drawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  drawArrow: {
    fontSize: 17,
    lineHeight: 21,
    color: Colors.accent,
  },
});
