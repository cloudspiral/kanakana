import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

interface SurfaceProps extends ViewProps {
  /**
   * Draw the 1px `ink` border instead of the default `rule` border. Reserved for
   * the one primary card on a screen — it is how the design says "start here".
   */
  emphasis?: boolean;
}

export function Surface({ emphasis = false, style, ...props }: SurfaceProps) {
  return (
    <View {...props} style={[styles.surface, emphasis && styles.emphasis, style]} />
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: Colors.card,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    borderWidth: 1,
    padding: Spacing.card,
    // No shadow. Separation is by border and paper tone only.
  },
  emphasis: {
    borderColor: Colors.ink,
  },
});
