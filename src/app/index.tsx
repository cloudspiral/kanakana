import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { bareRowLabel } from '@/domain/curriculum';
import { reviewTargetKey } from '@/domain/session';
import { type CurriculumUnit, type LearningItem } from '@/domain/types';

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
    <AppScreen scroll={page === 0}>
      <View style={styles.headerRow}>
        <Wordmark />
        <StepIndicator step={page} />
      </View>

      {page === 0 ? (
        <View style={[styles.onboardingBody, styles.firstOnboardingBody]}>
          {/* A shallow full-width banner leaves room for the longer welcome
              copy. Practice screens are the ones that use a true square. */}
          <GuideSquare
            size={190}
            width="100%"
            chip={{ label: 'a', tone: 'accent', corner: 'bottomRight' }}
            overlay={
              <>
                <Kana style={[styles.cornerKana, styles.cornerKanaTopLeft]}>か</Kana>
                <Kana style={[styles.cornerKana, styles.cornerKanaBottomRight]}>ら</Kana>
              </>
            }>
            <Kana style={styles.onboardingHeroKana}>あ</Kana>
          </GuideSquare>

          <View style={styles.copyBlock}>
            <AppText variant="display">Meet the kana</AppText>
            <AppText variant="body" color={Colors.inkMuted}>
              More than most languages, learning Japanese is a journey through
              symbols. Thousands upon thousands of them. The acquisition and
              retention of these symbols is, for those of us in the
              English-speaking world, not something our ABCs prepared us for.
              {'\n\n'}
              But every journey through these symbols begins with the kana, a
              set of 46 glyphs that represent 46 basic sounds. Though this
              syllabary is not much bigger than the English alphabet, the relationship you develop with them is quite
              different. Like any bonds, these are stronger through
              adversity, and they will be your anchors in the
              vast sea of complex symbols that further awaits.
              {'\n\n'}
              Most of us don&rsquo;t remember what it felt like to learn our ABCs
              for the first time. With Kanakana, I hope you too can experience
              the magic of getting to know a group of symbols for the first time
              again. Wherever your Japanese journey ends up taking you, you have
              come to the right place to begin.
            </AppText>
          </View>

          <Button label="See how it works" arrow onPress={() => setPage(1)} />
        </View>
      ) : (
        <View style={styles.onboardingBody}>
          <View style={styles.copyBlock}>
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
              body="Misses come back right before you're about to forget them."
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

          <Button label="Begin with the five vowels" arrow onPress={begin} />
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

  // Both skills: the count, the preview and the queue "Begin review" builds
  // must agree, and a character can be due for writing but not reading.
  const dueReviewTargets = app.dueReviewTargets;
  const dueReviewPreview = dueReviewTargets.map((target) => ({
    key: reviewTargetKey(target),
    item: target.item,
  }));
  const dueReviewCount = dueReviewTargets.length;
  const reviewNoun = dueReviewCount === 1 ? 'review' : 'reviews';

  const nextUnit = app.manifest.units.find((unit) => unit.id === app.nextUnitId);
  const nextRowItems = nextUnit ? unitItems(nextUnit, app.manifest.items) : [];
  // Bare, because the copy below already supplies the word "row".
  const nextRowLabel = bareRowLabel(
    nextRowItems[0]?.content.rowLabel ?? nextUnit?.shortTitle ?? '',
  );

  const hasActiveSession = Boolean(app.activeSession);
  const weekday = new Date()
    .toLocaleDateString(undefined, { weekday: 'short' })
    .toUpperCase();
  const reviewChip = dueReviewCount
    ? `${weekday} · ${dueReviewCount} ${reviewNoun}`
    : `${weekday} · all clear`;

  // An unfinished session is what the card offers, so the headline says so too
  // rather than inviting a row the tap will not open.
  const headline = hasActiveSession
    ? 'Right where you left off.'
    : dueReviewCount
      ? `${dueReviewCount} ${reviewNoun} ${dueReviewCount === 1 ? 'is' : 'are'} ready.`
      : nextUnit
        ? `You're all caught up for today.`
        : 'Every kana is in your ink.';

  // Mirrors startContinue(): due reviews first, then the next row.
  const primary = hasActiveSession
    ? {
        kicker: 'In progress',
        title: 'Pick up where you stopped',
        cta: 'Resume practice',
        preview: dueReviewCount
          ? dueReviewPreview
          : nextRowItems.map((item) => ({ key: item.id, item })),
      }
    : dueReviewCount
      ? {
          kicker: 'Review first',
          title: `${dueReviewCount} ${reviewNoun}, about ${Math.max(2, Math.round(dueReviewCount * 0.6))} minutes`,
          cta: 'Begin review',
          preview: dueReviewPreview,
        }
      : nextUnit
        ? {
            kicker: 'Study ahead',
            title: `Meet ${nextRowItems.length} new kana in the ${nextRowLabel} row`,
            cta: 'Meet the next row',
            preview: nextRowItems.map((item) => ({ key: item.id, item })),
          }
        : {
            kicker: 'All met',
            title: 'Every kana is in your ink',
            cta: 'Review when something returns',
            preview: app.manifest.items
              .slice(0, 4)
              .map((item) => ({ key: item.id, item })),
          };

  const caughtUp = !hasActiveSession && !dueReviewCount && !nextUnit;

  async function startPrimary() {
    const result = await app.startContinue();
    if (result === 'practice') {
      router.push('/practice');
    }
  }

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <View style={styles.headerRow}>
        <Wordmark />
        <AppText variant="meterLabel">{reviewChip}</AppText>
      </View>

      <View style={styles.homeHeading}>
        <AppText variant="kicker">Review</AppText>
        <AppText variant="screenTitle">{headline}</AppText>
      </View>

      <View style={styles.primaryCard}>
        <View style={styles.primaryTop}>
          <View style={styles.primaryCopy}>
            <AppText variant="meterLabel">{primary.kicker}</AppText>
            <AppText style={styles.primaryTitle}>{primary.title}</AppText>
          </View>
          <View style={styles.primaryPreview}>
            {primary.preview.slice(0, 4).map((preview) => (
              <Kana key={preview.key} style={styles.previewGlyph}>
                {preview.item.content.glyph}
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

      {/* The scheduler owns what comes next. Drawing a specific character is
          still available from its kana-chart profile, but Review does not ask
          the learner to construct a second queue. */}
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
  firstOnboardingBody: {
    justifyContent: 'flex-start',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  onboardingHeroKana: {
    fontFamily: Fonts.kanaThin,
    fontSize: 128,
    lineHeight: 128,
  },
  cornerKana: {
    position: 'absolute',
    fontFamily: Fonts.kanaLight,
    fontSize: 36,
    lineHeight: 44,
    color: 'rgba(27, 26, 23, 0.14)',
  },
  cornerKanaTopLeft: {
    left: 22,
    top: 18,
  },
  cornerKanaBottomRight: {
    right: 22,
    bottom: 16,
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

});
