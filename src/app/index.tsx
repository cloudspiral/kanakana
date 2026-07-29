import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/Buttons';
import { GuideSquare } from '@/components/GuideSquare';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText, Kana } from '@/components/Typography';
import { Wordmark } from '@/components/Wordmark';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { inkColor } from '@/domain/ink';
import { dueItems, weakItems } from '@/domain/scheduler';
import { learnerStateKey, type CurriculumUnit, type LearningItem } from '@/domain/types';

export default function HomeRoute() {
  const app = useApp();
  if (!app.ready) {
    return <LoadingScreen />;
  }
  if (!app.snapshot.onboardingComplete) {
    return <Onboarding />;
  }
  return <Home />;
}

/** The items a unit introduces, in curriculum order, de-duplicated across modules. */
function unitItems(unit: CurriculumUnit, items: LearningItem[]): LearningItem[] {
  const wanted = new Set(
    unit.modules.flatMap((module) => module.targets.map((target) => target.itemId)),
  );
  return items.filter((item) => wanted.has(item.id));
}

function StepIndicator({ step }: { step: 0 | 1 }) {
  return (
    <View style={styles.steps}>
      <View style={step === 0 ? styles.stepActive : styles.stepIdle} />
      <View style={step === 1 ? styles.stepActive : styles.stepIdle} />
    </View>
  );
}

function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const [page, setPage] = useState<0 | 1>(0);
  const vowels = app.manifest.items.filter((item) => item.content.rowId === 'vowels');

  async function begin() {
    await app.completeOnboarding();
    await app.startUnit('unit-vowels');
    router.push('/practice');
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.headerRow}>
        <Wordmark />
        <StepIndicator step={page} />
      </View>

      {page === 0 ? (
        <View style={styles.onboardingBody}>
          {/* Full-bleed at 290 tall rather than square — the practice screens
              are the ones that use a true square. */}
          <GuideSquare
            size={290}
            width="100%"
            chip={{ label: 'a', tone: 'accent', corner: 'bottomRight' }}
            overlay={
              <>
                <Kana style={[styles.cornerKana, styles.cornerKanaTopLeft]}>か</Kana>
                <Kana style={[styles.cornerKana, styles.cornerKanaBottomRight]}>ら</Kana>
              </>
            }>
            <Kana size="hero">あ</Kana>
          </GuideSquare>

          <View style={styles.copyBlock}>
            <AppText variant="kicker">Read and write from day one</AppText>
            <AppText variant="display">Learn kana that actually sticks.</AppText>
            <AppText variant="body" color={Colors.inkMuted}>
              Forty-six characters, and they never leave you. Every Japanese word
              you&rsquo;ll ever read is built from them — so you&rsquo;ll see each
              one, hear it, and draw it until it&rsquo;s yours.
            </AppText>
          </View>

          <Button label="See how it works" arrow onPress={() => setPage(1)} />
        </View>
      ) : (
        <View style={styles.onboardingBody}>
          <View style={styles.copyBlock}>
            <AppText variant="kicker">Three moves, over and over</AppText>
            <AppText variant="screenTitle">Meet it, draw it, recall it.</AppText>
          </View>

          <View style={styles.moves}>
            <MoveRow
              title="Meet the shape"
              body="See it large, hear the sound once."
              tile={<Kana style={styles.moveGlyph}>き</Kana>}
            />
            {/* Drawing is the differentiator, so the middle row carries the ink
                border, the accent tile and the dot. */}
            <MoveRow
              emphasis
              title="Draw it once"
              body="Tracing the strokes is what makes the shape stop looking like a squiggle."
              tile={
                <Kana style={[styles.moveGlyph, styles.moveGlyphDrawn]}>き</Kana>
              }
            />
            <MoveRow
              title="Recall it later"
              body="Misses come back after a little space — never as a penalty."
              tile={<AppText style={styles.moveRomaji}>ki</AppText>}
            />
          </View>

          <View style={styles.vowelStrip}>
            {vowels.map((item) => (
              <View key={item.id} style={styles.vowel}>
                <Kana style={styles.vowelGlyph}>{item.content.glyph}</Kana>
                <AppText style={styles.vowelRomaji}>
                  {item.content.primaryAnswer}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.onboardingActions}>
            <Button label="Begin with the five vowels" arrow onPress={begin} />
            <Button
              label="I've used Kanakana before"
              variant="link"
              onPress={() => void app.completeOnboarding()}
            />
          </View>
        </View>
      )}
    </AppScreen>
  );
}

