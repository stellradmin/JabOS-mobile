import 'react-native-url-polyfill/auto';
import { isStrictSecurity } from './runtime-security';
// Load WebCrypto polyfill only in strict mode (dev/prod builds). Avoid in Expo Go to reduce Metro noise.
if (isStrictSecurity()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native-webcrypto');
  } catch {
    // Polyfill not installed or running in Expo Go/web; ignore.
  }
}
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in your environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
