import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { getItem } from '@/domain/curriculum';
import { currentStep, sessionProgress } from '@/domain/session';
import type { AnswerClassification, LearningItem } from '@/domain/types';
import {
  KanaIntroductionRenderer,
  KanaReadingInputRenderer,
} from '@/modules/registry';

interface Feedback {
  correct: boolean;
  classification: AnswerClassification;
  primaryAnswer: string;
  item: LearningItem;
  sessionComplete: boolean;
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
        <AppText variant="heading">This practice is complete.</AppText>
        <Button
          label="See summary"
          onPress={() => router.replace('/summary')}
        />
      </AppScreen>
    );
  }

  async function submit(revealed = false) {
    if (submitting || (!revealed && !answer.trim()) || !item) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await app.answerCurrent(
        answer,
        Math.max(0, Date.now() - (questionStartedAt.current ?? Date.now())),
        revealed,
      );
      const nextFeedback: Feedback = { ...result, item };
      setFeedback(nextFeedback);
      if (result.correct) {
        setTimeout(() => advanceAfterFeedback(nextFeedback), reducedMotion ? 0 : 650);
      }
    } finally {
      setSubmitting(false);
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

  async function advanceIntroduction() {
    const complete = await app.advanceIntroduction();
    if (complete) {
      router.replace('/summary');
    }
  }

  const progress = sessionProgress(session);

  return (
    <AppScreen
      keyboardAvoiding
      scroll={false}
      contentStyle={styles.practiceContent}>
      <View style={styles.practiceHeader}>
        <Pressable
          accessibilityLabel="Leave practice"
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={styles.close}>
          <AppText style={styles.closeText}>×</AppText>
        </Pressable>
        <View
          accessibilityLabel={`${Math.round(progress * 100)} percent complete`}
          accessibilityRole="progressbar"
          style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <AppText variant="caption">
          {Math.min(session.currentIndex + 1, session.steps.length)}/
          {session.steps.length}
        </AppText>
      </View>

      {feedback ? (
        <FeedbackView
          feedback={feedback}
          onContinue={() => advanceAfterFeedback()}
        />
      ) : step.kind === 'introduction' ? (
        <KanaIntroductionRenderer
          heading={
            typeof module?.content.heading === 'string'
              ? module.content.heading
              : 'Meet this kana'
          }
          item={item}
          onContinue={advanceIntroduction}
        />
      ) : (
        <KanaReadingInputRenderer
          ref={inputRef}
          answer={answer}
          disabled={submitting}
          item={item}
          onAnswerChange={setAnswer}
          onReveal={() => void submit(true)}
          onSubmit={() => void submit(false)}
          prompt={
            step.isRecheck
              ? 'One more time—what sound is this?'
              : typeof module?.content.prompt === 'string'
                ? module.content.prompt
                : 'What sound does this make?'
          }
        />
      )}
    </AppScreen>
  );
}

function FeedbackView({
  feedback,
  onContinue,
}: {
  feedback: Feedback;
  onContinue(): void;
}) {
  return (
    <View style={styles.feedback}>
      <AppText
        variant="eyebrow"
        color={feedback.correct ? Colors.ink : Colors.accent}>
        {feedback.correct ? 'Correct' : 'Let’s bring this back'}
      </AppText>
      <Surface
        accessibilityLabel={`${feedback.item.content.glyph} is ${feedback.primaryAnswer}`}
        style={[
          styles.feedbackCard,
          feedback.correct ? styles.correctCard : styles.againCard,
        ]}>
        <AppText style={styles.feedbackGlyph}>
          {feedback.item.content.glyph}
        </AppText>
        <AppText variant="title" color={feedback.correct ? Colors.ink : Colors.accent}>
          {feedback.primaryAnswer}
        </AppText>
      </Surface>
      <AppText color={Colors.inkMuted} style={styles.feedbackCopy}>
        {feedback.correct
          ? feedback.classification === 'accepted_alias'
            ? 'That spelling works. We’ll display the standard Hepburn form.'
            : 'That connection just got a little stronger.'
          : 'You’ll see it again after a few other prompts.'}
      </AppText>
      {!feedback.correct && (
        <Button label="Continue" onPress={onContinue} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  practiceContent: {
    paddingBottom: Spacing.lg,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.rule,
  },
  closeText: {
    color: Colors.inkMuted,
    fontSize: 28,
    lineHeight: 31,
  },
  progressTrack: {
    flex: 1,
    height: 9,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Colors.rule,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
  },
  feedback: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  feedbackCard: {
    minHeight: 310,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  correctCard: {
    backgroundColor: Colors.wellFill,
    borderColor: '#B9E5D6',
  },
  againCard: {
    backgroundColor: Colors.accentSoft,
    borderColor: '#F4CBD5',
  },
  feedbackGlyph: {
    fontFamily: Fonts.kanaLight,
    fontSize: 132,
    lineHeight: 158,
  },
  feedbackCopy: {
    textAlign: 'center',
  },
});
