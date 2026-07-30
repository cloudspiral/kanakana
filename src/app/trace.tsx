import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button, Pill } from '@/components/Buttons';
import { GradeMeters } from '@/components/GradeMeters';
import { GuideSquare } from '@/components/GuideSquare';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TraceCanvas } from '@/components/TraceCanvas';
import { AppText } from '@/components/Typography';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { RESULTS, strokeNoteFor } from '@/domain/kanaContent';
import { useTrace } from '@/hooks/useTrace';

/** The design's reference square, scaled down on narrower screens. */
const REFERENCE_SQUARE = 262;

export default function TraceRoute() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{
    glyph?: string;
    source?: string;
    eventId?: string;
    sessionId?: string;
  }>();
  const { width } = useWindowDimensions();

  const requested = typeof params.glyph === 'string' ? params.glyph : undefined;
  const fallback = app.manifest.items[0]?.content.glyph ?? 'あ';
  const glyph = requested ?? fallback;
  const source = params.source === 'lesson' ? 'lesson' : 'practice';
  const fallbackEventId = useRef(Crypto.randomUUID()).current;
  const fallbackSessionId = useRef(Crypto.randomUUID()).current;
  const eventId =
    typeof params.eventId === 'string' ? params.eventId : fallbackEventId;
  const sessionId =
    typeof params.sessionId === 'string'
      ? params.sessionId
      : fallbackSessionId;
  const recorded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lessonSessionComplete, setLessonSessionComplete] = useState(false);

  const trace = useTrace(glyph);

  // Every change of target character goes through load(), which owns the model
  // swap and all per-stroke resets. Do not bypass it.
  useEffect(() => {
    if (trace.glyph !== glyph) {
      trace.load(glyph);
    }
  }, [glyph, trace]);

  const item = app.manifest.items.find((candidate) => candidate.content.glyph === glyph);

  // A full lesson trace owns introduction advancement and seeds writing once.
  // A profile trace only records practice; it never carries FSRS evidence.
  const traceResult = trace.result;
  useEffect(() => {
    if (!traceResult?.complete || !item || recorded.current) {
      return;
    }
    recorded.current = true;
    setSaving(true);
    setSaveError(null);
    void app
      .recordCompletedDrawing({
        eventId,
        itemId: item.id,
        source,
        sessionId,
        occurredAt: new Date().toISOString(),
      })
      .then(({ sessionComplete }) => {
        setLessonSessionComplete(sessionComplete);
      })
      .catch((error: unknown) => {
        recorded.current = false;
        setSaveError(
          error instanceof Error ? error.message : 'Could not save this drawing.',
        );
      })
      .finally(() => setSaving(false));
  }, [app, eventId, item, sessionId, source, traceResult]);

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
  const expectedCountReached =
    trace.done.length >= trace.strokeTotal && trace.strokeTotal > 0;
  const strokeStatus =
    trace.done.length < trace.strokeTotal
      ? `Stroke ${trace.done.length + 1} of ${trace.strokeTotal}`
      : `${trace.done.length} drawn · ${trace.strokeTotal} in guide`;
  const note =
    trace.note ??
    (expectedCountReached
      ? 'Keep drawing if you need to, or submit when you are ready.'
      : strokeNoteFor(glyph));

  return (
    <AppScreen scroll={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <AppText variant="kicker">Trace it</AppText>
        <AppText variant="meterLabel">
          {trace.ready
            ? strokeStatus
            : 'Loading strokes…'}
        </AppText>
      </View>

      <GuideSquare
        size={square}
        chip={romaji ? { label: romaji, tone: 'ink' } : undefined}
        style={styles.square}
        overlay={
          <TraceCanvas trace={trace} size={square} />
        }
      />

      {result ? (
        <View style={styles.resultBlock}>
          <AppText style={[styles.resultLabel, { color: verdict?.accent }]}>
            {verdict?.label}
          </AppText>
          <AppText variant="bodySmall">{verdict?.copy}</AppText>
          <GradeMeters result={result} />
          {saveError ? (
            <AppText variant="bodySmall" style={styles.saveError}>
              {saveError}
            </AppText>
          ) : null}
          {source === 'lesson' && !result.complete ? (
            <Button label="Finish every stroke" onPress={trace.clear} />
          ) : (
            <Button
              label="Keep going"
              arrow
              loading={saving}
              disabled={source === 'lesson' && !recorded.current}
              onPress={() =>
                lessonSessionComplete
                  ? router.replace('/summary')
                  : router.back()
              }
            />
          )}
        </View>
      ) : (
        <>
          <View style={styles.controls}>
            <Pill label="Undo stroke" disabled={!trace.canUndo} onPress={trace.undo} />
            <Pill label="Clear all" disabled={!trace.canUndo} onPress={trace.clear} />
          </View>

          {note ? (
            <AppText variant="bodySmall" style={styles.note}>
              {note}
            </AppText>
          ) : null}

          {source === 'lesson' ? (
            <Button
              label={expectedCountReached ? 'Complete trace' : 'Finish every stroke'}
              arrow={expectedCountReached}
              disabled={!expectedCountReached}
              onPress={trace.finish}
            />
          ) : trace.canUndo ? (
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

  resultBlock: {
    gap: Spacing.sm,
  },
  resultLabel: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
  },
  saveError: {
    color: Colors.accent,
  },
});
