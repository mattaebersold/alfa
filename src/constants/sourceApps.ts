import { Linking, Platform } from 'react-native';

/**
 * The sibling apps a post can have been shared from.
 *
 * ORS Photo and Car Spotter both post into the ORS feed (see kit's
 * API_CONTRACT §2): the post carries `source_app` and `source_id`, and the feed
 * draws a small chip that hops back into the app it came from. Everything the
 * chip needs to know about each app lives here, so the card, the detail screen
 * and the spot-result body all agree on where "open in the app" goes.
 */

export type SourceAppId = 'photo' | 'spot';

export interface SourceApp {
  id: SourceAppId;
  /** As it's written in "Shared from …". */
  name: string;
  /** The URL scheme, for reference and for LSApplicationQueriesSchemes in app.json. */
  scheme: string;
  /**
   * Where to land inside the app. Takes the post's `source_id`, which not every
   * app needs — Car Spotter only ever has today's puzzle to open.
   */
  deepLink: (sourceId?: string | null) => string;
  /**
   * Where to go when the app isn't installed. Per platform so each can point at
   * its own store listing once there is one.
   *
   * TODO: replace with the real App Store / Play Store listings when the apps
   * ship. Until then both point at a landing page on the site.
   */
  fallback: { ios: string; android: string };
  /** The tile the app's icon sits on, and its accent. */
  tile: string;
  accent: string;
}

export const SOURCE_APPS: Record<SourceAppId, SourceApp> = {
  photo: {
    id: 'photo',
    name: 'ORS Photo',
    scheme: 'orsphoto://',
    // A gallery has an id to open; without one, the app's own home is the best
    // place to land.
    deepLink: (id) => (id ? `orsphoto://gallery/${encodeURIComponent(id)}` : 'orsphoto://'),
    fallback: {
      ios: 'https://openroadsociety.co/apps/photo',     // TODO: App Store URL
      android: 'https://openroadsociety.co/apps/photo', // TODO: Play Store URL
    },
    tile: '#111111',
    accent: '#E0B252',
  },
  spot: {
    id: 'spot',
    name: 'Car Spotter',
    scheme: 'orsspot://',
    // Always today's puzzle — yesterday's result is already on the post, and
    // the thing worth sending someone to is the one they can still play.
    deepLink: () => 'orsspot://play',
    fallback: {
      ios: 'https://openroadsociety.co/apps/spot',      // TODO: App Store URL
      android: 'https://openroadsociety.co/apps/spot',  // TODO: Play Store URL
    },
    tile: '#2FA84F',
    accent: '#2FA84F',
  },
};

/** Narrows whatever the server sent to an app we know how to draw. */
export function sourceAppFor(id?: string | null): SourceApp | null {
  return id && id in SOURCE_APPS ? SOURCE_APPS[id as SourceAppId] : null;
}

export function sourceAppFallback(app: SourceApp): string {
  return Platform.OS === 'android' ? app.fallback.android : app.fallback.ios;
}

/**
 * Open the post's source app, or its store/site page when it isn't installed.
 *
 * Tries the deep link outright rather than asking `canOpenURL` first. On iOS
 * that needs the scheme listed in LSApplicationQueriesSchemes (it is — see
 * app.json), but on Android 11+ it needs a `<queries>` entry per scheme too, and
 * without one it answers "no" even when the app is right there. `openURL`
 * rejects on both platforms when nothing handles the link, which is the only
 * answer we actually need.
 */
export async function openSourceApp(app: SourceApp, sourceId?: string | null): Promise<void> {
  try {
    await Linking.openURL(app.deepLink(sourceId));
  } catch {
    Linking.openURL(sourceAppFallback(app)).catch(() => {});
  }
}
