import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Pill } from './Buttons';
import { GradeMeters } from './GradeMeters';
import { GuideSquare } from './GuideSquare';
import { SoundBars } from './SoundBars';
import { TraceCanvas } from './TraceCanvas';
import { AppText } from './Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { TraceResult } from '@/domain/strokes';
import type { LearningItem } from '@/domain/types';
import { useTrace } from '@/hooks/useTrace';

/** Verdicts we would call a pass. The learner can always disagree. */
const PASSING = new Set(['clean', 'loose']);

export function suggestsPass(result: TraceResult): boolean {
  return PASSING.has(result.verdict);
}

interface KanaWritingInputProps {
  item: LearningItem;
  square: number;
  canHear: boolean;
  onHear(): void;
  /** Called once the learner settles on a verdict. */
  onDecide(correct: boolean): void;
}

/**
 * Review by writing: the learner is given the sound and has to produce the
 * shape. The character stays hidden while the learner is drawing. Once the
 * grader asks for a decision, the model appears behind their ink so the choice
 * is informed rather than a guess.
 *
 * The recogniser's verdict is a suggestion, not a ruling. A failing result
 * continues as a miss by default, with "Count it" available as the same kind
 * of explicit override as the reading review's typo action.
 */
export function KanaWritingInput({
  item,
  square,
  canHear,
  onHear,
  onDecide,
}: KanaWritingInputProps) {
  const glyph = item.content.glyph;
  const trace = useTrace(glyph, { mode: 'review' });

  useEffect(() => {
    if (trace.glyph !== glyph) {
      trace.load(glyph);
    }
  }, [glyph, trace]);

  const { result } = trace;
  const pass = result ? suggestsPass(result) : false;
  const decisionAccent = pass ? Colors.ink : Colors.accent;

  return (
    <View style={styles.wrap}>
      <AppText
        variant="kicker"
        color={result ? decisionAccent : undefined}
        style={styles.center}>
        {result ? (pass ? 'Yes' : 'Not yet') : 'Write it'}
      </AppText>

      <View style={styles.prompt}>
        <AppText style={styles.romaji}>{item.content.primaryAnswer}</AppText>
        {canHear ? (
          <Pill label="Hear it" icon={<SoundBars />} onPress={onHear} />
        ) : null}
      </View>

      <GuideSquare
        size={square}
        style={styles.center}
        borderColor={result ? decisionAccent : undefined}
        borderWidth={result ? 1.5 : undefined}
        overlay={
          <TraceCanvas
            trace={trace}
            size={square}
            ghost={Boolean(result)}
            hints={false}
          />
        }
      />

      {result ? (
        <View style={styles.block}>
          <GradeMeters result={result} />
          {/* The grader's reading is primary; disagreeing is one tap away. */}
          <View style={styles.row}>
            {pass ? (
              <>
                <Button
                  label="Don't count it"
                  variant="secondary"
                  style={styles.flex}
                  onPress={() => onDecide(false)}
                />
                <Button
                  label="Continue"
                  arrow
                  centerArrowLabel
                  style={styles.flex}
                  onPress={() => onDecide(true)}
                />
              </>
            ) : (
              <>
                <Button
                  label="Count it"
                  variant="secondary"
                  style={styles.flex}
                  onPress={() => onDecide(true)}
                />
                <Button
                  label="Continue"
                  arrow
                  centerArrowLabel
                  style={styles.flex}
                  onPress={() => onDecide(false)}
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <Pill label="Undo stroke" disabled={!trace.canUndo} onPress={trace.undo} />
            <Pill label="Clear all" disabled={!trace.canUndo} onPress={trace.clear} />
          </View>
          <AppText variant="bodySmall" style={styles.center}>
            {trace.note ?? 'Draw it from memory. Undo or clear as often as you like.'}
          </AppText>
          <View style={styles.actions}>
            <Button
              disabled={!trace.canUndo}
              label="Check"
              onPress={trace.finish}
            />
            <Button
              label="I can't remember it"
              variant="link"
              onPress={() => onDecide(false)}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  center: {
    alignSelf: 'center',
    textAlign: 'center',
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  romaji: {
    fontFamily: Fonts.serif,
    fontSize: 40,
    lineHeight: 44,
    color: Colors.ink,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  block: {
    gap: Spacing.sm,
  },
  actions: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  flex: {
    flex: 1,
  },
});

export const KANA_WRITING_RADIUS = Radius.rect;
