import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
} from 'react-native';

import { AppText } from './Typography';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  loading?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...props}
      style={(state) => [
        styles.base,
        styles[variant],
        state.pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.white : Colors.blue}
        />
      ) : (
        <AppText
          style={[
            styles.label,
            variant === 'primary' ? styles.primaryLabel : styles.otherLabel,
            variant === 'danger' && styles.dangerLabel,
          ]}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: Colors.blue,
    borderColor: Colors.blue,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
  },
  quiet: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.redPale,
    borderColor: '#F4CBD5',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
  },
  primaryLabel: {
    color: Colors.white,
  },
  otherLabel: {
    color: Colors.blue,
  },
  dangerLabel: {
    color: Colors.red,
  },
});
