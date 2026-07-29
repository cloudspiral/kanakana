import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import { strokeModel, type Point } from '@/domain/strokes';

/** The design's reference square; geometry below is expressed in it. */
const REFERENCE = 262;

const STROKE_WIDTH = 12;
const LABEL_RADIUS = 9;
const LABEL_FONT_SIZE = 11;

/**
 * How far the numbered badge sits from its stroke's first point, along the
 * reverse of the stroke's initial direction — so the label sits *before* the
 * stroke starts rather than on top of it.
 */
const LABEL_OFFSET = 15;

function toPath(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(point.x * REFERENCE).toFixed(2)},${(point.y * REFERENCE).toFixed(2)}`,
    )
    .join(' ');
}

/**
 * Where to park stroke `n`'s badge: back along the direction the stroke sets
 * off in, and clamped inside the square so a badge never falls off the edge.
 */
function labelPosition(stroke: readonly Point[]): { x: number; y: number } {
  const start = stroke[0];
  const ahead = stroke[Math.min(3, stroke.length - 1)];
  const dx = ahead.x - start.x;
  const dy = ahead.y - start.y;
  const length = Math.hypot(dx, dy) || 1;

  const x = start.x * REFERENCE - (dx / length) * LABEL_OFFSET;
  const y = start.y * REFERENCE - (dy / length) * LABEL_OFFSET;
  const margin = LABEL_RADIUS + 1;
  return {
    x: Math.min(REFERENCE - margin, Math.max(margin, x)),
    y: Math.min(REFERENCE - margin, Math.max(margin, y)),
  };
}

interface StrokeOrderDiagramProps {
  glyph: string;
  /** Rendered edge length in points. */
  size: number;
  /** Hide the numbers to show the bare shape. */
  numbered?: boolean;
}

/**
 * The character drawn from its KanjiVG model with a numbered badge at the start
 * of each stroke.
 *
 * Where a stroke begins, and in what order, is what beginners actually get
 * wrong — so the badge marks the starting point rather than labelling the
 * stroke as a whole.
 */
export function StrokeOrderDiagram({
  glyph,
  size,
  numbered = true,
}: StrokeOrderDiagramProps) {
  const model = strokeModel(glyph);
  if (!model) {
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${REFERENCE} ${REFERENCE}`}>
      {model.map((stroke, index) => (
        <Path
          key={`stroke-${index}`}
          d={toPath(stroke)}
          stroke={Colors.ink}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}

      {numbered
        ? model.map((stroke, index) => {
            const { x, y } = labelPosition(stroke);
            return (
              <Circle
                key={`badge-${index}`}
                cx={x}
                cy={y}
                r={LABEL_RADIUS}
                fill={Colors.accent}
              />
            );
          })
        : null}

      {numbered
        ? model.map((stroke, index) => {
            const { x, y } = labelPosition(stroke);
            return (
              <SvgText
                key={`label-${index}`}
                x={x}
                y={y}
                fill={Colors.paper}
                fontSize={LABEL_FONT_SIZE}
                fontWeight="500"
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {index + 1}
              </SvgText>
            );
          })
        : null}
    </Svg>
  );
}
