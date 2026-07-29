import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './Typography';
import { Colors, Fonts, Radius } from '@/constants/theme';

interface GuideSquareProps extends PropsWithChildren {
  /** Rendered edge length. The design's reference is 262 in practice, 290 in onboarding. */
  size: number;
  /** Override the width. Onboarding's hero is full-bleed at 290 tall, not square. */
  width?: number | `${number}%`;
  /** Genkō-yōshi cross-hairs. Off when the tracing guide setting is disabled. */
  guides?: boolean;
  /** Emphasised 1px ink border rather than the default rule border. */
  emphasis?: boolean;
  /** Border colour override, for the feedback overlay's correct/incorrect states. */
  borderColor?: string;
  borderWidth?: number;
  /** Flush-corner chip. `ink` carries a romaji reading; `accent` carries a label. */
  chip?: { label: string; tone: 'ink' | 'accent'; corner?: 'bottomLeft' | 'bottomRight' };
  /** Absolutely-positioned extras drawn above the guides but below the chip. */
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * The bordered writing square used by onboarding, meet, trace, recall, feedback
 * and the character profile. Squared off at 5px with cross-hair guides, in the
 * manner of genkō-yōshi paper.
 */
export function GuideSquare({
  size,
  width,
  guides = true,
  emphasis = true,
  borderColor,
  borderWidth,
  chip,
  overlay,
  style,
  children,
}: GuideSquareProps) {
  const corner = chip?.corner ?? 'bottomLeft';
  return (
    <View
      style={[
        styles.square,
        { width: width ?? size, height: size },
        emphasis ? styles.emphasis : styles.plain,
        borderColor ? { borderColor } : null,
        borderWidth ? { borderWidth } : null,
        style,
      ]}>
      {guides ? (
        <>
          <View style={styles.horizontalGuide} />
          <View style={styles.verticalGuide} />
        </>
      ) : null}
      {overlay}
      {children}
      {chip ? (
        <View
          style={[
            styles.chip,
            corner === 'bottomLeft' ? styles.chipLeft : styles.chipRight,
            chip.tone === 'ink' ? styles.chipInk : styles.chipAccent,
          ]}>
          <AppText
            style={chip.tone === 'ink' ? styles.chipInkLabel : styles.chipAccentLabel}>
            {chip.label}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.rect,
    borderWidth: 1,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  emphasis: {
    borderColor: Colors.ink,
  },
  plain: {
    borderColor: Colors.rule,
  },
  horizontalGuide: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: Colors.guide,
  },
  verticalGuide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: Colors.guide,
  },
  chip: {
    position: 'absolute',
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLeft: {
    left: 0,
  },
  chipRight: {
    right: 0,
  },
  chipInk: {
    backgroundColor: Colors.ink,
  },
  chipAccent: {
    backgroundColor: Colors.accent,
  },
  chipInkLabel: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    lineHeight: 20,
    color: Colors.paper,
  },
  chipAccentLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: Colors.paper,
  },
});
