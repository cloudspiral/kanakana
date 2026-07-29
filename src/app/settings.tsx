import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { BottomNav } from '@/components/BottomNav';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText } from '@/components/Typography';
import { Colors, Fonts, MinTouch, Radius, Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';

function Toggle({ value }: { value: boolean }) {
  return (
    <View style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </View>
  );
}

function SettingRow({
  title,
  body,
  value,
  onToggle,
  last = false,
}: {
  title: string;
  body: string;
  value: boolean;
  onToggle: (next: boolean) => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
      onPress={() => onToggle(!value)}
      style={[styles.settingRow, last && styles.settingRowLast]}>
      <View style={styles.settingCopy}>
        <AppText style={styles.rowTitle}>{title}</AppText>
        <AppText style={styles.rowBody}>{body}</AppText>
      </View>
      <Toggle value={value} />
    </Pressable>
  );
}

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
      <AppText variant="kicker">You</AppText>
      <AppText style={styles.title}>A quiet place to practise</AppText>

      <View style={styles.card}>
        <SettingRow
          title="Play sounds"
          body="Hear each kana when it appears."
          value={app.snapshot.settings.soundEnabled}
          onToggle={(next) => void app.updateSettings({ soundEnabled: next })}
        />
        <SettingRow
          title="Haptic feedback"
          body="A subtle confirmation after each answer, on devices that support it."
          value={app.snapshot.settings.hapticsEnabled}
          onToggle={(next) => void app.updateSettings({ hapticsEnabled: next })}
        />
        <SettingRow
          title="Tracing guide"
          body="Show the faint kana underneath while you draw. Turn it off when you're ready to write from memory."
          value={app.snapshot.settings.tracingGuideEnabled}
          onToggle={(next) => void app.updateSettings({ tracingGuideEnabled: next })}
        />
        <View style={styles.explainer}>
          <AppText style={styles.rowTitle}>How this works</AppText>
          <AppText style={styles.explainerBody}>
            Every kana carries its own schedule, and reading and writing are
            tracked separately — you can recognise ら long before you can write
            it. Rows only group first meetings; after that each kana comes back
            on its own clock.
          </AppText>
        </View>
      </View>

      {confirmingReset ? (
        <View style={styles.confirm}>
          <AppText variant="bodySmall">
            Reset all introduced kana, review history, and active practice on this
            device?
          </AppText>
          <Button label="Reset progress" onPress={reset} variant="secondary" />
          <Button
            label="Cancel"
            onPress={() => setConfirmingReset(false)}
            variant="link"
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmingReset(true)}
          style={styles.resetRow}>
          <AppText style={styles.resetLabel}>
            Start again from the beginning
          </AppText>
          <AppText style={styles.resetLabel} aria-hidden>
            ↻
          </AppText>
        </Pressable>
      )}

      {/* A visible credit and a link back is the condition Kaori sensei asked
          for in granting these recordings. See
          assets/audio/kana/ATTRIBUTION.md — do not remove this. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL('https://linkupnippon.com/table-of-hiragana/')}
        style={styles.creditRow}>
        <AppText style={styles.creditLabel}>
          Pronunciation recorded by Kaori sensei
        </AppText>
        <AppText style={styles.creditLink}>linkupnippon.com</AppText>
      </Pressable>

      <AppText style={styles.footer}>
        Kanakana · hiragana · katakana coming
      </AppText>
      <AppText style={styles.version}>Curriculum v{app.manifest.version}</AppText>
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
  card: {
    marginTop: Spacing.card,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.card,
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: Colors.ruleSoft,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingCopy: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: Fonts.serif,
    fontSize: 18,
    lineHeight: 22,
    color: Colors.ink,
  },
  rowBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  explainer: {
    paddingHorizontal: Spacing.card,
    paddingVertical: 17,
  },
  explainerBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.inkMuted,
    marginTop: 6,
  },

  track: {
    width: 44,
    height: 26,
    borderRadius: Radius.pill,
  },
  trackOn: {
    backgroundColor: Colors.ink,
  },
  trackOff: {
    backgroundColor: Colors.fieldRule,
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
  },
  knobOn: {
    left: 21,
  },
  knobOff: {
    left: 3,
  },

  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MinTouch,
    marginTop: Spacing.stack,
    paddingHorizontal: Spacing.card,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },
  resetLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.accent,
  },
  confirm: {
    gap: Spacing.sm,
    marginTop: Spacing.stack,
    padding: Spacing.card,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
  },

  creditRow: {
    marginTop: Spacing.stack,
    paddingHorizontal: Spacing.card,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.rect,
    backgroundColor: Colors.card,
    gap: 2,
  },
  creditLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.ink,
  },
  creditLink: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.accent,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
    marginTop: Spacing.md,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: Colors.inkMuted,
    marginTop: Spacing.xxs,
  },
});
