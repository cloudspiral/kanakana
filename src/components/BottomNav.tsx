import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './Typography';
import { Colors, MaxContentWidth, MinTouch, Spacing } from '@/constants/theme';

const destinations = [
  { path: '/', label: 'Today' },
  { path: '/progress', label: 'Kana' },
  { path: '/settings', label: 'Settings' },
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
              style={styles.item}>
              <AppText
                variant="navLabel"
                style={selected ? styles.labelSelected : styles.label}>
                {destination.label}
              </AppText>
              {/* 16x2 accent underline is the only active marker — no pill, no fill. */}
              <View style={selected ? styles.underline : styles.underlineHidden} />
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
    backgroundColor: Colors.paper,
    borderTopColor: Colors.rule,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.sm,
  },
  nav: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    minHeight: MinTouch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    color: Colors.inkMuted,
  },
  labelSelected: {
    color: Colors.ink,
  },
  underline: {
    width: 16,
    height: 2,
    backgroundColor: Colors.accent,
  },
  underlineHidden: {
    width: 16,
    height: 2,
    backgroundColor: 'transparent',
  },
});
