import Svg, { Path } from 'react-native-svg';

import { StrokeStartNumber, STROKE_REFERENCE } from './StrokeStartNumber';
import { Colors } from '@/constants/theme';
import { strokeModel, type Point } from '@/domain/strokes';
import type { DerivedMark } from '@/domain/types';

const STROKE_WIDTH = 12;

function toPath(points: readonly Point[]): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${(point.x * STROKE_REFERENCE).toFixed(2)},${(point.y * STROKE_REFERENCE).toFixed(2)}`,
    )
    .join(' ');
}

interface StrokeOrderDiagramProps {
  glyph: string;
  /** Rendered edge length in points. */
  size: number;
  /** Hide the numbers to show the bare shape. */
  numbered?: boolean;
  /** Trailing KanjiVG strokes that form the voiced mark. */
  mark?: DerivedMark;
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
  mark,
}: StrokeOrderDiagramProps) {
  const model = strokeModel(glyph);
  if (!model) {
    return null;
  }
  const markStrokeCount = mark === 'dakuten' ? 2 : mark === 'handakuten' ? 1 : 0;
  const firstMarkStroke = model.length - markStrokeCount;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${STROKE_REFERENCE} ${STROKE_REFERENCE}`}>
      {model.map((stroke, index) => (
        <Path
          key={`stroke-${index}`}
          d={toPath(stroke)}
          stroke={index >= firstMarkStroke ? Colors.accent : Colors.ink}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}

      {numbered
        ? model.map((stroke, index) => (
            <StrokeStartNumber
              key={`start-${index}`}
              point={stroke[0]}
              number={index + 1}
            />
          ))
        : null}
    </Svg>
  );
}
