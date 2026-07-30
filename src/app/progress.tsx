import { Pressable, StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { GOJUON_ROWS } from '@/domain/curriculum';
import { inkColor } from '@/domain/ink';
import { learnerStateKey } from '@/domain/types';

const COLUMNS = [0, 1, 2, 3, 4];
const COLUMN_LABELS = ['A', 'I', 'U', 'E', 'O'];

/** Ink at the two ends of the range, for the legend swatches. */
const LEGEND_NEW = 'rgba(27, 26, 23, 0.16)';
const LEGEND_KNOWN = 'rgba(27, 26, 23, 0.95)';

export default function ProgressRoute() {
  const app = useApp();
  const router = useRouter();
  if (!app.ready) {
    return <LoadingScreen />;
  }

  const introduced = app.manifest.items.filter((item) =>
    Boolean(app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')]?.reps),
  ).length;

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <AppText variant="kicker">Your kana</AppText>
      <AppText style={styles.title}>
        {introduced} of {app.manifest.items.length} kana
      </AppText>
      <AppText variant="bodySmall" style={styles.intro}>
        These forty-six will carry every Japanese word you ever read. The darker
        a kana, the better you know it. Tap one to see where you two stand.
      </AppText>

      {/* The legend is required — ink density is meaningless without it. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Kana color={LEGEND_NEW}>あ</Kana>
          <AppText style={styles.legendLabel}>new</AppText>
        </View>
        <View style={styles.legendItem}>
          <Kana color={LEGEND_KNOWN}>あ</Kana>
          <AppText style={styles.legendLabel}>known</AppText>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.columnLabels}>
          {COLUMN_LABELS.map((column) => (
            <AppText key={column} style={styles.columnLabel}>
              {column}
            </AppText>
          ))}
        </View>

        {GOJUON_ROWS.map((row) => (
          <View key={row.id} style={styles.row}>
            {/* Not bareRowLabel: stripping "Final" off ん leaves a second row
                labelled N, and in a chart that word is the whole distinction. */}
            <AppText numberOfLines={1} style={styles.rowLabel}>
              {row.shortTitle.replace(/\s+row$/i, '')}
            </AppText>
            <View style={styles.rowCells}>
              {COLUMNS.map((column) => {
                const item = app.manifest.items.find(
                  (candidate) =>
                    candidate.content.rowId === row.id &&
                    candidate.content.column === column,
                );
                // Gaps in the gojūon (ゐ, ゑ and friends) render as nothing.
                if (!item) {
                  return <View key={column} style={styles.cell} />;
                }
                const state =
                  app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')];
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.content.glyph}, ${item.content.primaryAnswer}`}
                    key={column}
                    onPress={() =>
                      router.push({
                        pathname: '/character',
                        params: { glyph: item.content.glyph },
                      })
                    }
                    style={styles.cell}>
                    <Kana size="gridCell" color={inkColor(state)}>
                      {item.content.glyph}
                    </Kana>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 35,
    color: Colors.ink,
    marginTop: 7,
  },
  intro: {
    marginTop: 6,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 11,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendLabel: {
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.inkMuted,
  },

  grid: {
    marginTop: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  columnLabels: {
    flexDirection: 'row',
    marginLeft: 54,
    marginBottom: 6,
  },
  columnLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 43,
  },
  rowLabel: {
    // 38 in the design, but "VOWELS" uppercased with tracking needs 46 — and
    // "FINAL N" needs a little more again.
    width: 54,
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  rowCells: {
    flex: 1,
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
