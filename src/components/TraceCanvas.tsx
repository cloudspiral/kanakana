import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { StrokeStartNumber, STROKE_REFERENCE } from './StrokeStartNumber';
import { Colors } from '@/constants/theme';
import type { Point } from '@/domain/strokes';
import type { TraceController } from '@/hooks/useTrace';

/**
 * The design's reference square. Geometry below is expressed in this space and
 * scaled by the SVG viewBox, so stroke widths, dash patterns and numbered start
 * points keep the proportions they were tuned at on any screen size.
 */
const STROKE_WIDTH = 12;
function toPath(points: readonly Point[]): string {
  if (points.length === 0) {
    return '';
  }
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(point.x * STROKE_REFERENCE).toFixed(2)},${(point.y * STROKE_REFERENCE).toFixed(2)}`,
    )
    .join(' ');
}

const GHOST_COLOR = 'rgba(27, 26, 23, 0.1)';

interface TraceCanvasProps {
  trace: TraceController;
  /** Rendered edge length in points. */
  size: number;
  /** Draw the whole character faintly underneath. */
  ghost?: boolean;
  /** Reject input and dim the surface — used while the model is unavailable. */
  disabled?: boolean;
}

export function TraceCanvas({
  trace,
  size,
  ghost = true,
  disabled = false,
}: TraceCanvasProps) {
  // Read through a ref inside the responder: PanResponder captures its handlers
  // once, so closing over trace directly would grade against a stale model.
  const traceRef = useRef(trace);
  traceRef.current = trace;

  // Input is rejected in more cases than the surface is dimmed: dimming signals
  // "not drawable yet", so it belongs to the unavailable-model case only. A
  // finished character stays at full strength — it is the learner's work.
  const unavailable = disabled || !trace.ready;
  const blocked = unavailable || Boolean(trace.result);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !blockedRef.current,
        onMoveShouldSetPanResponder: () => !blockedRef.current,
        onPanResponderGrant: (event) => {
          if (blockedRef.current) {
            return;
          }
          const { locationX, locationY } = event.nativeEvent;
          traceRef.current.beginStroke({
            x: locationX / sizeRef.current,
            y: locationY / sizeRef.current,
          });
        },
        onPanResponderMove: (event) => {
          if (blockedRef.current) {
            return;
          }
          const { locationX, locationY } = event.nativeEvent;
          traceRef.current.extendStroke({
            x: locationX / sizeRef.current,
            y: locationY / sizeRef.current,
          });
        },
        // Keep the drawing surface's responder when another React Native view
        // asks for it. Forced browser/OS cancellation can still happen, and is
        // handled below without committing a partial stroke.
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => traceRef.current.endStroke(),
        onPanResponderTerminate: () => traceRef.current.cancelStroke(),
      }),
    [],
  );

  return (
    <View
      style={[StyleSheet.absoluteFill, unavailable && styles.dimmed]}
      {...responder.panHandlers}>
      <Svg
        // Every path and numbered marker is instructional paint. The parent
        // View owns drawing input, so the SVG must never become a dead touch
        // target when a stroke begins directly on a start number.
        pointerEvents="none"
        width={size}
        height={size}
        viewBox={`0 0 ${STROKE_REFERENCE} ${STROKE_REFERENCE}`}>
        {/* The ghost is drawn from the same model data as the matcher rather
            than as text. A Noto Sans JP glyph and a KanjiVG outline do not share
            metrics, so a text ghost sits visibly off the strokes being graded —
            tracing what you can see would then score as a miss. */}
        {ghost && trace.model
          ? trace.model.map((stroke, index) => (
              <Path
                key={`ghost-${index}`}
                d={toPath(stroke)}
                stroke={GHOST_COLOR}
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))
          : null}

        {trace.done.map((stroke, index) => (
          <Path
            key={index}
            d={toPath(stroke.drawn)}
            stroke={Colors.ink}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}

        {trace.live && trace.live.length > 1 ? (
          <Path
            d={toPath(trace.live)}
            stroke={Colors.ink}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

        {/* A revealed model teaches both order and starting position. Markers
            sit above the learner's ink so the answer remains readable while
            they compare their attempt. */}
        {ghost && trace.model
          ? trace.model.map((stroke, index) => (
              <StrokeStartNumber
                key={`ghost-start-${index}`}
                point={stroke[0]}
                number={index + 1}
              />
            ))
          : null}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  dimmed: {
    opacity: 0.4,
  },
});
