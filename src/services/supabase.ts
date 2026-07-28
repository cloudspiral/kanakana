import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { authStorage } from './authStorage';
import { appConfig } from '@/constants/config';

const supabaseUrl = appConfig.supabaseUrl;
const supabasePublishableKey = appConfig.supabasePublishableKey;

export const isCloudConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export async function ensureAnonymousUser(): Promise<string | undefined> {
  if (!supabase) {
    return undefined;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user.id) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return user.id;
    }

    // Local auth can outlive a user removed during a backend reset.
    await supabase.auth.signOut({ scope: 'local' });
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    throw error;
  }
  return data.user?.id;
}
