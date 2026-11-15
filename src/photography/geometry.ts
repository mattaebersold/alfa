/**
 * The two pieces of alfa's utils/routeGeometry the photo spot map needs:
 * the rectangle a camera is looking at (`boundsFor`) and the coordinate
 * under a point on the view (`coordinateAt`). Ported verbatim; alfa's route
 * recording helpers stay in alfa.
 */

/** Web Mercator tile size, in pixels — the unit zoom levels are defined against. */
const TILE_PX = 256;

/**
 * A latitude's position on the Mercator projection, normalised to radians.
 *
 * Longitude is linear in Mercator so it needs no conversion, but latitude is
 * not — a degree near the pole covers far fewer pixels than one at the equator.
 */
function mercatorY(lat: number): number {
  // Clamped short of the poles: tan(π/2) is infinite, and the projection is
  // undefined past ~85° in any case.
  const safe = Math.max(-85.05, Math.min(85.05, lat));
  const rad = (safe * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

/** The inverse of mercatorY: a normalised Mercator y back to a latitude. */
function inverseMercatorY(y: number): number {
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * The coordinate under a point on the map view — `boundsFor` run backwards.
 *
 * Apple Maps in expo-maps has no long-press event, and neither map exposes a
 * "coordinate for this pixel" call. But a camera is a centre and a zoom, and
 * the view has a size, so the pixel's offset from the centre is a known
 * fraction of the world: longitude linearly, latitude through Mercator.
 *
 * `x`/`y` are measured from the view's top-left, in the same units as
 * `widthPx`/`heightPx`.
 */
export function coordinateAt(
  center: { lat: number; lng: number },
  zoom: number,
  widthPx: number,
  heightPx: number,
  x: number,
  y: number,
): { lat: number; lng: number } | null {
  if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return null;
  if (!Number.isFinite(zoom) || widthPx <= 0 || heightPx <= 0) return null;

  const worldPx = TILE_PX * Math.pow(2, zoom);
  const dx = x - widthPx / 2;
  const dy = y - heightPx / 2;

  const lng = ((((center.lng + (dx / worldPx) * 360) + 180) % 360) + 360) % 360 - 180;
  // Screen y grows downward; projected y grows northward.
  const lat = inverseMercatorY(mercatorY(center.lat) - (dy / worldPx) * 2 * Math.PI);

  return { lat: Math.max(-85.05, Math.min(85.05, lat)), lng };
}

/**
 * The rectangle a camera is looking at.
 *
 * expo-maps' `onCameraMove` reports a centre and a zoom, but the photo spot
 * map needs to ask the server for the pins *inside the viewport*, which is a
 * rectangle. Longitude is a flat share of 360°; latitude is measured in
 * projected space and converted back.
 *
 * Longitude is wrapped into −180..180 rather than clamped, so a viewport
 * straddling the antimeridian comes back with `west` greater than `east` —
 * horacio's spot query splits that into two ranges.
 */
export function boundsFor(
  center: { lat: number; lng: number },
  zoom: number,
  widthPx: number,
  heightPx: number,
): MapBounds | null {
  if (!Number.isFinite(center?.lat) || !Number.isFinite(center?.lng)) return null;
  if (!Number.isFinite(zoom) || widthPx <= 0 || heightPx <= 0) return null;

  const worldPx = TILE_PX * Math.pow(2, zoom);

  const lngSpan = (widthPx / worldPx) * 360;
  const halfY = (heightPx / worldPx) * Math.PI;
  const centerY = mercatorY(center.lat);

  // Past the poles there is no more map, so the span simply stops there.
  const north = Math.min(85.05, inverseMercatorY(centerY + halfY));
  const south = Math.max(-85.05, inverseMercatorY(centerY - halfY));

  // A viewport wider than the world sees all of it; wrapping it would produce
  // a rectangle that excludes the middle.
  if (lngSpan >= 360) return { north, south, east: 180, west: -180 };

  const wrap = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

  return {
    north,
    south,
    east: wrap(center.lng + lngSpan / 2),
    west: wrap(center.lng - lngSpan / 2),
  };
}

/** Great-circle distance between two points, in metres. */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A small box around a point — for "spots near here" lookups. */
export function boxAround(point: { lat: number; lng: number }, km = 2): MapBounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.1, Math.cos((point.lat * Math.PI) / 180)));
  return {
    north: point.lat + dLat,
    south: point.lat - dLat,
    east: point.lng + dLng,
    west: point.lng - dLng,
  };
}
