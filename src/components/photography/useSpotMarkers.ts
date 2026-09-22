import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Image, type ImageRef } from 'expo-image';
import { CONFIG } from '../../constants/config';
import { spotTypeColor } from '../../constants/photoSpots';
import type { PhotoSpot } from '../../types/api';

/**
 * Photo spots, turned into markers the map can draw.
 *
 * expo-maps takes markers as a *prop array*, not as children, so a marker can't
 * be a React view. What each platform accepts is all it accepts:
 *
 *   Apple Maps — `systemImage` (an SF Symbol) or `monogram` (1–2 characters),
 *                plus `tintColor`. No custom image of any kind.
 *   Google Maps — `icon`, a loaded image ref, drawn flat and at the image's
 *                 own pixel size.
 *
 * So on Android the pin is a picture made for the purpose: the server draws
 * the owner's avatar into a teardrop (horacio services/avatarPin) and this
 * loads that PNG as the icon. It used to load the raw profile photo, which
 * the map pasted over itself at full size. iOS gets the owner's initials in a
 * balloon, which is as close as Apple's markers come. The spot's type is the
 * colour on both — the ring on the Android pin, the balloon tint on iOS.
 */

/** Initials for the balloon: "matt aebersold" → "MA", "matt" → "MA". */
function monogramFor(username?: string): string {
  const name = (username ?? '').trim();
  if (!name) return '?';

  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/**
 * The rendered pin for a spot's owner. Always a URL, even with no avatar —
 * the server draws a plain-headed pin then, and it should still be a pin.
 * The type colour is in the URL so the ring matches, and a changed photo is
 * a changed URL, so there's no cache here to invalidate.
 */
function pinUrlFor(spot: PhotoSpot): string {
  const filename = spot.user?.profile?.[0] ?? spot.user?.gallery?.[0]?.filename ?? '';
  const ring = spotTypeColor(spot.type).replace('#', '');
  return `${CONFIG.API_BASE_URL}/api/photospot/pin.png?avatar=${encodeURIComponent(filename)}&ring=${ring}`;
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
 * Pin images, loaded once per URL and kept.
 *
 * Android only — nothing on iOS can use them. Held in a ref so panning the
 * map doesn't re-download a pin that's already been drawn once.
 */
function usePinIcons(spots: PhotoSpot[]): Record<string, ImageRef> {
  const cache = useRef<Record<string, ImageRef>>({});
  const [, bump] = useState(0);

  const urls = spots.map(pinUrlFor);
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
  const icons = usePinIcons(Platform.OS === 'ios' ? [] : spots);

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

      // Until the pin image has loaded the marker is a stock pin, briefly.
      const icon = icons[pinUrlFor(spot)];
      return icon ? { ...base, icon } : base;
    });
}
