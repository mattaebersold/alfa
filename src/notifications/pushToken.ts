/**
 * This device's push token for the current session.
 *
 * Its own module, with no imports, so the auth slice can read it on sign-out
 * without importing the push hook — which imports the store, which imports
 * the auth slice.
 */
let lastToken: string | null = null;

export function currentPushToken(): string | null {
  return lastToken;
}

export function setCurrentPushToken(token: string | null): void {
  lastToken = token;
}
