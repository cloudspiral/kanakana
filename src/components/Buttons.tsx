import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';

import { AppText } from './Typography';
import { Colors, Fonts, MinTouch, Radius, Spacing } from '@/constants/theme';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  /** Show the peach arrow. Only legal on `primary` — it is the one `ink` fill. */
  arrow?: boolean;
  /** Keep the label optically centered while the arrow stays right-aligned. */
  centerArrowLabel?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  arrow = false,
  centerArrowLabel = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading;

  if (variant === 'link') {
    return (
      <Pressable
        accessibilityRole="link"
        disabled={inactive}
        {...props}
        style={(state) => [
          styles.link,
          state.pressed && styles.linkPressed,
          typeof style === 'function' ? style(state) : style,
        ]}>
        <AppText style={styles.linkLabel}>{label}</AppText>
      </Pressable>
    );
  }

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      {...props}
      style={(state) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        // Disabled never inverts — it takes the well fill, a paler border and a
        // muted label. Do not add opacity here.
        inactive && styles.inactive,
        state.pressed && !inactive && (isPrimary ? styles.primaryPressed : styles.secondaryPressed),
        arrow
          ? centerArrowLabel
            ? styles.centered
            : styles.withArrow
          : styles.centered,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {loading ? (
        <ActivityIndicator color={Colors.inkMuted} />
      ) : (
        <>
          <AppText
            variant="button"
            style={inactive ? styles.inactiveLabel : isPrimary ? styles.primaryLabel : styles.secondaryLabel}>
            {label}
          </AppText>
          {arrow ? (
            <AppText
              style={[
                inactive ? styles.inactiveArrow : styles.arrow,
                centerArrowLabel && styles.centeredArrow,
              ]}
              aria-hidden>
              →
            </AppText>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

interface PillProps extends PressableProps {
  label: string;
  /** Filled with `accentSoft` and outlined in `accent` — used for an engaged toggle. */
  active?: boolean;
  icon?: React.ReactNode;
}

/**
 * A small bordered control. Visually 34px tall per the design, so it carries
 * hitSlop to reach the 44px minimum target without growing the pill.
 */
export function Pill({
  label,
  active = false,
  icon,
  disabled,
  style,
  ...props
}: PillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, selected: active }}
      disabled={disabled}
      hitSlop={PILL_HIT_SLOP}
      {...props}
      style={(state) => [
        styles.pill,
        active && styles.pillActive,
        disabled && styles.pillDisabled,
        state.pressed && !disabled && styles.pillPressed,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {icon ? <View style={styles.pillIcon}>{icon}</View> : null}
      <AppText
        style={[
          styles.pillLabel,
          active && styles.pillLabelActive,
          disabled && styles.pillLabelDisabled,
        ]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const PILL_VISUAL_HEIGHT = 34;
const PILL_HIT_SLOP = Math.round((MinTouch - PILL_VISUAL_HEIGHT) / 2);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MinTouch,
    borderRadius: Radius.rect,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 17,
  },
  centered: {
    justifyContent: 'center',
  },
  withArrow: {
    justifyContent: 'space-between',
  },
  primary: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  primaryPressed: {
    backgroundColor: Colors.inkPressed,
    borderColor: Colors.inkPressed,
  },
  secondary: {
    backgroundColor: Colors.card,
    borderColor: Colors.fieldBorder,
  },
  secondaryPressed: {
    backgroundColor: Colors.wellFill,
  },
  inactive: {
    backgroundColor: Colors.wellFill,
    borderColor: Colors.fieldBorder,
  },
  primaryLabel: {
    color: Colors.paper,
  },
  secondaryLabel: {
    color: Colors.ink,
  },
  inactiveLabel: {
    color: Colors.inkMuted,
  },
  arrow: {
    fontSize: 17,
    lineHeight: 20,
    color: Colors.peach,
  },
  centeredArrow: {
    position: 'absolute',
    right: 20,
  },
  inactiveArrow: {
    fontSize: 17,
    lineHeight: 20,
    color: Colors.inkMuted,
  },

  link: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MinTouch,
    paddingVertical: Spacing.xxs,
  },
  linkPressed: {
    opacity: 0.65,
  },
  linkLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.inkMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.linkUnderline,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.fieldBorder,
    backgroundColor: Colors.card,
  },
  pillActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  pillPressed: {
    backgroundColor: Colors.wellFill,
  },
  pillDisabled: {
    backgroundColor: Colors.wellFill,
  },
  pillIcon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  pillLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.ink,
  },
  pillLabelActive: {
    color: Colors.accent,
  },
  pillLabelDisabled: {
    color: Colors.inkMuted,
  },
});
