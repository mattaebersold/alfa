import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { normalizeSpeeds, speedColor, fitCamera } from '../../utils/routeGeometry';

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
  /**
   * Where to point the camera. Left off, the map frames the whole path — see
   * the camera note below.
   */
  center?: LatLng;
  /** Only consulted alongside an explicit `center`; a fitted camera picks its own. */
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
  /**
   * Drop pins on the first and last point of the path.
   *
   * Defaults to on wherever the map is showing a whole route (i.e. no explicit
   * `center`), and off for the live recording view and the rally pins, where a
   * "finish" pin would be either wrong or meaningless.
   */
  showEndpoints?: boolean;
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
  showEndpoints,
  style,
}: RouteMapProps) {
  /**
   * The camera.
   *
   * An explicit `center` wins — a rally pin and the live recording view both
   * want to point somewhere specific. With no centre, the map frames the whole
   * route instead of the point it happened to end on, which is what it used to
   * do: pinned to `path[path.length - 1]` at a fixed zoom, so any drive longer
   * than a couple of blocks showed its finish line and nothing else.
   *
   * Fitting needs to know how big the map is on screen, and only layout can
   * say — so the size is measured and the camera is computed from it. Before
   * the first layout pass there's nothing to fit against, so it falls back to
   * the old behaviour for that one frame.
   */
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
        ? prev
        : { width, height });
  };

  const fitted = useMemo(
    () => (center ? null : fitCamera(path, size.width, size.height)),
    [center, path, size.width, size.height],
  );

  const target = center ?? path[path.length - 1];

  const cameraPosition = useMemo(
    () => {
      if (fitted) {
        // Apple Maps reads a given zoom tighter than Google does — the same
        // number that frames a route on Android crops its ends on iOS — so the
        // fit is opened up a step there. Floored at 2, which is the whole world.
        const zoomed = Platform.OS === 'ios' ? Math.max(2, fitted.zoom - 1) : fitted.zoom;
        return { coordinates: { latitude: fitted.lat, longitude: fitted.lng }, zoom: zoomed };
      }
      return target
        ? { coordinates: { latitude: target.lat, longitude: target.lng }, zoom }
        : undefined;
    },
    [fitted, target?.lat, target?.lng, zoom], // eslint-disable-line react-hooks/exhaustive-deps
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

  /**
   * Where the drive began and where it ended.
   *
   * Without them a trace is a shape with no direction — you can see the roads
   * but not which way round they were driven, and on a loop you can't tell
   * where it started at all.
   *
   * Only Apple Maps can colour a pin: expo-maps' Google marker takes a custom
   * image ref and nothing else, so on Android the two are default pins told
   * apart by the callout you get when you tap them. Not worth shipping a pair
   * of bitmap assets for.
   */
  const endpoints = useMemo(() => {
    const on = showEndpoints ?? !center;
    if (!on || coordinates.length < 2) return [];
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const base = [
      { id: 'route-start', coordinates: first, title: 'Start' },
      { id: 'route-end', coordinates: last, title: 'Finish' },
    ];
    if (Platform.OS !== 'ios') return base;
    return [
      { ...base[0], systemImage: 'location.fill', tintColor: '#2E9E4F' },
      { ...base[1], systemImage: 'flag.checkered', tintColor: '#E23B3B' },
    ];
  }, [coordinates, showEndpoints, center]);

  const mapMarkers = useMemo(
    () => [
      ...(markers ?? [])
        .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
        .map((m, i) => ({
          id: `stop-${i}`,
          coordinates: { latitude: m.lat, longitude: m.lng },
          title: m.label || 'Pit stop',
        })),
      // Last, so a pit stop dropped on the start line doesn't bury it.
      ...endpoints,
    ],
    [markers, endpoints],
  );

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.map, style]} onLayout={onLayout}>
      <AppleMaps.View
        style={StyleSheet.absoluteFill}
        cameraPosition={cameraPosition}
        polylines={polylines}
        markers={mapMarkers}
        properties={{ isMyLocationEnabled: showsUserLocation }}
        uiSettings={{ myLocationButtonEnabled: showsUserLocation }}
      />
      </View>
    );
  }

  return (
    <View style={[styles.map, style]} onLayout={onLayout}>
    <GoogleMaps.View
      style={StyleSheet.absoluteFill}
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
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
