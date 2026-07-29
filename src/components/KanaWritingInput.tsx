import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Pill } from './Buttons';
import { GuideSquare } from './GuideSquare';
import { SoundBars } from './SoundBars';
import { TraceCanvas } from './TraceCanvas';
import { AppText } from './Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { RESULTS } from '@/domain/kanaContent';
import type { TraceResult } from '@/domain/strokes';
import type { LearningItem } from '@/domain/types';
import { useTrace } from '@/hooks/useTrace';

/** Verdicts we would call a pass. The learner can always disagree. */
const PASSING = new Set(['clean', 'loose', 'order']);

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
 * shape. The character is deliberately never shown — no ghost and no
 * next-stroke hint — because either would be the answer.
 *
 * The recogniser's verdict is a suggestion, not a ruling: the learner makes the
 * final call, with our reading pre-selected as the primary action.
 */
export function KanaWritingInput({
  item,
  square,
  canHear,
  onHear,
  onDecide,
}: KanaWritingInputProps) {
  const glyph = item.content.glyph;
  const trace = useTrace(glyph);

  useEffect(() => {
    if (trace.glyph !== glyph) {
      trace.load(glyph);
    }
  }, [glyph, trace]);

  const { result } = trace;
  const verdict = result ? RESULTS[result.verdict] : null;
  const pass = result ? suggestsPass(result) : false;

  return (
    <View style={styles.wrap}>
      <AppText variant="kicker" style={styles.center}>
        Write it
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
        overlay={
          <TraceCanvas trace={trace} size={square} ghost={false} hints={false} />
        }
      />

      {trace.awaitingCall ? (
        <View style={styles.block}>
          <AppText variant="bodySmall" style={styles.center}>
            That stroke is right on the line and we cannot call it. You decide.
          </AppText>
          <View style={styles.row}>
            <Button
              label="Not good enough"
              variant="secondary"
              style={styles.flex}
              onPress={() => trace.resolveCall(false)}
            />
            <Button
              label="Count it"
              style={styles.flex}
              onPress={() => trace.resolveCall(true)}
            />
          </View>
        </View>
      ) : result ? (
        <View style={styles.block}>
          <AppText style={[styles.verdict, { color: verdict?.accent }]}>
            {verdict?.label}
          </AppText>
          <AppText variant="bodySmall">
            {pass
              ? 'We would count that. Your call.'
              : 'We would bring this one back. Your call.'}
          </AppText>
          {/* Our reading is the primary action; disagreeing is one tap away. */}
          <View style={styles.row}>
            {pass ? (
              <>
                <Button label="Count it" style={styles.flex} onPress={() => onDecide(true)} />
                <Button
                  label="Not yet"
                  variant="secondary"
                  style={styles.flex}
                  onPress={() => onDecide(false)}
                />
              </>
            ) : (
              <>
                <Button
                  label="Bring it back"
                  style={styles.flex}
                  onPress={() => onDecide(false)}
                />
                <Button
                  label="I knew it"
                  variant="secondary"
                  style={styles.flex}
                  onPress={() => onDecide(true)}
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
          {trace.canUndo ? (
            <Button label="Done" arrow onPress={trace.finish} />
          ) : (
            <Button
              label="I can't remember it"
              variant="secondary"
              onPress={() => onDecide(false)}
            />
          )}
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
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  flex: {
    flex: 1,
  },
  verdict: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
  },
});

export const KANA_WRITING_RADIUS = Radius.rect;
