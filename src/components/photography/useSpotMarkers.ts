import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Image, type ImageRef } from 'expo-image';
import { imageUrl } from '../../utils/image';
import { spotTypeColor } from '../../constants/photoSpots';
import type { PhotoSpot } from '../../types/api';

/**
 * Photo spots, turned into markers the map can draw.
 *
 * ## Why the pin can't simply be a profile photo
 *
 * expo-maps takes markers as a *prop array*, not as children, so a marker can't
 * be a React view — there is nowhere to render an avatar, a ring and a tail into.
 * What each platform accepts is all it accepts:
 *
 *   Apple Maps — `systemImage` (an SF Symbol) or `monogram` (1–2 characters),
 *                plus `tintColor`. No custom image of any kind.
 *   Google Maps — `icon`, a loaded image ref. A real picture, but the picture
 *                 as-is: the SDK draws it flat, so it can't be composited into
 *                 a pin shape here.
 *
 * So the owner's identity goes on the pin as far as each platform allows: their
 * initials on iOS, their actual avatar on Android, and the spot's type as the
 * colour on both. That asymmetry is the map library's, not a shortcut.
 *
 * Getting the same avatar pin on both platforms means either rendering the pin
 * server-side into a PNG (horacio already has sharp) — which still doesn't help
 * iOS, since Apple markers take no image — or moving this screen to
 * react-native-maps, whose `<Marker>` accepts arbitrary React children. That's
 * the only route to a true avatar pin on iOS, and it's a native dependency and
 * a rebuild, which is why it isn't taken here.
 *
 * Everything platform-specific about a pin lives in this file, so that swap is
 * a change to one module rather than to the screen.
 */

/** Initials for the balloon: "matt aebersold" → "MA", "matt" → "MA". */
function monogramFor(username?: string): string {
  const name = (username ?? '').trim();
  if (!name) return '?';

  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarUrlFor(spot: PhotoSpot): string | null {
  const filename = spot.user?.profile?.[0] ?? spot.user?.gallery?.[0]?.filename;
  return filename ? imageUrl(filename) : null;
}

export interface SpotMarker {
  id: string;
  coordinates: { latitude: number; longitude: number };
  title?: string;
  snippet?: string;
  tintColor?: string;
  monogram?: string;
  icon?: ImageRef;
}

/**
 * Avatar images, loaded once per URL and kept.
 *
 * Android only — nothing on iOS can use them. Keyed by URL rather than by user
 * so a member who changes their photo gets the new one without a cache to
 * invalidate, and held in a ref so panning the map doesn't re-download a pin
 * that's already been drawn once.
 */
function useAvatarIcons(spots: PhotoSpot[]): Record<string, ImageRef> {
  const cache = useRef<Record<string, ImageRef>>({});
  const [, bump] = useState(0);

  const urls = spots.map(avatarUrlFor).filter((u): u is string => !!u);
  const key = urls.join('|');

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    let alive = true;
    const missing = [...new Set(urls)].filter((url) => !cache.current[url]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map(async (url) => {
        try {
          return [url, await Image.loadAsync(url)] as const;
        } catch {
          // A pin whose avatar won't load falls back to the default marker
          // rather than disappearing — the spot is the point, not the photo.
          return null;
        }
      }),
    ).then((loaded) => {
      if (!alive) return;
      const fresh = loaded.filter((entry): entry is readonly [string, ImageRef] => !!entry);
      if (fresh.length === 0) return;
      for (const [url, ref] of fresh) cache.current[url] = ref;
      bump((n) => n + 1);
    });

    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return cache.current;
}

export function useSpotMarkers(spots: PhotoSpot[]): SpotMarker[] {
  const icons = useAvatarIcons(spots);

  return spots
    .filter((spot) => Number.isFinite(spot.lat) && Number.isFinite(spot.lng))
    .map((spot) => {
      const base: SpotMarker = {
        // The spot's own id, so a tap can be matched straight back to it.
        id: spot.internal_id,
        coordinates: { latitude: spot.lat, longitude: spot.lng },
        title: spot.title || 'Photo spot',
        snippet: spot.user?.username ? `by ${spot.user.username}` : undefined,
        tintColor: spotTypeColor(spot.type),
      };

      if (Platform.OS === 'ios') {
        return { ...base, monogram: monogramFor(spot.user?.username) };
      }

      const url = avatarUrlFor(spot);
      const icon = url ? icons[url] : undefined;
      return icon ? { ...base, icon } : base;
    });
}
