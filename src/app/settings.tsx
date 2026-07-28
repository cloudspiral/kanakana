import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Wordmark } from '@/components/Wordmark';
import { Colors, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

export default function SettingsRoute() {
  const app = useApp();
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!app.ready) {
    return <LoadingScreen />;
  }

  async function reset() {
    await app.resetProgress();
    setConfirmingReset(false);
  }

  return (
    <AppScreen bottomNav={<BottomNav />}>
      <Wordmark />
      <View style={styles.heading}>
        <AppText variant="eyebrow">Settings</AppText>
        <AppText variant="title">A focused learning space</AppText>
      </View>

      <Surface style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingCopy}>
            <AppText variant="heading">Haptic feedback</AppText>
            <AppText variant="caption">
              A subtle confirmation after each answer on supported devices.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Haptic feedback"
            onValueChange={(value) => void app.setHaptics(value)}
            trackColor={{ false: Colors.border, true: '#AAB9F5' }}
            thumbColor={
              app.snapshot.settings.hapticsEnabled ? Colors.blue : Colors.white
            }
            value={app.snapshot.settings.hapticsEnabled}
          />
        </View>
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="heading">How Kanakana works</AppText>
        <AppText color={Colors.inkMuted}>
          Each kana and skill has its own memory schedule. Correct recall
          strengthens that connection; misses return sooner. Lesson rows organize
          first exposure, but reviews are never tied together afterward.
        </AppText>
        <View style={styles.divider} />
        <AppText variant="caption">
          V1 teaches the 46 basic modern hiragana through kana reading: see a
          glyph and type its romaji.
        </AppText>
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="heading">Progress data</AppText>
        <AppText variant="caption">
          Your learning state is stored locally and continues offline.
        </AppText>
        {confirmingReset ? (
          <View style={styles.confirm}>
            <AppText color={Colors.red}>
              Reset all introduced kana, review history, and active practice on
              this device?
            </AppText>
            <Button label="Reset progress" onPress={reset} variant="danger" />
            <Button
              label="Cancel"
              onPress={() => setConfirmingReset(false)}
              variant="quiet"
            />
          </View>
        ) : (
          <Button
            label="Reset progress"
            onPress={() => setConfirmingReset(true)}
            variant="secondary"
          />
        )}
      </Surface>

      <AppText variant="caption" style={styles.version}>
        Kanakana MVP · Curriculum v{app.manifest.version}
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  settingCopy: {
    flex: 1,
    gap: Spacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  confirm: {
    gap: Spacing.sm,
  },
  version: {
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
