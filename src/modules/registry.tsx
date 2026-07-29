import { forwardRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Button, Pill } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { SoundBars } from '@/components/SoundBars';
import { StrokeOrderDiagram } from '@/components/StrokeOrderDiagram';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { strokeNoteFor } from '@/domain/kanaContent';
import { strokeCount } from '@/domain/strokes';
import type { LearningItem, ModuleType, SessionOutcomes } from '@/domain/types';
import type { TextStyle } from 'react-native';

/**
 * The field is a serif line on a rule, so the browser's default focus ring
 * boxes it and fights the design. Native has no equivalent, hence web only.
 */
const NO_WEB_OUTLINE =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none' } as unknown as TextStyle)
    : null;

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

/** Design screen 4 — Meet. See it, hear it, then see the order it is built in. */
export function KanaIntroductionRenderer({
  item,
  square,
  onContinue,
  onHear,
  canHear = false,
}: IntroductionProps) {
  const glyph = item.content.glyph;
  const strokes = strokeCount(glyph);
  const [showOrder, setShowOrder] = useState(false);

  return (
    <View style={styles.renderer}>
      <AppText variant="kicker" style={styles.center}>
        New kana
      </AppText>

      <GuideSquare
        size={square}
        style={styles.center}
        chip={{ label: item.content.primaryAnswer, tone: 'ink', corner: 'bottomRight' }}>
        {showOrder ? (
          <StrokeOrderDiagram glyph={glyph} size={square} />
        ) : (
          <Kana size="hero" style={{ fontSize: square * 0.64, lineHeight: square * 0.64 }}>
            {glyph}
          </Kana>
        )}
      </GuideSquare>

      <View style={styles.pills}>
        {canHear ? (
          <Pill label="Hear it" icon={<SoundBars />} onPress={onHear} />
        ) : null}
        <Pill
          label={strokes === 1 ? '1 stroke' : `${strokes} strokes`}
          active={showOrder}
          onPress={() => setShowOrder((current) => !current)}
        />
      </View>

      <AppText variant="bodySmall" style={styles.note}>
        {showOrder
          ? 'Each number marks where that stroke begins.'
          : strokeNoteFor(glyph, strokes)}
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
    },
    ref,
  ) {
    const filled = answer.trim().length > 0;
    return (
      <View style={styles.renderer}>
        <AppText variant="meterLabel" style={styles.center}>
          {prompt}
        </AppText>

        {/* Deliberately no "Hear it" here: the sound IS the answer, so offering
            it before the learner commits is just a slower Show me the answer.
            It appears on the feedback screen instead. */}
        <GuideSquare size={square} style={styles.center}>
          <Kana
            size="hero"
            style={{ fontSize: square * 0.64, lineHeight: square * 0.64 }}>
            {item.content.glyph}
          </Kana>
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
            style={[
              styles.input,
              filled ? styles.inputFilled : styles.inputEmpty,
              NO_WEB_OUTLINE,
            ]}
            value={answer}
          />
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
