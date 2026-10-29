import React from 'react';
import { AppState, Platform } from 'react-native';
import { Image as ExpoImage, type ImageProps } from 'expo-image';

/**
 * expo-image, with the app's memory defaults. Every picture in the app goes
 * through here rather than through expo-image directly, so what an image
 * costs is decided in one place.
 *
 * - iOS decodes at the size the picture is drawn, not the size of the file
 *   (`enforceEarlyResizing`). Android's loader already does; iOS kept the
 *   whole 900px upload in memory behind a 40px avatar. Anything that can be
 *   zoomed into passes `enforceEarlyResizing={false}`, or the zoom is a blur.
 *
 * - `small`: a thumbnail, an avatar, a tile — on Android it's decoded at two
 *   bytes a pixel instead of four. Halves its memory; the banding that costs
 *   shows in a sky across a full-width photo, not in a 60px circle, so it's
 *   only for the small ones. Not for anything with transparency.
 */
export function Image({ small, ...props }: ImageProps & { small?: boolean }) {
  return (
    <ExpoImage
      enforceEarlyResizing={Platform.OS === 'ios'}
      decodeFormat={small ? 'rgb' : undefined}
      {...props}
    />
  );
}

/**
 * Once, at launch: a ceiling on the iOS memory cache, which by default has
 * none, and an empty cache whenever the OS says memory's short — the photos
 * are all on disk, so dropping them costs a reload, while holding them costs
 * the app being closed.
 */
export function configureImageMemory() {
  if (Platform.OS === 'ios') {
    try {
      ExpoImage.configureCache({ maxMemoryCost: 96 * 1024 * 1024, maxDiskSize: 512 * 1024 * 1024 });
    } catch {
      // An older native module without it: the defaults stand.
    }
  }
  AppState.addEventListener('memoryWarning', () => {
    ExpoImage.clearMemoryCache().catch(() => {});
  });
}

export { ExpoImage };
