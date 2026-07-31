import { describe, expect, it } from 'vitest';

import { practiceKanaTextStyle } from '../practiceLayout';

describe('practice kana layout', () => {
  it.each(['prompt', 'feedback'] as const)(
    'keeps %s glyphs inside a mark-safe text box',
    (variant) => {
      const square = 262;
      const style = practiceKanaTextStyle(square, variant);

      // Extra vertical leading protects dakuten and handakuten from native text
      // clipping; horizontal inset keeps their right edge away from the square.
      expect(style.lineHeight).toBeGreaterThan(style.fontSize);
      expect(style.width).toBeLessThan(square);
      expect(style.textAlign).toBe('center');
    },
  );
});
