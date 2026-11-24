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
  const uri = sourceUri(props.source);
  const seen = uri ? shownUris.has(uri) : false;
  const { onLoad } = props;
  return (
    <ExpoImage
      enforceEarlyResizing={Platform.OS === 'ios'}
      decodeFormat={small ? 'rgb' : undefined}
      {...props}
      // A picture already shown this session draws at once. expo-image fades
      // every load in, even one straight from memory, so a feed card rebuilt
      // as you scroll back to it flashed every photo and face on it.
      transition={seen ? 0 : props.transition}
      onLoad={uri ? (e) => { rememberShown(uri); onLoad?.(e); } : onLoad}
    />
  );
}

/**
 * Pictures that have loaded this session — the ones a remount finds in the
 * cache. Capped: past it, the oldest are dropped, which only costs them their
 * fade back.
 */
const shownUris = new Set<string>();
const SHOWN_CAP = 3000;
function rememberShown(uri: string) {
  if (shownUris.has(uri)) return;
  shownUris.add(uri);
  if (shownUris.size > SHOWN_CAP) {
    const oldest = shownUris.values().next().value;
    if (oldest !== undefined) shownUris.delete(oldest);
  }
}

function sourceUri(source: ImageProps['source']): string | null {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (Array.isArray(source)) return null;
  if (typeof source === 'object' && 'uri' in source && typeof source.uri === 'string') return source.uri;
  return null;
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
    // They're back to loading from disk, so back to fading in.
    shownUris.clear();
  });
}

export { ExpoImage };
