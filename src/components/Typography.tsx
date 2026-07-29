import {
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { Colors, Glyph, Type } from '@/constants/theme';

type Variant =
  | 'display'
  | 'screenTitle'
  | 'sectionTitle'
  | 'kicker'
  | 'navLabel'
  | 'meterLabel'
  | 'body'
  | 'bodySmall'
  | 'button'
  /** @deprecated Pre-redesign names. Removed as each screen gets its Paper & Ink pass. */
  | 'hero'
  | 'title'
  | 'heading'
  | 'caption'
  | 'eyebrow';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
}

export function AppText({
  variant = 'body',
  color,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant] as TextStyle,
        color ? { color } : null,
        style,
      ]}
    />
  );
}

type GlyphSize = keyof typeof Glyph;

interface KanaProps extends TextProps {
  size?: GlyphSize;
  color?: string;
}

/**
 * A kana glyph. Separate from AppText because the design carries hierarchy here
 * through font weight (Noto Sans JP 200 vs 300), not only size.
 */
export function Kana({ size = 'inline', color, style, ...props }: KanaProps) {
  return (
    <Text
      {...props}
      style={[glyphStyles[size], color ? { color } : styles.base, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.ink,
    fontFamily: Type.body.fontFamily,
  },

  display: { ...Type.display, ...{ letterSpacing: -0.4 } },
  screenTitle: Type.screenTitle,
  sectionTitle: Type.sectionTitle,
  kicker: Type.kicker,
  navLabel: Type.navLabel,
  meterLabel: Type.meterLabel,
  body: Type.body,
  bodySmall: Type.bodySmall,
  button: Type.button,

  // Deprecated aliases, kept only so unmigrated screens still compile.
  hero: Type.display,
  title: Type.screenTitle,
  heading: Type.sectionTitle,
  caption: Type.bodySmall,
  eyebrow: Type.kicker,
});

const glyphStyles = StyleSheet.create({
  hero: { color: Colors.ink, ...Glyph.hero },
  tracingModel: { color: Colors.ink, ...Glyph.tracingModel },
  gridCell: { color: Colors.ink, ...Glyph.gridCell },
  inline: { color: Colors.ink, ...Glyph.inline },
});
