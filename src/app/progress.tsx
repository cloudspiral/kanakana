import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRouter } from 'expo-router';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { inkColor } from '@/domain/ink';
import {
  kanaGridRows,
  voicedLensAvailable,
  type KanaLens,
} from '@/domain/kanaGrid';
import { learnerStateKey } from '@/domain/types';

const COLUMNS = [0, 1, 2, 3, 4];
const COLUMN_LABELS = ['A', 'I', 'U', 'E', 'O'];

/** Ink at the two ends of the range, for the legend swatches. */
const LEGEND_NEW = 'rgba(27, 26, 23, 0.16)';
const LEGEND_KNOWN = 'rgba(27, 26, 23, 0.95)';

export default function ProgressRoute() {
  const app = useApp();
  const router = useRouter();
  const [lens, setLens] = useState<KanaLens>('plain');
  if (!app.ready) {
    return <LoadingScreen />;
  }

  const showLens = voicedLensAvailable(app.manifest, app.snapshot);
  const activeLens = showLens ? lens : 'plain';
  const rows = kanaGridRows(app.manifest, app.snapshot, activeLens);

  return (
    <AppScreen bottomNav={<BottomNav />}>
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

      {showLens ? (
        <View style={styles.lens} accessibilityRole="tablist">
          {(
            [
              ['plain', 'Plain'],
              ['dakuten', 'Voiced ゛'],
              ['handakuten', 'P-row ゜'],
            ] as const
          ).map(([value, label], index) => {
            const selected = activeLens === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setLens(value)}
                style={[
                  styles.lensOption,
                  index > 0 && styles.lensDivided,
                  selected && styles.lensSelected,
                ]}>
                <AppText
                  style={[
                    styles.lensLabel,
                    selected && styles.lensLabelSelected,
                  ]}>
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.grid}>
        <View style={styles.columnLabels}>
          {COLUMN_LABELS.map((column) => (
            <AppText key={column} style={styles.columnLabel}>
              {column}
            </AppText>
          ))}
        </View>

        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            {/* Not bareRowLabel: stripping "Final" off ん leaves a second row
                labelled N, and in a chart that word is the whole distinction. */}
            <AppText numberOfLines={1} style={styles.rowLabel}>
              {row.label}
            </AppText>
            <View style={styles.rowCells}>
              {COLUMNS.map((column) => {
                const cell = row.cells[column];
                const item = cell.itemId
                  ? app.manifest.items.find(
                      (candidate) => candidate.id === cell.itemId,
                    )
                  : undefined;
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
                    {activeLens === 'plain' && cell.tick ? (
                      <AppText style={styles.markTick}>{cell.tick}</AppText>
                    ) : null}
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
  lens: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    overflow: 'hidden',
    backgroundColor: Colors.card,
  },
  lensOption: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  lensDivided: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
  },
  lensSelected: {
    backgroundColor: Colors.ink,
  },
  lensLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.inkMuted,
  },
  lensLabelSelected: {
    color: Colors.paper,
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
    position: 'relative',
  },
  markTick: {
    position: 'absolute',
    top: 0,
    right: 0,
    fontFamily: Fonts.kanaLight,
    fontSize: 11,
    lineHeight: 13,
    color: Colors.accent,
  },
});
