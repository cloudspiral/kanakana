import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Surface } from '@/components/Surface';
import { AppText } from '@/components/Typography';
import { Colors, Spacing } from '@/constants/theme';
import { appConfig } from '@/constants/config';
import { useApp } from '@/context/AppContext';

export default function DemoRoute() {
  const app = useApp();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!appConfig.demoToolsEnabled) {
    return (
      <AppScreen scroll={false} contentStyle={styles.centered}>
        <AppText variant="heading">Demo tools are disabled.</AppText>
        <Button label="Close" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  if (!app.ready) {
    return <LoadingScreen />;
  }

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await app.refreshDiagnostics();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function syncFromPanel() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await app.syncNow();
      setMessage(
        `Accepted ${result.accepted}; ${result.pending} still pending.`,
      );
      await app.refreshDiagnostics();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Sync failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppScreen>
      <View style={styles.header}>
        <View>
          <AppText variant="eyebrow">Demo mode</AppText>
          <AppText variant="title">Presenter tools</AppText>
        </View>
        <Button label="Close" onPress={() => router.back()} variant="link" />
      </View>

      <Surface style={styles.section}>
        <AppText variant="heading">Scenarios</AppText>
        <AppText variant="caption">
          These controls are compiled out of the ordinary experience unless the
          demo environment flag is enabled.
        </AppText>
        <Button
          disabled={busy}
          label="Fresh guest"
          onPress={() =>
            void run(
              async () => {
                await app.freshGuest();
                router.replace('/');
              },
              'Created a fresh guest.',
            )
          }
          variant="secondary"
        />
        <Button
          disabled={busy}
          label="Seed returning learner"
          onPress={() =>
            void run(
              async () => {
                await app.seedReturningLearner();
              },
              'Seeded mixed learning and due states.',
            )
          }
          variant="secondary"
        />
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="heading">Synchronization</AppText>
        <Button
          disabled={busy}
          label="Sync now"
          onPress={() => void syncFromPanel()}
        />
        {message && <AppText color={Colors.ink}>{message}</AppText>}
      </Surface>

      <Surface style={styles.section}>
        <AppText variant="heading">Diagnostics</AppText>
        <Diagnostic label="Guest ID" value={app.snapshot.sync.guestId ?? 'Local only'} />
        <Diagnostic label="Manifest" value={`v${app.manifest.version} · ${app.manifest.id}`} />
        <Diagnostic
          label="Local database"
          value={
            app.repositoryDiagnostics
              ? `${app.repositoryDiagnostics.adapter} · ${app.repositoryDiagnostics.status}`
              : 'Checking'
          }
        />
        <Diagnostic
          label="Pending reviews"
          value={String(app.snapshot.reviewOutbox.length)}
        />
        <Diagnostic
          label="Pending drawings"
          value={String(app.snapshot.drawingOutbox.length)}
        />
        <Diagnostic
          label="Last sync"
          value={
            app.snapshot.sync.lastSyncAt
              ? new Date(app.snapshot.sync.lastSyncAt).toLocaleString()
              : 'Never'
          }
        />
        <Diagnostic label="Cloud" value={app.snapshot.sync.cloudStatus} />
        {app.snapshot.sync.lastError && (
          <Diagnostic
            label="Last cloud error"
            value={app.snapshot.sync.lastError}
          />
        )}
      </Surface>
    </AppScreen>
  );
}

function Diagnostic({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnostic}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={styles.diagnosticValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  diagnostic: {
    gap: Spacing.xxs,
    paddingBottom: Spacing.sm,
    borderBottomColor: Colors.rule,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  diagnosticValue: {
    fontSize: 14,
  },
});
