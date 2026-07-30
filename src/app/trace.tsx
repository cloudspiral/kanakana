import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button, Pill } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TraceCanvas } from '@/components/TraceCanvas';
import { AppText } from '@/components/Typography';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { RESULTS, strokeNoteFor } from '@/domain/kanaContent';
import { useTrace } from '@/hooks/useTrace';

/** The design's reference square, scaled down on narrower screens. */
const REFERENCE_SQUARE = 262;

export default function TraceRoute() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ glyph?: string }>();
  const { width } = useWindowDimensions();

  const requested = typeof params.glyph === 'string' ? params.glyph : undefined;
  const fallback = app.manifest.items[0]?.content.glyph ?? 'あ';
  const glyph = requested ?? fallback;

  const trace = useTrace(glyph);

  // Every change of target character goes through load(), which owns the model
  // swap and all per-stroke resets. Do not bypass it.
  useEffect(() => {
    if (trace.glyph !== glyph) {
      trace.load(glyph);
    }
  }, [glyph, trace]);

  const item = app.manifest.items.find((candidate) => candidate.content.glyph === glyph);

  // Finishing a practice trace starts the writing schedule for this character.
  // No stakes: recordWritingPractice only ever seeds a schedule, never damages
  // one, so practising cannot cost the learner anything.
  const traceResult = trace.result;
  useEffect(() => {
    if (traceResult && item) {
      void app.recordWritingPractice(item.id);
    }
  }, [traceResult, item, app]);

  if (!app.ready) {
    return <LoadingScreen />;
  }

  const romaji = item?.content.primaryAnswer ?? '';
  const square = Math.min(
    REFERENCE_SQUARE,
    Math.min(width, MaxContentWidth) - Spacing.gutter * 2,
  );

  const { result } = trace;
  const verdict = result ? RESULTS[result.verdict] : null;
  const allDrawn = trace.done.length >= trace.strokeTotal && trace.strokeTotal > 0;
  const note = trace.note ?? (allDrawn ? 'All strokes drawn.' : strokeNoteFor(glyph));

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <AppText variant="kicker">Trace it</AppText>
        <AppText variant="meterLabel">
          {trace.ready
            ? `Stroke ${trace.strokeNumber} of ${trace.strokeTotal}`
            : 'Loading strokes…'}
        </AppText>
      </View>

      <GuideSquare
        size={square}
        guides={app.snapshot.settings.tracingGuideEnabled}
        chip={romaji ? { label: romaji, tone: 'ink' } : undefined}
        style={styles.square}
        overlay={
          <TraceCanvas
            trace={trace}
            size={square}
            ghost={app.snapshot.settings.tracingGuideEnabled}
          />
        }
      />

      {/* While a close call is pending the ordinary controls must not render.
          Three competing dark CTAs on screen at once let a tap grade a
          1-of-3-stroke attempt as clean. This gate is one of two guards; the
          other is the arithmetic in traceResult. */}
      {trace.awaitingCall ? (
        <View style={styles.callBlock}>
          <AppText variant="bodySmall" style={styles.callCopy}>
            Your stroke is in red over the dashed model. Too close for us to judge
            — you decide.
          </AppText>
          <View style={styles.callActions}>
            <Button
              label="Not good enough"
              variant="secondary"
              style={styles.callButton}
              onPress={() => trace.resolveCall(false)}
            />
            <Button
              label="Count it"
              style={styles.callButton}
              onPress={() => trace.resolveCall(true)}
            />
          </View>
        </View>
      ) : result ? (
        <View style={styles.resultBlock}>
          <AppText style={[styles.resultLabel, { color: verdict?.accent }]}>
            {verdict?.label}
          </AppText>
          <AppText variant="bodySmall">{verdict?.copy}</AppText>
          <View style={styles.meters}>
            <Meter label="Stroke accuracy" value={result.accuracy} />
            <Meter label="Order & direction" value={result.orderAndDirection} />
          </View>
          <Button label="Keep going" arrow onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <Pill label="Undo stroke" disabled={!trace.canUndo} onPress={trace.undo} />
            <Pill
              label="Show next stroke"
              active={trace.hint}
              onPress={trace.toggleHint}
            />
            <Pill label="Clear all" disabled={!trace.canUndo} onPress={trace.clear} />
          </View>

          {note ? (
            <AppText variant="bodySmall" style={styles.note}>
              {note}
            </AppText>
          ) : null}

          {trace.canUndo ? (
            <Button label="Done" arrow onPress={trace.finish} />
          ) : (
            <Button
              label="Skip drawing"
              variant="secondary"
              onPress={() => router.back()}
            />
          )}
        </>
      )}
    </AppScreen>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <AppText variant="meterLabel">{label}</AppText>
        <AppText style={styles.meterValue}>{percent}%</AppText>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  square: {
    alignSelf: 'center',
  },

  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  note: {
    textAlign: 'center',
    minHeight: 40,
  },

  callBlock: {
    gap: Spacing.sm,
  },
  callCopy: {
    textAlign: 'center',
  },
  callActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  callButton: {
    flex: 1,
  },

  resultBlock: {
    gap: Spacing.sm,
  },
  resultLabel: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
  },
  meters: {
    gap: Spacing.sm,
  },
  meter: {
    gap: 5,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  meterValue: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 22,
  },
  meterTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.wellFill,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
  },
});
