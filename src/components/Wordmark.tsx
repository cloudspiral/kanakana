import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Kana } from './Typography';
import { appConfig } from '@/constants/config';
import { Colors, Fonts, MinTouch, Radius } from '@/constants/theme';

export function Wordmark() {
  const router = useRouter();
  const demoToolsEnabled = appConfig.demoToolsEnabled;

  return (
    <Pressable
      accessibilityRole={demoToolsEnabled ? 'button' : 'header'}
      accessibilityLabel="Kanakana"
      delayLongPress={650}
      onLongPress={() => {
        if (demoToolsEnabled) {
          router.push('/demo');
        }
      }}
      style={styles.wrap}>
      <View style={styles.mark}>
        <Kana style={styles.markText}>か</Kana>
      </View>
      <AppText style={styles.word}>Kanakana</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    minHeight: MinTouch,
  },
  mark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.small,
    // Accent, not ink. The design README's screen-1 prose says "ink tile", but
    // its own token table lists the logo tile under `accent` and every
    // prototype screen draws it vermillion.
    backgroundColor: Colors.accent,
  },
  markText: {
    color: Colors.paper,
    fontSize: 17,
    lineHeight: 21,
  },
  word: {
    color: Colors.ink,
    fontFamily: Fonts.serif,
    fontSize: 22,
    lineHeight: 26,
  },
});
