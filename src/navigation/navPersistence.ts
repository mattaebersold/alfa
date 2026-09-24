import { File, Paths } from 'expo-file-system';
import type { NavigationState } from '@react-navigation/native';

/**
 * Where you were in the app, kept on the device so a reload or a cold start
 * reopens there instead of on the home feed.
 *
 * A file rather than SecureStore: a navigation state with a few stacks open
 * runs past the couple of kilobytes the keychain is happy holding, and nothing
 * in it is secret — screen names and the ids in their params.
 *
 * Every call swallows its own failure. Losing your place is the worst case,
 * and a broken or half-written file must never be why the app won't open.
 */
const FILENAME = 'nav-state.json';

function navFile() {
  return new File(Paths.document, FILENAME);
}

export function readNavState(): NavigationState | undefined {
  try {
    const file = navFile();
    if (!file.exists) return undefined;
    // Marked stale so the navigator that receives it checks it against its
    // own screens instead of trusting it — if the session expired, that's the
    // sign-in stack, and routes it doesn't have are dropped, not rendered.
    return { ...JSON.parse(file.textSync()), stale: true };
  } catch {
    return undefined;
  }
}

export function writeNavState(state: NavigationState | undefined) {
  if (!state) return;
  try {
    const file = navFile();
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(state));
  } catch {
    // Next change tries again.
  }
}

/** On sign-out, so the next account doesn't open on the last one's screens. */
export function clearNavState() {
  try {
    const file = navFile();
    if (file.exists) file.delete();
  } catch {
    // Nothing to do — a stale file is only a starting screen.
  }
}
