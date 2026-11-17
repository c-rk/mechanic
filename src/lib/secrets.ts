import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * API keys never enter the main data store or backups.
 * iOS/Android: Keychain / Keystore via expo-secure-store.
 * Web: localStorage of this browser profile (browsers have no keychain API).
 */
const KEY = 'bayone.ai.key';

export async function getApiKey(): Promise<string> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? '';
  return (await SecureStore.getItemAsync(KEY)) ?? '';
}

export async function setApiKey(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (value) globalThis.localStorage?.setItem(KEY, value);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (value) await SecureStore.setItemAsync(KEY, value);
  else await SecureStore.deleteItemAsync(KEY);
}
