import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

export function Surface({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.surface, style]} />;
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadow,
  },
});