function MoveRow({
  title,
  body,
  tile,
  emphasis = false,
}: {
  title: string;
  body: string;
  tile: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <View style={[styles.moveRow, emphasis && styles.moveRowEmphasis]}>
      <View style={[styles.moveTile, emphasis && styles.moveTileEmphasis]}>
        {tile}
        {emphasis ? <View style={styles.moveDot} /> : null}
      </View>
      <View style={styles.moveCopy}>
        <AppText style={styles.moveTitle}>{title}</AppText>
        <AppText variant="bodySmall" style={styles.moveBody}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function Home() {
  const app = useApp();
  const router = useRouter();

  const due = useMemo(
    () => dueItems(app.manifest.items, app.snapshot.skillStates),
    [app.manifest.items, app.snapshot.skillStates],
  );

  const nextUnit = app.manifest.units.find((unit) => unit.id === app.nextUnitId);
  const nextRowItems = nextUnit ? unitItems(nextUnit, app.manifest.items) : [];
  const nextRowLabel = nextRowItems[0]?.content.rowLabel ?? nextUnit?.shortTitle ?? '';

  const introduced = app.manifest.items.filter((item) =>
    Boolean(app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')]?.reps),
  ).length;

  const hasActiveSession = Boolean(app.activeSession);
  const weekday = new Date()
    .toLocaleDateString(undefined, { weekday: 'short' })
    .toUpperCase();
  const todayChip = due.length
    ? `${weekday} · ${due.length} due`
    : `${weekday} · all clear`;

  const headline = due.length
    ? `${due.length === 1 ? 'One sound is' : `${due.length} sounds are`} ready to come back.`
    : nextUnit
      ? `Ready for the ${nextRowLabel} row.`
      : 'Every shape is in your ink.';

  // Mirrors startContinue(): due reviews first, then the next row.
  const primary = hasActiveSession
    ? {
        kicker: 'In progress',
        title: 'Pick up where you stopped',
        cta: 'Resume practice',
        preview: due.length ? due : nextRowItems,
      }
    : due.length
      ? {
          kicker: 'Review first',
          title: `${due.length} ${due.length === 1 ? 'character' : 'characters'}, about ${Math.max(2, Math.round(due.length * 0.6))} minutes`,
          cta: 'Begin review',
          preview: due,
        }
      : nextUnit
        ? {
            kicker: 'Next row',
            title: `Meet ${nextRowItems.length} new ${nextRowItems.length === 1 ? 'shape' : 'shapes'} in the ${nextRowLabel} row`,
            cta: 'Start the lesson',
            preview: nextRowItems,
          }
        : {
            kicker: 'All met',
            title: 'Every character is in your ink',
            cta: 'Review when something returns',
            preview: app.manifest.items.slice(0, 4),
          };

  const caughtUp = !hasActiveSession && !due.length && !nextUnit;

  const brushGlyph = app.manifest.items.find((item) =>
    Boolean(app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')]?.reps),
  )?.content.glyph;

  const weak = useMemo(
    () => weakItems(app.manifest.items, app.snapshot.skillStates),
    [app.manifest.items, app.snapshot.skillStates],
  );
  const weakLine = [
    ...weak.slice(0, 4).map((item) => item.content.glyph),
    ...(weak.length > 4 ? [`+${weak.length - 4}`] : []),
  ].join(' ');

  async function startWeak() {
    const result = await app.startWeakSpots();
    if (result === 'practice') {
      router.push('/practice');
    }
  }

  async function startPrimary() {
    const result = await app.startContinue();
    if (result === 'practice') {
      router.push('/practice');
    }
  }

  function stateFor(item: LearningItem) {
    return app.snapshot.skillStates[learnerStateKey(item.id, 'kana_reading')];
  }

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <View style={styles.headerRow}>
        <Wordmark />
        <AppText variant="meterLabel">{todayChip}</AppText>
      </View>

      <View style={styles.homeHeading}>
        <AppText variant="kicker">Today</AppText>
        <AppText variant="screenTitle">{headline}</AppText>
      </View>

      <View style={styles.primaryCard}>
        <View style={styles.primaryTop}>
          <View style={styles.primaryCopy}>
            <AppText variant="meterLabel">{primary.kicker}</AppText>
            <AppText style={styles.primaryTitle}>{primary.title}</AppText>
          </View>
          <View style={styles.primaryPreview}>
            {primary.preview.slice(0, 4).map((item) => (
              <Kana
                key={item.id}
                style={styles.previewGlyph}
                color={inkColor(stateFor(item))}>
                {item.content.glyph}
              </Kana>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: caughtUp }}
          disabled={caughtUp}
          onPress={startPrimary}
          style={({ pressed }) => [
            styles.primaryFooter,
            pressed && !caughtUp && styles.primaryFooterPressed,
            caughtUp && styles.primaryFooterDisabled,
          ]}>
          <AppText
            variant="button"
            style={caughtUp ? styles.primaryCtaDisabled : styles.primaryCta}>
            {primary.cta}
          </AppText>
          {caughtUp ? null : (
            <AppText style={styles.primaryArrow} aria-hidden>
              →
            </AppText>
          )}
        </Pressable>
      </View>

      {/* Deliberately not the due queue — massed practice on the ones that keep
          slipping. Hidden entirely when there is nothing shaky. */}
      {weak.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void startWeak()}
          style={({ pressed }) => [styles.brushRow, pressed && styles.brushRowPressed]}>
          <View style={styles.weakTile}>
            <AppText style={styles.weakCount}>{weak.length}</AppText>
          </View>
          <View style={styles.brushCopy}>
            <AppText style={styles.brushTitle}>Weak spots</AppText>
            <AppText style={styles.brushLine}>
              The ones you keep missing · {weakLine}
            </AppText>
          </View>
          <AppText style={styles.brushArrow} aria-hidden>
            →
          </AppText>
        </Pressable>
      ) : null}

      {/* Brush practice. Falls through to the lesson when nothing has been met
          yet, rather than opening an empty drawing session. */}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          brushGlyph
            ? router.push({ pathname: '/trace', params: { glyph: brushGlyph } })
            : startPrimary()
        }
        style={({ pressed }) => [styles.brushRow, pressed && styles.brushRowPressed]}>
        <View style={styles.brushTile}>
          <Kana style={styles.brushGlyph}>{brushGlyph ?? 'あ'}</Kana>
        </View>
        <View style={styles.brushCopy}>
          <AppText style={styles.brushTitle}>Brush practice</AppText>
          <AppText style={styles.brushLine}>
            {brushGlyph
              ? `Draw a shape you've met · 2 min`
              : 'Unlocks once you’ve met your first shapes'}
          </AppText>
        </View>
        <AppText style={styles.brushArrow} aria-hidden>
          →
        </AppText>
      </Pressable>

      <View style={styles.divider} />

      <View style={styles.inkHeader}>
        <AppText style={styles.inkTitle}>Your ink</AppText>
        <AppText style={styles.inkCaption}>
          {introduced} of {app.manifest.items.length} · fainter is newer
        </AppText>
      </View>
      <View style={styles.inkStrip}>
        {app.manifest.items.map((item) => (
          <Kana
            key={item.id}
            style={styles.inkStripGlyph}
            color={inkColor(stateFor(item))}>
            {item.content.glyph}
          </Kana>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  steps: {
    flexDirection: 'row',
    gap: 5,
  },
  stepActive: {
    width: 18,
    height: 2,
    backgroundColor: Colors.accent,
  },
  stepIdle: {
    width: 8,
    height: 2,
    backgroundColor: Colors.fieldRule,
  },

  onboardingBody: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.gutter,
    paddingBottom: Spacing.gutter,
  },
  centered: {
    alignSelf: 'center',
  },
  cornerKana: {
    position: 'absolute',
    fontFamily: Fonts.kanaLight,
    fontSize: 44,
    lineHeight: 54,
    color: 'rgba(27, 26, 23, 0.14)',
  },
  cornerKanaTopLeft: {
    left: 26,
    top: 24,
  },
  cornerKanaBottomRight: {
    right: 26,
    bottom: 22,
  },
  copyBlock: {
    gap: Spacing.sm,
  },

  moves: {
    gap: Spacing.stack,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  moveRowEmphasis: {
    borderColor: Colors.ink,
  },
  moveTile: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.small,
    backgroundColor: Colors.paper,
  },
  moveTileEmphasis: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  moveDot: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 14,
    height: 14,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
  },
  moveGlyph: {
    fontSize: 26,
    lineHeight: 32,
  },
  moveGlyphDrawn: {
    color: 'rgba(188, 62, 39, 0.4)',
  },
  moveRomaji: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    lineHeight: 19,
  },
  moveCopy: {
    flex: 1,
  },
  moveTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 23,
  },
  moveBody: {
    marginTop: 2,
  },

  vowelStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.card,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  vowel: {
    alignItems: 'center',
    gap: 3,
  },
  vowelGlyph: {
    fontSize: 32,
    lineHeight: 40,
  },
  vowelRomaji: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
  },
  onboardingActions: {
    gap: 9,
  },

  homeHeading: {
    gap: 9,
    marginTop: Spacing.lg,
    marginBottom: Spacing.card,
  },
  primaryCard: {
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  primaryTop: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.ruleSoft,
  },
  primaryCopy: {
    flex: 1,
    paddingHorizontal: Spacing.card,
    paddingTop: 17,
    paddingBottom: 15,
    gap: 5,
  },
  primaryTitle: {
    fontFamily: Fonts.serif,
    fontSize: 25,
    lineHeight: 29,
  },
  primaryPreview: {
    width: 90,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    alignContent: 'center',
    gap: 2,
    padding: Spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: Colors.ruleSoft,
  },
  previewGlyph: {
    width: 34,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  primaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: Spacing.card,
    paddingVertical: 15,
    backgroundColor: Colors.ink,
  },
  primaryFooterPressed: {
    backgroundColor: Colors.inkPressed,
  },
  primaryFooterDisabled: {
    backgroundColor: Colors.wellFill,
  },
  primaryCta: {
    color: Colors.paper,
  },
  primaryCtaDisabled: {
    color: Colors.inkMuted,
  },
  primaryArrow: {
    fontSize: 18,
    lineHeight: 22,
    color: Colors.peach,
  },

  brushRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: Spacing.stack,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  brushRowPressed: {
    backgroundColor: Colors.wellFill,
  },
  weakTile: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.small,
    backgroundColor: Colors.paper,
  },
  weakCount: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    lineHeight: 17,
    color: Colors.accent,
  },
  brushTile: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.small,
    backgroundColor: Colors.accentSoft,
  },
  brushGlyph: {
    fontSize: 22,
    lineHeight: 28,
    color: 'rgba(188, 62, 39, 0.45)',
  },
  brushCopy: {
    flex: 1,
  },
  brushTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 22,
  },
  brushLine: {
    fontSize: 12.5,
    lineHeight: 17,
    color: Colors.inkMuted,
    marginTop: 1,
  },
  brushArrow: {
    fontSize: 16,
    lineHeight: 20,
    color: Colors.inkMuted,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.rule,
    marginTop: Spacing.md,
    marginBottom: 14,
  },
  inkHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  inkTitle: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 23,
  },
  inkCaption: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
  },
  inkStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
  },
  inkStripGlyph: {
    width: '10%',
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
});
