import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Wordmark } from '@/components/Wordmark';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

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

function Onboarding() {
  const app = useApp();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const vowelItems = app.manifest.items.filter(
    (item) => item.content.rowId === 'vowels',
  );

  async function begin() {
    await app.completeOnboarding();
    await app.startUnit('unit-vowels');
    router.push('/practice');
  }

  return (
    <AppScreen scroll={false}>
      <View style={styles.onboardingHeader}>
        <Wordmark />
        <View style={styles.pageDots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={[styles.dot, page === 1 && styles.dotActive]} />
        </View>
      </View>
      {page === 0 ? (
        <View style={styles.onboardingBody}>
          <LinearGradient
            colors={[Colors.ink, '#29365C']}
            style={styles.heroArt}>
            <AppText style={styles.heroKana}>あ</AppText>
            <View style={[styles.orbit, styles.orbitOne]}>
              <AppText style={styles.orbitKana}>か</AppText>
            </View>
            <View style={[styles.orbit, styles.orbitTwo]}>
              <AppText style={styles.orbitKana}>ら</AppText>
            </View>
            <View style={styles.pinkGlow} />
          </LinearGradient>
          <View style={styles.onboardingCopy}>
            <AppText variant="eyebrow">Read Japanese from day one</AppText>
            <AppText variant="hero">
              Learn kana that{'\n'}actually sticks.
            </AppText>
            <AppText color={Colors.inkMuted}>
              Short introductions build recognition. Smart reviews bring each
              character back just before you forget it.
            </AppText>
          </View>
          <Button label="See how it works" onPress={() => setPage(1)} />
        </View>
      ) : (
        <View style={styles.onboardingBody}>
          <View style={styles.onboardingCopy}>
            <AppText variant="eyebrow">Your first five</AppText>
            <AppText variant="title">Start with the sounds everything builds on.</AppText>
            <AppText color={Colors.inkMuted}>
              Meet a few kana, recall them, then add more. Misses return after a
              little space—never as a punishment, always as useful practice.
            </AppText>
          </View>
          <Surface style={styles.vowels}>
            {vowelItems.map((item) => (
              <View key={item.id} style={styles.vowel}>
                <AppText style={styles.vowelGlyph}>{item.content.glyph}</AppText>
                <AppText variant="caption">{item.content.primaryAnswer}</AppText>
              </View>
            ))}
          </Surface>
          <View style={styles.onboardingActions}>
            <Button label="Begin with vowels" onPress={begin} />
            <Button label="Back" onPress={() => setPage(0)} variant="quiet" />
          </View>
        </View>
      )}
    </AppScreen>
  );
}

function Home() {
  const app = useApp();
  const router = useRouter();
  const nextUnit = app.manifest.units.find(
    (unit) => unit.id === app.nextUnitId,
  );
  const startedCount = Object.values(app.snapshot.skillStates).filter(
    (state) => state.reps > 0,
  ).length;
  const hasActiveSession = Boolean(app.activeSession);
  const complete = !app.nextUnitId && app.dueCount === 0 && !hasActiveSession;

  const primaryLabel = hasActiveSession
    ? 'Resume practice'
    : app.dueCount > 0
      ? `Review ${app.dueCount} ${app.dueCount === 1 ? 'kana' : 'kana'}`
      : nextUnit
        ? `Continue with ${nextUnit.shortTitle}`
        : 'You’re caught up';

  async function continueLearning() {
    const result = await app.startContinue();
    if (result === 'practice') {
      router.push('/practice');
    }
  }

  const learnedPercent = Math.round(
    (startedCount / app.manifest.items.length) * 100,
  );

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <Wordmark />
      <View style={styles.homeHeading}>
        <AppText variant="eyebrow">Today’s path</AppText>
        <AppText variant="title">
          {app.dueCount > 0
            ? 'A few sounds are ready to return.'
            : nextUnit
              ? 'Keep building your hiragana.'
              : 'The full hiragana set is underway.'}
        </AppText>
      </View>

      <LinearGradient
        colors={[Colors.ink, '#24325B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.continueCard}>
        <View style={styles.continueTop}>
          <View>
            <AppText style={styles.continueEyebrow}>
              {hasActiveSession
                ? 'In progress'
                : app.dueCount > 0
                  ? 'Due reviews first'
                  : complete
                    ? 'All rows introduced'
                    : 'Next lesson'}
            </AppText>
            <AppText style={styles.continueTitle}>{primaryLabel}</AppText>
          </View>
          <View style={styles.continueKana}>
            <AppText style={styles.continueKanaText}>
              {app.dueCount > 0 ? '復' : nextUnit ? nextUnit.shortTitle[0] : '✓'}
            </AppText>
          </View>
        </View>
        <AppText style={styles.continueDescription}>
          {app.dueCount > 0
            ? 'Your review queue mixes rows and keeps repeated prompts apart.'
            : complete
              ? 'Come back when the scheduler marks a sound ready for review.'
              : 'A focused introduction followed by cumulative recall.'}
        </AppText>
        <Pressable
          accessibilityRole="button"
          disabled={complete}
          onPress={continueLearning}
          style={[styles.continueButton, complete && styles.disabled]}>
          <AppText style={styles.continueButtonText}>
            {hasActiveSession ? 'Resume' : app.dueCount > 0 ? 'Start review' : 'Continue'}
          </AppText>
          {!complete && <AppText style={styles.arrow}>→</AppText>}
        </Pressable>
      </LinearGradient>

      <View style={styles.snapshotHeader}>
        <AppText variant="heading">Your hiragana</AppText>
        <Pressable onPress={() => router.push('/progress')}>
          <AppText color={Colors.blue}>View grid</AppText>
        </Pressable>
      </View>
      <Surface style={styles.snapshotCard}>
        <View style={styles.metric}>
          <AppText variant="title">{startedCount}</AppText>
          <AppText variant="caption">of 46 introduced</AppText>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metric}>
          <AppText variant="title">{app.dueCount}</AppText>
          <AppText variant="caption">ready now</AppText>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${learnedPercent}%` }]}
          />
        </View>
      </Surface>
      <AppText variant="caption" style={styles.offlineNote}>
        Saved on this device · learning continues without a connection
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: Colors.blue,
  },
  onboardingBody: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  heroArt: {
    height: 270,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  heroKana: {
    color: Colors.white,
    fontFamily: Fonts.japanese,
    fontSize: 136,
    lineHeight: 160,
  },
  orbit: {
    position: 'absolute',
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
  },
  orbitOne: {
    left: 34,
    top: 35,
    transform: [{ rotate: '-8deg' }],
  },
  orbitTwo: {
    right: 35,
    bottom: 33,
    transform: [{ rotate: '8deg' }],
  },
  orbitKana: {
    color: Colors.white,
    fontFamily: Fonts.japanese,
    fontSize: 30,
  },
  pinkGlow: {
    position: 'absolute',
    right: -28,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(233,30,140,0.35)',
  },
  onboardingCopy: {
    gap: Spacing.sm,
  },
  onboardingActions: {
    gap: Spacing.xs,
  },
  vowels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  vowel: {
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  vowelGlyph: {
    fontFamily: Fonts.japanese,
    fontSize: 38,
    lineHeight: 50,
  },
  homeHeading: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  continueCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
    overflow: 'hidden',
  },
  continueTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  continueEyebrow: {
    color: '#B9C5F9',
    fontFamily: Fonts.headingSemi,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  continueTitle: {
    color: Colors.white,
    fontFamily: Fonts.heading,
    fontSize: 24,
    lineHeight: 32,
    marginTop: Spacing.xxs,
  },
  continueKana: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  continueKanaText: {
    color: Colors.white,
    fontFamily: Fonts.japanese,
    fontSize: 28,
  },
  continueDescription: {
    color: '#D6DDF8',
    fontSize: 14,
    lineHeight: 22,
  },
  continueButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
  },
  continueButtonText: {
    color: Colors.blue,
    fontFamily: Fonts.headingSemi,
  },
  arrow: {
    color: Colors.pink,
    fontFamily: Fonts.heading,
    fontSize: 22,
  },
  disabled: {
    opacity: 0.5,
  },
  snapshotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  snapshotCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.border,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    marginTop: Spacing.lg,
    overflow: 'hidden',
    borderRadius: Radius.pill,
    backgroundColor: Colors.paleBlue,
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.blue,
  },
  offlineNote: {
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
