/**
 * Client-side route geometry.
 *
 * This exists purely so the record screen can show live numbers while you
 * drive. The server recomputes every stat from the submitted track when the
 * route is saved (horacio/helpers/routeGeometry.js), and *that* result is the
 * one stored and ranked on — nothing here is authoritative.
 *
 * The movement threshold below is deliberately kept in step with the server's
 * MOVING_SPEED_MS so the distance ticking up on screen matches the distance
 * that ends up on the saved route. If you change one, change the other.
 */

const EARTH_RADIUS_M = 6371008.8;

/** Matches MOVING_SPEED_MS on the server. Below this the vehicle is stopped
 *  and its fixes are GPS noise, not travel. */
export const MOVING_SPEED_MS = 1;

export interface RouteSample {
  lat: number;
  lng: number;
  /** Milliseconds since epoch. */
  t: number;
  /** Metres per second. -1 when the device has no speed fix. */
  speed: number;
  /** Altitude in metres. */
  alt: number;
  /** Degrees clockwise from north. */
  heading: number;
  /** Horizontal accuracy in metres. */
  accuracy: number;
}

const round = (n: number, places: number) => {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * Trims a track for transmission.
 *
 * A raw GPS fix arrives as full doubles, so one sample serialises to roughly
 * 200 bytes — almost all of it digits nobody uses. Six decimal places of
 * latitude is about 11cm, which is finer than any consumer GPS resolves, and
 * one decimal is more than enough for speed, altitude, heading and accuracy.
 * Rounding at the boundary rather than at capture keeps the live stats on the
 * record screen working from the untouched values, and roughly halves what goes
 * over the wire — which matters because the whole track posts as a single
 * multipart field with a size ceiling on it.
 */
export function compactSamples(samples: RouteSample[]): RouteSample[] {
  return samples.map((s) => ({
    lat: round(s.lat, 6),
    lng: round(s.lng, 6),
    t: s.t,
    speed: round(s.speed, 1),
    alt: round(s.alt, 1),
    heading: round(s.heading, 1),
    accuracy: round(s.accuracy, 1),
  }));
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversine(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Initial bearing from a to b, in degrees clockwise from north (0-360). */
export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest signed angle between two bearings, in -180..180. */
export function bearingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Whether a sample represents actual travel rather than a stationary wobble. */
export function isMoving(sample: RouteSample, prev?: RouteSample): boolean {
  if (sample.speed >= 0) return sample.speed > MOVING_SPEED_MS;
  if (!prev) return false;
  const dt = (sample.t - prev.t) / 1000;
  if (dt <= 0) return false;
  return haversine(prev, sample) / dt > MOVING_SPEED_MS;
}

/**
 * Decodes an encoded polyline (Google's algorithm, precision 5) back into
 * points. The server stores route shapes in this form — see
 * horacio/helpers/routeGeometry.js — because it is roughly a twelfth the size
 * of the equivalent JSON, which is what makes it affordable to send the shape
 * of every route in a list response.
 */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;

  while (i < encoded.length) {
    let deltaLat = 0;
    let deltaLng = 0;

    for (let axis = 0; axis < 2; axis++) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) deltaLat = delta;
      else deltaLng = delta;
    }

    lat += deltaLat;
    lng += deltaLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

// ── Display formatting ─────────────────────────────────────────────────────
// Imperial throughout — the membership is US-based.

const M_PER_MILE = 1609.344;
const M_PER_FOOT = 0.3048;

export const metersToMiles = (m: number) => m / M_PER_MILE;
export const msToMph = (ms: number) => ms * 2.2369362920544;

export function formatDistance(meters: number): string {
  const miles = metersToMiles(meters);
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}

export function formatSpeed(metersPerSecond: number): string {
  return `${Math.round(msToMph(metersPerSecond))} mph`;
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters / M_PER_FOOT).toLocaleString()} ft`;
}

/** h:mm:ss while driving; m:ss for anything under an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Human label for the server's 0-100 curviness index. */
export function curvinessLabel(index: number): string {
  if (index >= 70) return 'Very technical';
  if (index >= 45) return 'Technical';
  if (index >= 20) return 'Flowing';
  return 'Straight';
}

// ── Speed colouring ────────────────────────────────────────────────────────

/**
 * Colour for a normalised speed, 0 (slowest) → 1 (fastest).
 *
 * Red for the slow stretches, amber through the middle, green where the road
 * opened up — the traffic-light reading most people already have. Flip the two
 * endpoints below if you'd rather red meant "fast".
 */
export function speedColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Two-stop ramp: red → amber at the midpoint, amber → green above it.
  const stops = clamped < 0.5
    ? { from: [220, 54, 46], to: [232, 168, 40], f: clamped * 2 }
    : { from: [232, 168, 40], to: [46, 176, 94], f: (clamped - 0.5) * 2 };

  const ch = (i: number) => Math.round(stops.from[i] + (stops.to[i] - stops.from[i]) * stops.f);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

/**
 * Normalises a speed profile against its own range.
 *
 * Absolute speeds would paint a 30mph back road uniformly red and a motorway
 * uniformly green, which says nothing useful. Scaling to each drive's own
 * spread is what makes the corners legible against its straights.
 *
 * Returns nulls when the drive was near-constant speed, so callers can fall
 * back to a flat colour rather than rendering meaningless noise.
 */
export function normalizeSpeeds(speeds: number[]): number[] | null {
  if (!speeds || speeds.length < 2) return null;
  const valid = speeds.filter((s) => Number.isFinite(s) && s >= 0);
  if (valid.length < 2) return null;

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  // Under ~4mph of spread there's no story to tell.
  if (max - min < 2) return null;

  return speeds.map((s) => (Number.isFinite(s) ? (s - min) / (max - min) : 0));
}
