import {
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'caption' | 'eyebrow';

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

const styles = StyleSheet.create({
  base: {
    color: Colors.ink,
    fontFamily: Fonts.body,
  },
  hero: {
    fontFamily: Fonts.heading,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1.3,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: Fonts.headingSemi,
    fontSize: 20,
    lineHeight: 27,
  },
  body: {
    fontSize: 16,
    lineHeight: 25,
  },
  caption: {
    color: Colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  eyebrow: {
    color: Colors.blue,
    fontFamily: Fonts.headingSemi,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
