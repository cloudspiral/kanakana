import {
  forwardRef,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Buttons';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { LearningItem, ModuleType, SessionOutcomes } from '@/domain/types';

interface IntroductionProps {
  item: LearningItem;
  heading: string;
  onContinue(): void;
}

export function KanaIntroductionRenderer({
  item,
  heading,
  onContinue,
}: IntroductionProps) {
  return (
    <View style={styles.renderer}>
      <AppText variant="eyebrow">New kana</AppText>
      <AppText variant="heading" style={styles.center}>
        {heading}
      </AppText>
      <Surface
        accessible
        accessibilityLabel={`${item.content.glyph}, ${item.content.primaryAnswer}`}
        style={styles.kanaCard}>
        <AppText style={styles.glyph}>{item.content.glyph}</AppText>
        <View style={styles.soundPill}>
          <AppText style={styles.sound}>{item.content.primaryAnswer}</AppText>
        </View>
      </Surface>
      <AppText color={Colors.inkMuted} style={styles.center}>
        Notice the shape, then connect it to its sound.
      </AppText>
      <Button label="I’ve got it" onPress={onContinue} />
    </View>
  );
}

interface ReadingProps {
  item: LearningItem;
  answer: string;
  prompt: string;
  disabled?: boolean;
  onAnswerChange(answer: string): void;
  onSubmit(): void;
  onReveal(): void;
}

export const KanaReadingInputRenderer = forwardRef<TextInput, ReadingProps>(
  function KanaReadingInputRenderer(
    {
      item,
      answer,
      prompt,
      disabled,
      onAnswerChange,
      onSubmit,
      onReveal,
    },
    ref,
  ) {
    return (
      <View style={styles.renderer}>
        <AppText variant="eyebrow">Recall</AppText>
        <AppText variant="heading" style={styles.center}>
          {prompt}
        </AppText>
        <Surface
          accessible
          accessibilityLabel={`Hiragana ${item.content.glyph}`}
          style={styles.questionCard}>
          <AppText style={styles.questionGlyph}>{item.content.glyph}</AppText>
        </Surface>
        <TextInput
          ref={ref}
          accessibilityLabel="Type the romaji"
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          blurOnSubmit={false}
          editable={!disabled}
          enterKeyHint="done"
          inputMode="text"
          onChangeText={onAnswerChange}
          onSubmitEditing={onSubmit}
          placeholder="Type the romaji"
          placeholderTextColor="#8A93A9"
          returnKeyType="done"
          selectTextOnFocus
          spellCheck={false}
          style={styles.input}
          value={answer}
        />
        <Button
          disabled={!answer.trim() || disabled}
          label="Check answer"
          onPress={onSubmit}
        />
        <Button
          disabled={disabled}
          label="Show answer"
          onPress={onReveal}
          variant="quiet"
        />
      </View>
    );
  },
);

interface SummaryProps {
  outcomes: SessionOutcomes;
  kind: 'lesson' | 'review';
  actions: ReactNode;
}

export function SessionSummaryRenderer({
  outcomes,
  kind,
  actions,
}: SummaryProps) {
  const introduced = uniqueCount(outcomes.introducedItemIds);
  const strengthened = uniqueCount(outcomes.strengthenedItemIds);
  const returning = uniqueCount(outcomes.againItemIds);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryMark}>
        <AppText style={styles.summaryMarkText}>✓</AppText>
      </View>
      <AppText variant="title" style={styles.center}>
        {kind === 'lesson' ? 'A new row is underway' : 'Reviews complete'}
      </AppText>
      <AppText color={Colors.inkMuted} style={styles.center}>
        Your next practice is already being scheduled from what you recalled
        today.
      </AppText>
      <View style={styles.outcomeList}>
        {introduced > 0 && (
          <Outcome
            color={Colors.blue}
            count={introduced}
            label="introduced"
          />
        )}
        <Outcome
          color={Colors.green}
          count={strengthened}
          label="strengthened"
        />
        {returning > 0 && (
          <Outcome
            color={Colors.pink}
            count={returning}
            label="returning soon"
          />
        )}
      </View>
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

function Outcome({
  color,
  count,
  label,
}: {
  color: string;
  count: number;
  label: string;
}) {
  return (
    <Surface style={styles.outcome}>
      <View style={[styles.outcomeDot, { backgroundColor: color }]} />
      <AppText variant="heading">{count}</AppText>
      <AppText variant="caption" style={styles.outcomeLabel}>
        {label}
      </AppText>
    </Surface>
  );
}

function uniqueCount(values: string[]) {
  return new Set(values).size;
}

export const moduleRendererRegistry: Record<
  'kana-introduction-v1' | 'kana-reading-input-v1' | 'session-summary-v1',
  React.ComponentType<any>
> = {
  'kana-introduction-v1': KanaIntroductionRenderer,
  'kana-reading-input-v1': KanaReadingInputRenderer,
  'session-summary-v1': SessionSummaryRenderer,
};

export function hasModuleRenderer(moduleType: ModuleType): boolean {
  return moduleType in moduleRendererRegistry;
}

const styles = StyleSheet.create({
  renderer: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
  kanaCard: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    minHeight: 300,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  glyph: {
    fontFamily: Fonts.japanese,
    fontSize: 128,
    lineHeight: 154,
  },
  soundPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.paleBlue,
  },
  sound: {
    color: Colors.blue,
    fontFamily: Fonts.headingSemi,
    fontSize: 22,
  },
  questionCard: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
    minHeight: 260,
    justifyContent: 'center',
  },
  questionGlyph: {
    fontFamily: Fonts.japanese,
    fontSize: 144,
    lineHeight: 170,
  },
  input: {
    minHeight: 60,
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    color: Colors.ink,
    fontFamily: Fonts.headingSemi,
    fontSize: 22,
    paddingHorizontal: Spacing.lg,
    textAlign: 'center',
  },
  summary: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  summaryMark: {
    width: 72,
    height: 72,
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    backgroundColor: Colors.greenPale,
  },
  summaryMarkText: {
    color: Colors.green,
    fontFamily: Fonts.heading,
    fontSize: 34,
  },
  outcomeList: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  outcome: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.md,
    gap: Spacing.xxs,
  },
  outcomeDot: {
    width: 9,
    height: 9,
    borderRadius: Radius.pill,
  },
  outcomeLabel: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
