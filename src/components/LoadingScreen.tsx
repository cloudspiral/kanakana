import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from './Typography';
import { Colors, Spacing } from '@/constants/theme';

export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.inkMuted} size="large" />
      <AppText variant="bodySmall">Opening your practice…</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper,
  },
});
