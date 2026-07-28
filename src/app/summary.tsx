import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/Buttons';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppText } from '@/components/Typography';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/AppContext';
import { SessionSummaryRenderer } from '@/modules/registry';

export default function SummaryRoute() {
  const app = useApp();
  const router = useRouter();

  if (!app.ready) {
    return <LoadingScreen />;
  }
  const summary = app.snapshot.lastSummary;
  if (!summary) {
    return (
      <AppScreen scroll={false} contentStyle={styles.fallback}>
        <AppText variant="heading">No completed session yet.</AppText>
        <Button label="Back home" onPress={() => router.replace('/')} />
      </AppScreen>
    );
  }

  async function continueLearning() {
    await app.closeSummary();
    const result = await app.startContinue();
    router.replace(result === 'practice' ? '/practice' : '/');
  }

  async function goHome() {
    await app.closeSummary();
    router.replace('/');
  }

  const moreAvailable = Boolean(app.nextUnitId) || app.dueCount > 0;

  return (
    <AppScreen scroll={false}>
      <SessionSummaryRenderer
        kind={summary.kind}
        outcomes={summary.outcomes}
        actions={
          <>
            {moreAvailable && (
              <Button label="Keep going" onPress={continueLearning} />
            )}
            <Button label="Back home" onPress={goHome} variant="secondary" />
          </>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    gap: Spacing.lg,
  },
});
