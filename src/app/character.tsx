import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button, Pill } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SoundBars } from '@/components/SoundBars';
import { StrokeOrderDiagram } from '@/components/StrokeOrderDiagram';
import { AppText, Kana } from '@/components/Typography';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { CONFUSIONS, WORDS, strokeNoteFor } from '@/domain/kanaContent';
import { bondFor, inkStrength, isIntroduced } from '@/domain/ink';
import { WRITING_SKILL } from '@/domain/scheduler';
import { strokeCount } from '@/domain/strokes';
import { learnerStateKey, type LearnerSkillState } from '@/domain/types';
import { isKanaAudioAvailable, playKana } from '@/services/audio';

const DIAGRAM_SIZE = 150;

function returnsIn(state: LearnerSkillState | undefined): string {
  if (!isIntroduced(state)) {
    return '—';
  }
  const ms = new Date(state!.due).getTime() - Date.now();
  if (ms <= 0) {
    return 'today';
  }
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days < 1) {
    return 'today';
  }
  return days === 1 ? '1 day' : `${days} days`;
}

export default function CharacterRoute() {
  const app = useApp();
  const router = useRouter();
  const params = useLocalSearchParams<{ glyph?: string }>();

  /**
   * The link promises the chart, so it has to land there — a plain back() would
   * step to the previous character when you arrived via a mix-up chip. dismissTo
   * pops to the chart if it is behind us and opens it if it is not.
   */
  const backToChart = () => router.dismissTo('/progress');

  if (!app.ready) {
    return <LoadingScreen />;
  }

  const glyph = typeof params.glyph === 'string' ? params.glyph : '';
  const item = app.manifest.items.find(
    (candidate) => candidate.content.glyph === glyph,
  );

  if (!item) {
    return (
      <AppScreen scroll={false} contentStyle={styles.missing}>
        <AppText variant="sectionTitle">That kana is not in this set.</AppText>
        <Button label="Back to your kana" onPress={backToChart} />
      </AppScreen>
    );
  }

  const reading = app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')];
  const writing = app.snapshot.skillStates[learnerStateKey(item.id, WRITING_SKILL)];
  const bond = bondFor(reading);
  const words = WORDS[glyph] ?? [];
  const confusions = CONFUSIONS[glyph] ?? [];
  const strokeNote = strokeNoteFor(glyph);
  const canHear = app.snapshot.settings.soundEnabled && isKanaAudioAvailable(glyph);

  return (
    <AppScreen>
      <Pressable
        accessibilityRole="button"
        onPress={backToChart}
        style={styles.back}>
        <AppText style={styles.backLabel}>← Your kana</AppText>
      </Pressable>

      <View style={styles.header}>
        <GuideSquare
          size={132}
          emphasis={false}
          chip={{ label: item.content.primaryAnswer, tone: 'ink' }}>
          <Kana style={styles.headerGlyph}>{glyph}</Kana>
        </GuideSquare>
        <View style={styles.headerCopy}>
          <AppText variant="kicker">{bond.label}</AppText>
          <AppText style={styles.bondDetail}>{bond.detail}</AppText>
          <AppText variant="bodySmall">
            {item.content.rowLabel} · {strokeCount(glyph) === 1 ? 'one stroke' : `${strokeCount(glyph)} strokes`}
          </AppText>
        </View>
      </View>

      {canHear ? (
        <Pill
          label="Hear it"
          icon={<SoundBars />}
          onPress={() => void playKana(glyph)}
          style={styles.hear}
        />
      ) : null}

      {/* Reading and writing are separate skills — the app says so plainly
          rather than averaging them into one number. */}
      <View style={styles.card}>
        <Meter label="Reading it" value={inkStrength(reading)} tone={Colors.ink} />
        <Meter label="Writing it" value={inkStrength(writing)} tone={Colors.accent} />
        <View style={styles.figures}>
          <Figure label="times seen" value={String(reading?.reps ?? 0)} />
          <Figure label="times drawn" value={String(writing?.reps ?? 0)} />
          <Figure label="next return" value={returnsIn(reading)} />
        </View>
      </View>

      <AppText style={styles.sectionTitle}>The shape</AppText>
      <View style={styles.diagramRow}>
        <StrokeOrderDiagram glyph={glyph} size={DIAGRAM_SIZE} />
        {strokeNote ? (
          <AppText variant="bodySmall" style={styles.diagramNote}>
            {strokeNote}
          </AppText>
        ) : null}
      </View>

      {words.length > 0 ? (
        <>
          <AppText style={styles.sectionTitle}>Where you&rsquo;ll meet it</AppText>
          <View style={styles.card}>
            {words.map((word, index) => (
              <View
                key={word.word}
                style={[styles.wordRow, index > 0 && styles.divided]}>
                <AppText style={styles.word}>
                  {word.word.split('').map((character, position) => (
                    <AppText
                      key={`${character}-${position}`}
                      style={character === glyph ? styles.wordTarget : undefined}>
                      {character}
                    </AppText>
                  ))}
                </AppText>
                <View style={styles.wordGloss}>
                  <AppText variant="bodySmall">{word.romaji}</AppText>
                  <AppText variant="bodySmall">{word.gloss}</AppText>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {confusions.length > 0 ? (
        <>
          <AppText style={styles.sectionTitle}>Easy to mix up with</AppText>
          <View style={styles.chips}>
            {confusions.map((other) => (
              <Pressable
                key={other.glyph}
                accessibilityRole="button"
                accessibilityLabel={`${other.glyph}, ${other.romaji}`}
                onPress={() =>
                  router.push({
                    pathname: '/character',
                    params: { glyph: other.glyph },
                  })
                }
                style={styles.chip}>
                <Kana style={styles.chipGlyph}>{other.glyph}</Kana>
                <AppText variant="bodySmall">{other.note}</AppText>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Button
        label={`Draw ${glyph}`}
        arrow
        style={styles.draw}
        onPress={() => router.push({ pathname: '/trace', params: { glyph } })}
      />
    </AppScreen>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <AppText variant="meterLabel">{label}</AppText>
        <AppText style={styles.meterValue}>{percent}%</AppText>
      </View>
      <View style={styles.meterTrack}>
        <View
          style={[styles.meterFill, { width: `${percent}%`, backgroundColor: tone }]}
        />
      </View>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.figure}>
      <AppText style={styles.figureValue}>{value}</AppText>
      <AppText variant="bodySmall">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  missing: { justifyContent: 'center', gap: Spacing.md },
  back: { minHeight: 44, justifyContent: 'center' },
  backLabel: { fontSize: 14, lineHeight: 20, color: Colors.inkMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerGlyph: { fontFamily: Fonts.kanaThin, fontSize: 88, lineHeight: 100 },
  headerCopy: { flex: 1, gap: 4 },
  bondDetail: { fontFamily: Fonts.serif, fontSize: 19, lineHeight: 24, color: Colors.ink },
  hear: { alignSelf: 'flex-start', marginBottom: Spacing.md },

  card: {
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
    padding: Spacing.card,
    gap: Spacing.md,
  },
  meter: { gap: 5 },
  meterHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  meterValue: { fontFamily: Fonts.serif, fontSize: 18, lineHeight: 22, color: Colors.ink },
  meterTrack: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.wellFill,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: Radius.pill },
  figures: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.ruleSoft,
    paddingTop: Spacing.sm,
  },
  figure: { flex: 1, gap: 2 },
  figureValue: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    color: Colors.ink,
  },

  sectionTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    lineHeight: 25,
    color: Colors.ink,
    marginTop: Spacing.section,
    marginBottom: Spacing.xs,
  },
  diagramRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  diagramNote: { flex: 1 },

  wordRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: Colors.ruleSoft, paddingTop: Spacing.sm },
  word: { fontFamily: Fonts.kanaLight, fontSize: 26, lineHeight: 34, color: Colors.ink },
  wordTarget: { color: Colors.accent },
  wordGloss: { alignItems: 'flex-end' },

  chips: { gap: Spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  chipGlyph: { fontSize: 26, lineHeight: 32 },
  draw: { marginTop: Spacing.section },
});
