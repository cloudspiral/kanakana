import { Circle, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/theme';
import type { Point } from '@/domain/strokes';

/** Shared coordinate space for every baked stroke model. */
export const STROKE_REFERENCE = 262;

const BADGE_RADIUS = 9;
const LABEL_FONT_SIZE = 11;

/**
 * A stroke-order number centered on the stroke's exact starting point.
 *
 * This replaces separate start dots: one marker now communicates both where
 * the stroke begins and when it is drawn.
 */
export function StrokeStartNumber({
  point,
  number,
}: {
  point: Point;
  number: number;
}) {
  const x = point.x * STROKE_REFERENCE;
  const y = point.y * STROKE_REFERENCE;

  return (
    <>
      <Circle
        cx={x}
        cy={y}
        r={BADGE_RADIUS}
        fill={Colors.accent}
      />
      <SvgText
        x={x}
        y={y}
        fill={Colors.paper}
        fontSize={LABEL_FONT_SIZE}
        fontWeight="500"
        textAnchor="middle"
        alignmentBaseline="central">
        {number}
      </SvgText>
    </>
  );
}
