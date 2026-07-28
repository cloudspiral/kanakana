import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Wordmark } from '@/components/Wordmark';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { GOJUON_ROWS } from '@/domain/curriculum';
import { stateLabel } from '@/domain/scheduler';
import { learnerStateKey } from '@/domain/types';

const statusStyles = {
  'Not started': {
    background: Colors.white,
    border: Colors.border,
    text: Colors.inkMuted,
    marker: '○',
  },
  Learning: {
    background: Colors.paleBlue,
    border: '#C8D4FF',
    text: Colors.blue,
    marker: '◐',
  },
  Strong: {
    background: Colors.greenPale,
    border: '#B9E5D6',
    text: Colors.green,
    marker: '●',
  },
  Due: {
    background: Colors.palePink,
    border: '#F4C5DE',
    text: Colors.red,
    marker: '↻',
  },
} as const;

export default function ProgressRoute() {
  const app = useApp();
  if (!app.ready) {
    return <LoadingScreen />;
  }

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <Wordmark />
      <View style={styles.heading}>
        <AppText variant="eyebrow">Progress</AppText>
        <AppText variant="title">Your gojūon map</AppText>
        <AppText color={Colors.inkMuted}>
          Each kana is scheduled independently. This grid shows where each
          reading skill stands today.
        </AppText>
      </View>

      <View style={styles.legend}>
        {Object.entries(statusStyles).map(([label, style]) => (
          <View key={label} style={styles.legendItem}>
            <AppText color={style.text}>{style.marker}</AppText>
            <AppText variant="caption">{label}</AppText>
          </View>
        ))}
      </View>

      <Surface style={styles.gridCard}>
        <View style={styles.columnLabels}>
          {['a', 'i', 'u', 'e', 'o'].map((column) => (
            <AppText key={column} variant="caption" style={styles.columnLabel}>
              {column}
            </AppText>
          ))}
        </View>
        {GOJUON_ROWS.map((row) => (
          <View key={row.id} style={styles.row}>
            <AppText variant="caption" style={styles.rowLabel}>
              {row.shortTitle}
            </AppText>
            <View style={styles.rowCells}>
              {[0, 1, 2, 3, 4].map((column) => {
                const seed = row.kana.find((candidate) => candidate.column === column);
                if (!seed) {
                  return <View key={column} style={styles.emptyCell} />;
                }
                const item = app.manifest.items.find(
                  (candidate) =>
                    candidate.content.rowId === row.id &&
                    candidate.content.column === column,
                );
                if (!item) {
                  return <View key={column} style={styles.emptyCell} />;
                }
                const label = stateLabel(
                  app.snapshot.skillStates[
                    learnerStateKey(item.id, 'kana_reading')
                  ],
                );
                const visual = statusStyles[label];
                return (
                  <View
                    accessible
                    accessibilityLabel={`${item.content.glyph}, ${item.content.primaryAnswer}, ${label}`}
                    key={column}
                    style={[
                      styles.cell,
                      {
                        backgroundColor: visual.background,
                        borderColor: visual.border,
                      },
                    ]}>
                    <AppText style={[styles.cellGlyph, { color: visual.text }]}>
                      {item.content.glyph}
                    </AppText>
                    <AppText
                      style={[styles.cellMarker, { color: visual.text }]}
                      aria-hidden>
                      {visual.marker}
                    </AppText>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Surface>
      <AppText variant="caption" style={styles.note}>
        Progress is informational. Continue from Home to keep reviews and new
        material in the right order.
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  gridCard: {
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
  },
  columnLabels: {
    flexDirection: 'row',
    marginLeft: 64,
  },
  columnLabel: {
    flex: 1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowLabel: {
    width: 56,
    fontSize: 10,
  },
  rowCells: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  cell: {
    flex: 1,
    aspectRatio: 0.82,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  emptyCell: {
    flex: 1,
    aspectRatio: 0.82,
  },
  cellGlyph: {
    fontFamily: Fonts.japanese,
    fontSize: 24,
    lineHeight: 30,
  },
  cellMarker: {
    position: 'absolute',
    right: 3,
    top: 1,
    fontSize: 8,
  },
  note: {
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
