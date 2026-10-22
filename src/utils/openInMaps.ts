import { Linking, Platform } from 'react-native';

/**
 * Open a place in the phone's own maps app — Apple Maps on iOS, whatever
 * handles `geo:` on Android (Google Maps, usually) — pinned at the coordinate
 * when there is one, else searched by the address. Falls back to Google Maps
 * on the web if the app link won't open.
 */
export function openInMaps(place: {
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}) {
  const { location_lat: lat, location_lng: lng } = place;
  const label = encodeURIComponent(place.location ?? '');
  const hasPoint = typeof lat === 'number' && typeof lng === 'number';
  if (!hasPoint && !place.location) return;

  const native = Platform.OS === 'ios'
    ? (hasPoint ? `maps://?ll=${lat},${lng}&q=${label || `${lat},${lng}`}` : `maps://?q=${label}`)
    : (hasPoint ? `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${label})` : ''}` : `geo:0,0?q=${label}`);
  const web = `https://www.google.com/maps/search/?api=1&query=${hasPoint ? `${lat},${lng}` : label}`;

  Linking.openURL(native).catch(() => Linking.openURL(web).catch(() => {}));
}
