import * as Location from 'expo-location';

/** A recent last-known fix is "here" — it's a 10–500 mile filter, not a pin. */
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;
/** Coarse is fine for the same reason, and much quicker to get. */
const LAST_KNOWN_ACCURACY_M = 5000;
const FIX_TIMEOUT_MS = 8000;

/**
 * Where the phone is, for the Location filter's near me (see
 * hooks/useLocationFilter).
 *
 * Asks for location the first time near me is in play, and only while it can
 * still ask: declined, near me quietly measures from the profile zip instead
 * (useLocationFilter's fallback), rather than nagging on every list.
 *
 * A recent last-known fix answers at once; otherwise one Balanced fix, given
 * FIX_TIMEOUT_MS before it's treated as "can't say".
 */
export async function getDevicePosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted' && canAskAgain) {
      ({ status } = await Location.requestForegroundPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const last = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: LAST_KNOWN_ACCURACY_M,
    }).catch(() => null);
    const fix = last ?? await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS)),
    ]);
    return fix ? { lat: fix.coords.latitude, lng: fix.coords.longitude } : null;
  } catch (err) {
    console.warn('[near me] no device position:', err);
    return null;
  }
}
