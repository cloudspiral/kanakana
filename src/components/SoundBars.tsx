import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * The three-bar sound glyph. Drawn from styled views rather than an icon font —
 * the design ships no image or icon assets at all.
 */
export function SoundBars({ color = Colors.ink }: { color?: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, styles.short, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.tall, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.mid, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 2,
  },
  short: { height: 7 },
  tall: { height: 12 },
  mid: { height: 9 },
});
