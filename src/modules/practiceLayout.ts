export type PracticeKanaVariant = 'prompt' | 'feedback';

/**
 * A fixed-size practice square needs its own generous text box. Noto Sans JP's
 * voiced marks sit near the top-right of the em square, so a line box equal to
 * the font size can clip dakuten on native even while the base kana still fits.
 */
export function practiceKanaTextStyle(
  square: number,
  variant: PracticeKanaVariant = 'prompt',
) {
  const feedback = variant === 'feedback';
  return {
    fontSize: square * (feedback ? 0.57 : 0.64),
    lineHeight: square * (feedback ? 0.7 : 0.76),
    textAlign: 'center' as const,
    width: square * 0.86,
  };
}
