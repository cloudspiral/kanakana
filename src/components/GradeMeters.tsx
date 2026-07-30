import { StyleSheet, View } from 'react-native';

import { AppText } from './Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { TraceResult } from '@/domain/strokes';

export function GradeMeters({
  result,
}: {
  result: Pick<TraceResult, 'accuracy' | 'orderAndDirection'>;
}) {
  return (
    <View style={styles.meters}>
      <Meter label="Stroke accuracy" value={result.accuracy} />
      <Meter label="Order & direction" value={result.orderAndDirection} />
    </View>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <AppText variant="meterLabel">{label}</AppText>
        <AppText style={styles.meterValue}>{percent}%</AppText>
      </View>
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meters: {
    gap: Spacing.sm,
  },
  meter: {
    gap: 5,
  },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  meterValue: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 22,
  },
  meterTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.wellFill,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
  },
});
