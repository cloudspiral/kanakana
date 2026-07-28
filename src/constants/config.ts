import Constants from 'expo-constants';

interface KanakanaExtra {
  demoTools?: boolean;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as KanakanaExtra;

export const appConfig = {
  demoToolsEnabled:
    process.env.EXPO_PUBLIC_DEMO_TOOLS === 'true' || extra.demoTools === true,
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl,
  supabasePublishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    extra.supabasePublishableKey,
};
