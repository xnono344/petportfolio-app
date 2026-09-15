import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Low-level SecureStore primitives (iOS Keychain / Android Keystore).
 *
 * expo-secure-store is the project's designated encrypted-secret backend per
 * the ECC security rules: "Secure persistence: expo-secure-store". Keys are used
 * verbatim here; callers apply their own namespacing prefix.
 */
export function secureGet(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export function secureSet(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value);
}

export function secureRemove(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key);
}

const SUPABASE_PREFIX = 'sb.secure.';

/**
 * Supabase-compatible auth storage adapter backed by expo-secure-store.
 *
 * Session tokens (the JWT access token and the refresh token Supabase persists
 * under `supabase.auth.token`) are secrets. They MUST be written to the OS
 * Keychain / Android Keystore, never to AsyncStorage, which is world-readable
 * on a rooted/jailbroken device. This adapter satisfies the
 * `StorageLike` shape expected by `createClient` (`getItem`/`setItem`/`removeItem`
 * returning promises) and namespaces its keys so they never collide with the
 * `pp.local.` keys used by `localStore`.
 */
export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => secureGet(SUPABASE_PREFIX + key),
  setItem: async (key: string, value: string): Promise<void> =>
    secureSet(SUPABASE_PREFIX + key, value),
  removeItem: async (key: string): Promise<void> => secureRemove(SUPABASE_PREFIX + key),
};

// Legacy AsyncStorage key Supabase wrote under the old `storage: AsyncStorage`
// configuration (no prefix, the Supabase default).
const LEGACY_SESSION_KEY = 'supabase.auth.token';

/**
 * One-time migration of a session token left in AsyncStorage by the legacy
 * insecure configuration. Moves the value into SecureStore and removes the
 * plaintext copy so a live session token is not recoverable from AsyncStorage
 * after the upgrade. Best-effort: a failure only forces a re-sign-in.
 */
export async function migrateLegacySession(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
    if (legacy != null) {
      await secureSet(SUPABASE_PREFIX + LEGACY_SESSION_KEY, legacy);
      await AsyncStorage.removeItem(LEGACY_SESSION_KEY);
    }
  } catch {
    // Migration is best-effort; a failure here just means the user re-authenticates.
  }
}
