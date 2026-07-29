import { forwardRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Pill } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { SoundBars } from '@/components/SoundBars';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { strokeNoteFor } from '@/domain/kanaContent';
import { strokeCount } from '@/domain/strokes';
import type { LearningItem, ModuleType, SessionOutcomes } from '@/domain/types';

/** The design's square. Screens scale it down on narrower devices. */
export const PRACTICE_SQUARE = 262;

interface IntroductionProps {
  item: LearningItem;
  heading: string;
  square: number;
  onContinue(): void;
  onHear?: () => void;
  canHear?: boolean;
}

/** Design screen 4 — Meet. */
export function KanaIntroductionRenderer({
  item,
  square,
  onContinue,
  onHear,
  canHear = false,
}: IntroductionProps) {
  const strokes = strokeCount(item.content.glyph);
  return (
    <View style={styles.renderer}>
      <AppText variant="kicker" style={styles.center}>
        New character
      </AppText>

      <GuideSquare
        size={square}
        style={styles.center}
        chip={{ label: item.content.primaryAnswer, tone: 'ink', corner: 'bottomRight' }}>
        <Kana size="hero" style={{ fontSize: square * 0.64, lineHeight: square * 0.64 }}>
          {item.content.glyph}
        </Kana>
      </GuideSquare>

      <View style={styles.pills}>
        {canHear ? (
          <Pill label="Hear it" icon={<SoundBars />} onPress={onHear} />
        ) : null}
        <View style={styles.strokePill}>
          <AppText style={styles.strokePillLabel}>
            {strokes === 1 ? '1 stroke' : `${strokes} strokes`}
          </AppText>
        </View>
      </View>

      <AppText variant="bodySmall" style={styles.note}>
        {strokeNoteFor(item.content.glyph, strokes)}
      </AppText>

      <Button label="Now draw it" arrow onPress={onContinue} />
    </View>
  );
}

interface ReadingProps {
  item: LearningItem;
  answer: string;
  prompt: string;
  square: number;
  disabled?: boolean;
  onAnswerChange(answer: string): void;
  onSubmit(): void;
  onReveal(): void;
  onHear?: () => void;
  canHear?: boolean;
}

/** Design screen 6 — Recall. */
export const KanaReadingInputRenderer = forwardRef<TextInput, ReadingProps>(
  function KanaReadingInputRenderer(
    {
      item,
      answer,
      prompt,
      square,
      disabled,
      onAnswerChange,
      onSubmit,
      onReveal,
      onHear,
      canHear = false,
    },
    ref,
  ) {
    const filled = answer.trim().length > 0;
    return (
      <View style={styles.renderer}>
        <AppText variant="meterLabel" style={styles.center}>
          {prompt}
        </AppText>

        <GuideSquare size={square} style={styles.center}>
          <Kana
            size="hero"
            style={{ fontSize: square * 0.64, lineHeight: square * 0.64 }}>
            {item.content.glyph}
          </Kana>
          {canHear ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Hear ${item.content.primaryAnswer}`}
              onPress={onHear}
              style={styles.hearCorner}>
              <SoundBars color={Colors.paper} />
              <AppText style={styles.hearCornerLabel}>Hear it</AppText>
            </Pressable>
          ) : null}
        </GuideSquare>

        <View style={styles.field}>
          <TextInput
            ref={ref}
            accessibilityLabel="Type the romaji"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect={false}
            editable={!disabled}
            enterKeyHint="done"
            inputMode="text"
            onChangeText={onAnswerChange}
            onSubmitEditing={onSubmit}
            placeholder="type the sound"
            placeholderTextColor={Colors.inkMuted}
            returnKeyType="done"
            spellCheck={false}
            style={[styles.input, filled ? styles.inputFilled : styles.inputEmpty]}
            value={answer}
          />
          <AppText style={styles.fieldHelp}>
            Romaji · shi, chi, tsu and fu accept either spelling
          </AppText>
        </View>

        <View style={styles.actions}>
          <Button
            disabled={!filled || disabled}
            label="Check"
            onPress={onSubmit}
          />
          <Button
            disabled={disabled}
            label="Show me the answer"
            onPress={onReveal}
            variant="link"
          />
        </View>
      </View>
    );
  },
);

interface SummaryProps {
  outcomes: SessionOutcomes;
  kind: 'lesson' | 'review';
  actions: ReactNode;
}

/** Design screen 8 — session summary. Only non-zero rows are listed. */
export function SessionSummaryRenderer({ outcomes, kind, actions }: SummaryProps) {
  const rows = [
    { label: 'introduced', count: uniqueCount(outcomes.introducedItemIds) },
    { label: 'strengthened', count: uniqueCount(outcomes.strengthenedItemIds) },
    { label: 'returning soon', count: uniqueCount(outcomes.againItemIds) },
  ].filter((row) => row.count > 0);

  return (
    <View style={styles.summary}>
      <View style={styles.summaryTile}>
        <AppText style={styles.summaryTick}>✓</AppText>
      </View>
      <AppText style={styles.summaryTitle}>
        {kind === 'lesson' ? 'A new row is underway' : 'Reviews done'}
      </AppText>
      <AppText variant="bodySmall">
        Your next practice is already being scheduled from what you recalled
        today.
      </AppText>

      {rows.length > 0 ? (
        <View style={styles.outcomeCard}>
          {rows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.outcomeRow, index > 0 && styles.outcomeRowDivided]}>
              <AppText style={styles.outcomeCount}>{row.count}</AppText>
              <AppText variant="bodySmall">{row.label}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.summaryActions}>{actions}</View>
    </View>
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
  },
  center: {
    alignSelf: 'center',
    textAlign: 'center',
  },
  pills: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  strokePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    backgroundColor: Colors.wellFill,
  },
  strokePillLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: 10,
  },

  hearCorner: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: Colors.ink,
  },
  hearCornerLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: Colors.paper,
  },

  field: {
    gap: Spacing.xs,
  },
  input: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    lineHeight: 36,
    color: Colors.ink,
    paddingBottom: 9,
    paddingTop: 0,
    borderBottomWidth: 2,
  },
  inputEmpty: {
    borderBottomColor: Colors.fieldRule,
  },
  inputFilled: {
    borderBottomColor: Colors.ink,
  },
  fieldHelp: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
  },
  actions: {
    gap: 10,
  },

  summary: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  summaryTile: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  summaryTick: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    color: Colors.ink,
  },
  summaryTitle: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 38,
    color: Colors.ink,
  },
  outcomeCard: {
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    paddingHorizontal: Spacing.card,
    paddingVertical: 14,
  },
  outcomeRowDivided: {
    borderTopWidth: 1,
    borderTopColor: Colors.ruleSoft,
  },
  outcomeCount: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 28,
    color: Colors.ink,
    minWidth: 28,
  },
  summaryActions: {
    gap: 10,
    marginTop: Spacing.xs,
  },
});
