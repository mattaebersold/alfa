import React, { useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Text } from '../../theme/Text';
import { useColors, useBrandColor } from '../../theme/useColors';
import { FONT_INTER } from '../../theme/fonts';

/** The bar's unfilled track — alfa's near-black, pinned so every app matches. */
const TRACK_BG = '#202020';

const THUMB = 22;
const TRACK_H = 5;
/** The moving distance label's box, centred over the thumb. */
const VALUE_W = 56;

/**
 * A plain range slider for a distance — "Within 250 miles".
 *
 * Drawn here rather than taken from a library: the only slider worth using is
 * a native module, and a new native module means a new build for one control.
 * This one is a track, a fill and a thumb driven by a PanResponder — enough
 * for a single value that snaps to `step`.
 *
 * Grabs the gesture outright and won't hand it back while dragging, so the
 * filter panel's scroller can't steal a sideways drag that wanders a little
 * up or down. Tapping the track jumps the thumb there.
 */
export default function RadiusSlider({ value, min, max, step = 10, onChange }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (miles: number) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const [trackW, setTrackW] = useState(0);
  // Read from inside the responder, which is built once.
  const live = useRef({ trackW: 0, min, max, step, onChange, value });
  live.current = { trackW, min, max, step, onChange, value };

  const pan = useMemo(() => {
    /** The value under a point on the track. */
    const at = (x: number) => {
      const { trackW: w, min: lo, max: hi, step: st } = live.current;
      if (!w) return live.current.value;
      const ratio = Math.min(Math.max((x - THUMB / 2) / (w - THUMB), 0), 1);
      const raw = lo + ratio * (hi - lo);
      return Math.min(Math.max(Math.round(raw / st) * st, lo), hi);
    };
    const set = (x: number) => {
      const next = at(x);
      if (next !== live.current.value) live.current.onChange(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    });
  }, []);

  /** Where a value sits along the track, as the thumb's centre. */
  const xOf = (v: number) => THUMB / 2 + ((v - min) / (max - min || 1)) * Math.max(trackW - THUMB, 0);
  const thumbLeft = xOf(value) - THUMB / 2;

  return (
    <View>
      <View
        style={styles.hit}
        onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
        accessibilityRole="adjustable"
        accessibilityLabel="Distance"
        accessibilityValue={{ min, max, now: value, text: `Within ${value} miles` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const next = e.nativeEvent.actionName === 'increment' ? value + step * 5 : value - step * 5;
          onChange(Math.min(Math.max(next, min), max));
        }}
        {...pan.panHandlers}
      >
        {/* Touches land on the hit area, not the drawn parts, so locationX is
            always measured from the track's left edge. */}
        {/* The fill inside the track, clipped by it, so both ends of the bar
            are fully round whatever the fill's length. */}
        <View pointerEvents="none" style={[styles.track, { backgroundColor: TRACK_BG }]}>
          <View style={[styles.fill, { width: thumbLeft, backgroundColor: brand }]} />
        </View>
        {/* Solid, in the fill's colour — the end of the bar you drag. */}
        <View pointerEvents="none" style={[styles.thumb, { left: thumbLeft, backgroundColor: brand }]} />
      </View>
      {/* The distance, riding under the thumb as it moves — kept inside the
          bar's ends so it never runs off the panel. */}
      <View style={styles.valueLane} pointerEvents="none">
        {trackW > 0 ? (
          <Text
            style={[
              styles.value,
              { color: colors.grey, left: Math.min(Math.max(xOf(value) - VALUE_W / 2, 0), trackW - VALUE_W) },
            ]}
          >
            {value}mi
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Just under the bar, small and grey — a readout, not a heading.
  valueLane: { height: 16, marginTop: 0 },
  value: {
    position: 'absolute', top: 0, width: VALUE_W, textAlign: 'center',
    fontSize: 11, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'],
  },
  hit: { height: 34, justifyContent: 'center' },
  track: {
    position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: TRACK_H,
    borderRadius: 999, overflow: 'hidden',
  },
  // From the track's start to the thumb's centre.
  fill: { height: TRACK_H, borderRadius: 999 },
  thumb: { position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
});
