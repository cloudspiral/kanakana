import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...(appJson.expo as ExpoConfig),
  extra: {
    ...config.extra,
    demoTools: process.env.EXPO_PUBLIC_DEMO_TOOLS === 'true',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
});
