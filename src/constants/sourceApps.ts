import { Linking, Platform } from 'react-native';
import { COLOR_GRAY_17, COLOR_SOURCE_APP_ACCENT, COLOR_SPOTTER_GREEN } from './config';

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
    tile: COLOR_GRAY_17,
    accent: COLOR_SOURCE_APP_ACCENT,
  },
  spot: {
    id: 'spot',
    name: 'Car Spotter',
    scheme: 'orsspot://',
    // Always today's puzzle — yesterday's result is already on the post, and
    // the thing worth sending someone to is the one they can still play.
    deepLink: () => 'orsspot://play',
    // The store listings: App Store id from spot's eas.json (ascAppId), the
    // Play package from its app.json.
    fallback: {
      ios: 'https://apps.apple.com/app/id6815379055',
      android: 'https://play.google.com/store/apps/details?id=co.openroadsociety.spot',
    },
    tile: COLOR_SPOTTER_GREEN,
    accent: COLOR_SPOTTER_GREEN,
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
/**
 * One of Car Spotter's three games, today's — `orsspot://play/trivia`. The
 * store page instead when the app isn't on the phone, like openSourceApp.
 */
export function openSpotGame(game: 'car' | 'trivia' | 'auction'): Promise<void> {
  return openSourceApp({ ...SOURCE_APPS.spot, deepLink: () => `orsspot://play/${game}` });
}

export async function openSourceApp(app: SourceApp, sourceId?: string | null): Promise<void> {
  try {
    await Linking.openURL(app.deepLink(sourceId));
  } catch {
    Linking.openURL(sourceAppFallback(app)).catch(() => {});
  }
}
