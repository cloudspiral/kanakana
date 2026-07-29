// Deep imports, not the package index: importing the index pulls every weight
// and italic into the bundle (~1 MB of DM Sans alone) even though we load three.
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/context/AppContext';
import { Colors } from '@/constants/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    // Subset to the kana ranges — see scripts/subset-kana-fonts.sh. The full
    // faces are 5.2 MB each and this app only ever renders kana.
    NotoSansJP_200ExtraLight: require('../../assets/fonts/NotoSansJP_200ExtraLight-kana.ttf'),
    NotoSansJP_300Light: require('../../assets/fonts/NotoSansJP_300Light-kana.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="practice" options={{ gestureEnabled: false }} />
        {/* Drawing must own the gesture — a back-swipe mid-stroke would be a
            constant misfire. */}
        <Stack.Screen name="trace" options={{ gestureEnabled: false }} />
        <Stack.Screen name="summary" options={{ gestureEnabled: false }} />
        <Stack.Screen name="progress" />
        <Stack.Screen name="settings" />
        <Stack.Screen
          name="demo"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </AppProvider>
  );
}
