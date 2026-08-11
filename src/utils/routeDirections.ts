import { Platform, Linking, ActionSheetIOS, Alert } from 'react-native';
import { haversine, bearing, bearingDelta } from './routeGeometry';

/**
 * Handing a recorded route off to a maps app for turn-by-turn.
 *
 * Reconstructing the actual roads in-app would mean map-matching the GPS trace
 * against real road geometry (Google Roads API, Mapbox Map Matching, OSRM) —
 * billed per request, and a long drive is dozens of calls. Handing waypoints to
 * Apple or Google Maps gets the same outcome for nothing: the maps app routes
 * between them along the real road network and reads out the turns itself.
 *
 * The whole trick is *which* points to send. Both URL schemes cap the number of
 * intermediate stops, so the waypoints have to be chosen where they actually
 * constrain the route — at the corners — or the maps app will happily route you
 * down a motorway that skips the interesting road entirely.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
}

/**
 * Google's URL API accepts up to 9 intermediate waypoints; Apple Maps handles
 * far fewer reliably, so both are kept to a conservative shared budget.
 */
const MAX_WAYPOINTS = 8;
/** Turning by more than this over a segment marks a corner worth pinning. */
const CORNER_DEGREES = 35;
/** Bearings are compared over at least this distance, to ignore GPS wobble. */
const BEARING_BASELINE_M = 40;

/**
 * Picks the waypoints that best hold a route to the roads it was driven on.
 *
 * Evenly spacing points along the track sounds reasonable and works badly: on a
 * twisty road the interesting corners fall between samples, and the maps app
 * straightens them out. Scoring by how much the road turns puts the waypoints
 * where the route would otherwise be ambiguous.
 */
export function pickWaypoints(path: RoutePoint[], max = MAX_WAYPOINTS): RoutePoint[] {
  if (path.length <= 2) return path.slice();

  // Reduce to a chain spaced far enough apart for bearings to mean something.
  const chain: { point: RoutePoint; index: number }[] = [];
  let anchor: RoutePoint | null = null;
  path.forEach((point, index) => {
    if (!anchor || haversine(anchor, point) >= BEARING_BASELINE_M) {
      chain.push({ point, index });
      anchor = point;
    }
  });
  if (chain.length < 3) return [path[0], path[path.length - 1]];

  // Score each interior point by how sharply the route turns there.
  const corners: { point: RoutePoint; index: number; turn: number }[] = [];
  for (let i = 1; i < chain.length - 1; i++) {
    const before = bearing(chain[i - 1].point, chain[i].point);
    const after = bearing(chain[i].point, chain[i + 1].point);
    const turn = Math.abs(bearingDelta(before, after));
    if (turn >= CORNER_DEGREES) {
      corners.push({ point: chain[i].point, index: chain[i].index, turn });
    }
  }

  // Sharpest corners first, then restore driving order so the route reads
  // start → finish rather than by how dramatic each turn was.
  const chosen = corners
    .sort((a, b) => b.turn - a.turn)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((c) => c.point);

  // A gently curving road produces no corners above the threshold; fall back to
  // even spacing so the route is still pinned to roughly the right path.
  if (chosen.length === 0) {
    const step = Math.max(1, Math.floor(path.length / (max + 1)));
    for (let i = step; i < path.length - 1 && chosen.length < max; i += step) {
      chosen.push(path[i]);
    }
  }

  return [path[0], ...chosen, path[path.length - 1]];
}

const fmt = (p: RoutePoint) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Google Maps directions URL. Opens the app when installed, web otherwise. */
export function googleMapsUrl(path: RoutePoint[]): string {
  const points = pickWaypoints(path);
  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1);

  const params = [
    'api=1',
    `origin=${fmt(origin)}`,
    `destination=${fmt(destination)}`,
    'travelmode=driving',
  ];
  if (waypoints.length) {
    params.push(`waypoints=${waypoints.map(fmt).join('|')}`);
  }
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

/**
 * Apple Maps directions URL.
 *
 * Apple's scheme has no multi-stop parameter, so this can only pin the start
 * and end — Apple will pick its own way between them, which may not be the road
 * that was driven. Google is the better handoff for a specific route, and the
 * chooser below offers both rather than deciding for the driver.
 */
export function appleMapsUrl(path: RoutePoint[]): string {
  const origin = path[0];
  const destination = path[path.length - 1];
  return `http://maps.apple.com/?saddr=${fmt(origin)}&daddr=${fmt(destination)}&dirflg=d`;
}

/** Opens the route for navigation, asking which app on iOS. */
export async function openInMaps(path: RoutePoint[]) {
  if (path.length < 2) {
    Alert.alert('No route', 'This route has no path to navigate.');
    return;
  }

  const google = googleMapsUrl(path);
  const apple = appleMapsUrl(path);

  const open = (url: string) => Linking.openURL(url).catch(() => {
    Alert.alert('Could not open Maps', 'No maps app was available to handle this route.');
  });

  if (Platform.OS !== 'ios') {
    open(google);
    return;
  }

  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: 'Follow this route',
      // Google first: it's the one that can hold the drive to the actual roads.
      options: ['Google Maps (follows the road)', 'Apple Maps (start to finish)', 'Cancel'],
      cancelButtonIndex: 2,
    },
    (index) => {
      if (index === 0) open(google);
      if (index === 1) open(apple);
    },
  );
}
