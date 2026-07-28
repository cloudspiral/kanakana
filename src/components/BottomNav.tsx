import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './Typography';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

const destinations = [
  { path: '/', label: 'Home', icon: '⌂' },
  { path: '/progress', label: 'Progress', icon: '◫' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.shell,
        { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
      ]}>
      <View style={styles.nav}>
        {destinations.map((destination) => {
          const selected = pathname === destination.path;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={destination.label}
              key={destination.path}
              onPress={() => router.replace(destination.path)}
              style={[styles.item, selected && styles.selected]}>
              <AppText
                style={[styles.icon, selected && styles.selectedText]}
                aria-hidden>
                {destination.icon}
              </AppText>
              <AppText
                variant="caption"
                style={[styles.label, selected && styles.selectedText]}>
                {destination.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    backgroundColor: Colors.canvas,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  nav: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  item: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  selected: {
    backgroundColor: Colors.paleBlue,
  },
  icon: {
    color: Colors.inkMuted,
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
  },
  selectedText: {
    color: Colors.blue,
    fontFamily: 'Poppins_600SemiBold',
  },
});
