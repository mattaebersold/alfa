import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { decodePolyline, normalizeSpeeds, speedColor } from '../../utils/routeGeometry';

/**
 * A route's shape drawn as a bare SVG line.
 *
 * Feed cards and list rows use this rather than a real map: it needs no API
 * key, makes no network request, costs nothing per render, and stays crisp at
 * any size. A live map is reserved for the detail screen, where panning around
 * the actual roads is the point.
 *
 * Latitude and longitude are projected equirectangularly and the longitude axis
 * is scaled by cos(latitude) — without that correction every route looks
 * stretched sideways, increasingly so the further from the equator it was
 * driven.
 */

interface RouteTraceProps {
  /** Encoded polyline (precision 5) as stored on the route. */
  polyline?: string;
  /**
   * Speed (m/s) at each polyline point, as stored in `speed_profile`. When
   * given, the line is drawn as a red→green gradient scaled to this drive's own
   * speed range instead of a flat `color`.
   */
  speeds?: number[];
  color: string;
  /** Line thickness in viewBox units. */
  strokeWidth?: number;
  /** Draw dots at the start and end of the route. */
  showEndpoints?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VIEW = 100;
/** Upper bound on coloured segments — plenty at any size this renders at. */
const MAX_SEGMENTS = 60;
const PAD = 8;

export default function RouteTrace({
  polyline,
  speeds,
  color,
  strokeWidth = 3,
  showEndpoints = true,
  style,
}: RouteTraceProps) {
  const shape = useMemo(() => {
    if (!polyline) return null;
    const points = decodePolyline(polyline);
    if (points.length < 2) return null;

    const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lngScale = Math.cos((meanLat * Math.PI) / 180);

    const xs = points.map((p) => p.lng * lngScale);
    const ys = points.map((p) => p.lat);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Preserve aspect ratio: scale both axes by the same factor, then centre.
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const span = Math.max(spanX, spanY) || 1;
    const scale = (VIEW - PAD * 2) / span;
    const offsetX = PAD + ((VIEW - PAD * 2) - spanX * scale) / 2;
    const offsetY = PAD + ((VIEW - PAD * 2) - spanY * scale) / 2;

    const project = (i: number) => ({
      // SVG's y axis grows downward, so north has to be flipped to stay up.
      x: offsetX + (xs[i] - minX) * scale,
      y: VIEW - offsetY - (ys[i] - minY) * scale,
    });

    const first = project(0);
    let d = `M${first.x.toFixed(2)},${first.y.toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      const p = project(i);
      d += `L${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    }

    // Per-segment colouring, when a speed profile lines up with the points.
    // Segments are capped so a long drive doesn't emit hundreds of <Path>
    // nodes into a thumbnail — at card size the extra detail is invisible.
    let segments: { d: string; color: string }[] | null = null;
    const norm = speeds && speeds.length === points.length ? normalizeSpeeds(speeds) : null;
    if (norm) {
      const step = Math.max(1, Math.ceil((points.length - 1) / MAX_SEGMENTS));
      segments = [];
      for (let i = 0; i < points.length - 1; i += step) {
        const end = Math.min(i + step, points.length - 1);
        const a = project(i);
        let sd = `M${a.x.toFixed(2)},${a.y.toFixed(2)}`;
        let sum = 0;
        for (let j = i + 1; j <= end; j++) {
          const p = project(j);
          sd += `L${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          sum += norm[j];
        }
        segments.push({ d: sd, color: speedColor(sum / (end - i)) });
      }
    }

    return { d, segments, start: first, end: project(points.length - 1) };
  }, [polyline, speeds]);

  if (!shape) return <View style={[styles.empty, style]} />;

  return (
    <View style={style}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        {shape.segments ? (
          shape.segments.map((seg, i) => (
            <Path
              key={i}
              d={seg.d}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))
        ) : (
          <Path
            d={shape.d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
        {showEndpoints && (
          <>
            <Circle cx={shape.start.x} cy={shape.start.y} r={strokeWidth * 1.3} fill={color} />
            <Circle
              cx={shape.end.x}
              cy={shape.end.y}
              r={strokeWidth * 1.3}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth * 0.8}
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { opacity: 0 },
});
