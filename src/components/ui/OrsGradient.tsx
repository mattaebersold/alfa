import React, { useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ORS_GRADIENT } from '../../constants/config';

/**
 * The app's gradient (ORS_GRADIENT, or `colors`), filling its parent at a true
 * 45°, top-left to bottom-right, whatever the parent's shape.
 *
 * A gradient's start and end are fractions of the box, so corner to corner is
 * 45° only on a square: on a wide button it ran nearly flat. Measured, the ends
 * are set so the line runs at 45° on screen and still just reaches the two far
 * corners — the colours start and finish exactly at the box's edges.
 */
export default function OrsGradient({ colors = ORS_GRADIENT, style }: {
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // Half the line's run, as a fraction of each side: the box's corners lie
  // (w + h) / 4 either side of its centre along a 45° line, on each axis.
  const dx = size ? (size.w + size.h) / (4 * size.w) : 0.5;
  const dy = size ? (size.w + size.h) / (4 * size.h) : 0.5;
  return (
    <LinearGradient
      colors={colors as [string, string, ...string[]]}
      start={{ x: 0.5 - dx, y: 0.5 - dy }}
      end={{ x: 0.5 + dx, y: 0.5 + dy }}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0 && (w !== size?.w || h !== size?.h)) setSize({ w, h });
      }}
    />
  );
}
