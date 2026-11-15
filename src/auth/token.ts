import * as SecureStore from 'expo-secure-store';

/**
 * The session token, per app.
 *
 * Each app has its own keychain sandbox, so signing in to the photo app never
 * signs anyone in to alfa or the spotting game — the same credentials work in
 * all three, but each is a separate sign-in.
 */
const TOKEN_KEY = 'userToken';

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
