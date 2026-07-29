import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { Point } from '@/domain/strokes';
import type { TraceController } from '@/hooks/useTrace';

/**
 * The design's reference square. Geometry below is expressed in this space and
 * scaled by the SVG viewBox, so the stroke widths, dash pattern and start dot
 * keep the proportions they were tuned at on any screen size.
 */
const REFERENCE = 262;

const STROKE_WIDTH = 12;
const HINT_WIDTH = 9;
const HINT_DASH = '9,8';
const HINT_DOT_RADIUS = 7;
const HINT_COLOR = 'rgba(188, 62, 39, 0.42)';

function toPath(points: readonly Point[]): string {
  if (points.length === 0) {
    return '';
  }
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(point.x * REFERENCE).toFixed(2)},${(point.y * REFERENCE).toFixed(2)}`,
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
  const blocked =
    unavailable || trace.awaitingCall || Boolean(trace.result);
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
        onPanResponderRelease: () => traceRef.current.endStroke(),
        onPanResponderTerminate: () => traceRef.current.endStroke(),
      }),
    [],
  );

  const nextModelStroke = trace.model?.[trace.done.length];

  return (
    <View
      style={[StyleSheet.absoluteFill, unavailable && styles.dimmed]}
      {...responder.panHandlers}>
      <Svg width={size} height={size} viewBox={`0 0 ${REFERENCE} ${REFERENCE}`}>
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

        {/* The hint sits under the ink so a drawn stroke covers it. */}
        {trace.hint && nextModelStroke ? (
          <>
            <Path
              d={toPath(nextModelStroke)}
              stroke={HINT_COLOR}
              strokeWidth={HINT_WIDTH}
              strokeDasharray={HINT_DASH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Where a stroke begins is what beginners actually get wrong. */}
            <Circle
              cx={nextModelStroke[0].x * REFERENCE}
              cy={nextModelStroke[0].y * REFERENCE}
              r={HINT_DOT_RADIUS}
              fill={Colors.accent}
            />
          </>
        ) : null}

        {trace.done.map((stroke, index) =>
          stroke.drawn ? (
            <Path
              key={index}
              d={toPath(stroke.drawn)}
              stroke={Colors.ink}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : trace.model?.[index] ? (
            // Drawn in after four misses.
            <Path
              key={index}
              d={toPath(trace.model[index])}
              stroke={Colors.ink}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null,
        )}

        {/* A pending close call is drawn in vermillion over the dashed model. */}
        {trace.pendingCall ? (
          <Path
            d={toPath(trace.pendingCall)}
            stroke={Colors.accent}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}

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
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  dimmed: {
    opacity: 0.4,
  },
});
