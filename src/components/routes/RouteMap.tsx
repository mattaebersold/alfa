import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { normalizeSpeeds, speedColor } from '../../utils/routeGeometry';

/**
 * The route line on a map.
 *
 * expo-maps exposes a separate view per platform — Apple Maps on iOS, Google
 * Maps on Android — with the same shape of props but different types. This
 * wrapper is the single place that difference lives, so screens just hand it a
 * path and a camera.
 *
 * iOS and Android only. expo-maps ships no web implementation, and routes are
 * a phone feature by nature — you record them from a car.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

interface RouteMapProps {
  /** The path to trace. Fewer than two points draws nothing. */
  path: LatLng[];
  /** Where to point the camera. Defaults to the last point of the path. */
  center?: LatLng;
  zoom?: number;
  /** Colour of the traced line, used when no speed data is supplied. */
  color: string;
  /**
   * Speed (m/s) per path point. When present the line is split into coloured
   * segments — red where the drive was slowest, green where it was fastest.
   */
  speeds?: number[];
  /** Pit stops, rendered as pins. */
  markers?: { lat: number; lng: number; label?: string }[];
  /** Show the blue dot for the device's own position. */
  showsUserLocation?: boolean;
  /** Keep the camera pinned to the device's position. Android only — Apple
   *  Maps has no equivalent, and recentres through `center` instead. */
  followsUser?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LINE_WIDTH = 6;
/** Upper bound on coloured segments drawn onto the map. */
const MAX_SEGMENTS = 80;

export default function RouteMap({
  path,
  center,
  zoom = 15,
  color,
  speeds,
  markers,
  showsUserLocation = false,
  followsUser = false,
  style,
}: RouteMapProps) {
  const target = center ?? path[path.length - 1];

  const cameraPosition = useMemo(
    () => (target
      ? { coordinates: { latitude: target.lat, longitude: target.lng }, zoom }
      : undefined),
    [target?.lat, target?.lng, zoom], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const coordinates = useMemo(
    () => path.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    [path],
  );

  // A one-point "line" renders as nothing useful and trips up both SDKs.
  //
  // Each map polyline carries a single colour, so a speed gradient means one
  // polyline per segment. They're capped for the same reason the SVG trace caps
  // its own: past a point the extra segments cost redraws and show nothing.
  const polylines = useMemo(() => {
    if (coordinates.length < 2) return [];

    const norm = speeds && speeds.length === coordinates.length ? normalizeSpeeds(speeds) : null;
    if (!norm) return [{ id: 'route', coordinates, color, width: LINE_WIDTH }];

    const step = Math.max(1, Math.ceil((coordinates.length - 1) / MAX_SEGMENTS));
    const segs = [];
    for (let i = 0; i < coordinates.length - 1; i += step) {
      const end = Math.min(i + step, coordinates.length - 1);
      let sum = 0;
      for (let j = i + 1; j <= end; j++) sum += norm[j];
      segs.push({
        id: `route-${i}`,
        // Segments share an endpoint so the line reads as continuous.
        coordinates: coordinates.slice(i, end + 1),
        color: speedColor(sum / (end - i)),
        width: LINE_WIDTH,
      });
    }
    return segs;
  }, [coordinates, speeds, color]);

  const mapMarkers = useMemo(
    () => (markers ?? [])
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .map((m, i) => ({
        id: `stop-${i}`,
        coordinates: { latitude: m.lat, longitude: m.lng },
        title: m.label || 'Pit stop',
      })),
    [markers],
  );

  if (Platform.OS === 'ios') {
    return (
      <AppleMaps.View
        style={[styles.map, style]}
        cameraPosition={cameraPosition}
        polylines={polylines}
        markers={mapMarkers}
        properties={{ isMyLocationEnabled: showsUserLocation }}
        uiSettings={{ myLocationButtonEnabled: showsUserLocation }}
      />
    );
  }

  return (
    <GoogleMaps.View
      style={[styles.map, style]}
      cameraPosition={cameraPosition}
      polylines={polylines}
      markers={mapMarkers}
      properties={{ isMyLocationEnabled: showsUserLocation }}
      userLocation={
        target && followsUser
          ? {
              coordinates: { latitude: target.lat, longitude: target.lng },
              followUserLocation: true,
            }
          : undefined
      }
      uiSettings={{
        myLocationButtonEnabled: showsUserLocation,
        zoomControlsEnabled: false,
        mapToolbarEnabled: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
