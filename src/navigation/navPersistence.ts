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

/**
 * The state as it should be kept: minus the home screen's tab request.
 *
 * The menu opens Events, Marketplace or Groups by navigating to the home
 * screen with `{ tab, at }` params — an instruction, not a place. Kept, it
 * would replay on the next launch and open that tab, where a reload should
 * always land on Your Feed. Walks every nested navigator, since the home
 * screen sits a few levels down.
 */
/**
 * Screens that are a thing being done, not a place: a form opened to make
 * something. Reopening the app onto a half-filled create form — with the
 * camera it was told to raise still in its params — is never where anyone
 * meant to be, so these are dropped from what's kept, along with anything
 * stacked over them.
 */
const TRANSIENT_ROUTES = new Set(['Create', 'ListingCreate', 'DiecastCreate', 'CreateStory', 'StoryDetails']);

function withoutTabRequests(state: any): any {
  if (!state || !Array.isArray(state.routes)) return state;
  const firstTransient = state.routes.findIndex((r: any) => TRANSIENT_ROUTES.has(r.name));
  const kept = firstTransient === -1 ? state.routes : state.routes.slice(0, firstTransient);
  if (kept.length === 0) return undefined;
  const index = typeof state.index === 'number' ? Math.min(state.index, kept.length - 1) : undefined;
  return {
    ...state,
    ...(index != null ? { index } : {}),
    routes: kept.map((route: any) => {
      let next = route;
      if (route.name === 'Feed' && route.params && ('tab' in route.params || 'at' in route.params)) {
        const { tab: _tab, at: _at, spotId: _spotId, ...rest } = route.params;
        next = { ...route, params: Object.keys(rest).length ? rest : undefined };
      }
      return next.state ? { ...next, state: withoutTabRequests(next.state) } : next;
    }),
  };
}

function navFile() {
  return new File(Paths.document, FILENAME);
}

/**
 * Left on disk while a restored state is on trial, and removed once the app
 * has stood on it for a few seconds (`confirmNavState`).
 *
 * Without it a screen that throws when it draws was a trap: the crash took
 * the app down on that screen, the next launch reopened it, and the app
 * never opened again until it was reinstalled. Finding the marker at launch
 * means the last restore never made it, so this one starts on the feed.
 */
const PENDING = 'nav-state.pending';

function pendingFile() {
  return new File(Paths.document, PENDING);
}

export function readNavState(): NavigationState | undefined {
  try {
    const file = navFile();
    if (!file.exists) return undefined;
    const pending = pendingFile();
    if (pending.exists) {
      // The last launch that restored this didn't live to confirm it.
      clearNavState();
      return undefined;
    }
    // Marked stale so the navigator that receives it checks it against its
    // own screens instead of trusting it — if the session expired, that's the
    // sign-in stack, and routes it doesn't have are dropped, not rendered.
    const kept = withoutTabRequests(JSON.parse(file.textSync()));
    if (!kept) return undefined;
    pending.create({ intermediates: true, overwrite: true });
    return { ...kept, stale: true };
  } catch {
    return undefined;
  }
}

export function writeNavState(state: NavigationState | undefined) {
  if (!state) return;
  try {
    const kept = withoutTabRequests(state);
    if (!kept) return;
    const file = navFile();
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(kept));
  } catch {
    // Next change tries again.
  }
}

/** The restored screen drew and held: it's safe to reopen on next time. */
export function confirmNavState() {
  try {
    const pending = pendingFile();
    if (pending.exists) pending.delete();
  } catch {
    // Worst case the next launch opens on the feed.
  }
}

/**
 * On sign-out, so the next account doesn't open on the last one's screens —
 * and after a crash, so the app doesn't reopen onto whatever crashed it.
 */
export function clearNavState() {
  for (const file of [navFile(), pendingFile()]) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Nothing to do — a stale file is only a starting screen.
    }
  }
}
