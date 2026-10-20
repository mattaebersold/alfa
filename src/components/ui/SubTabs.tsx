import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** The track's inner padding, and the gap between segments. */
const SEG_PAD = 3;
const SEG_GAP = 3;

/**
 * Sub tabs: a choice within a view — a post's category, a listing's
 * condition — where MainTabs choose between views or kinds of thing.
 *
 * One of a few, in a track, and a thumb in the accent colour that slides to
 * whichever is picked rather than one segment lighting and another going
 * out. The thumb is a view under the labels; the labels only change colour.
 *
 * By default each option is its own width and the track hugs them: a short
 * set doesn't stretch across the screen, and one too long to fit (the
 * categories run to five) scrolls sideways — the thumb follows the measured
 * segment, and the row scrolls to keep the lit one in view. `stretch` runs the
 * track the full width instead and shares it between the options, as
 * MainTabs' `stretch` does. Both animate on the JS driver, since the thumb's
 * width changes too.
 */
export default function SubTabs<T extends string>({ options, value, onChange, stretch = false }: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  /** Run the track the full width, the options sharing it equally. */
  stretch?: boolean;
}) {
  const fit = stretch ? 'equal' : 'scroll';
  const colors = useColors();
  const brand = useBrandColor();
  const [trackW, setTrackW] = useState(0);
  /** The options' width end to end, for a track that hugs them. */
  const [contentW, setContentW] = useState(0);
  const [cells, setCells] = useState<Record<string, { x: number; w: number }>>({ });
  const scrollRef = useRef<ScrollView>(null);
  const n = Math.max(1, options.length);
  // -1 while nothing's picked: no thumb, every label unlit.
  const index = options.findIndex((o) => o.key === value);

  // Where the thumb goes: a share of the track, or the measured segment.
  const target = index < 0 ? null : fit === 'equal'
    ? (trackW > 0 ? { x: SEG_PAD + index * ((trackW - SEG_PAD * 2 - SEG_GAP * (n - 1)) / n + SEG_GAP), w: (trackW - SEG_PAD * 2 - SEG_GAP * (n - 1)) / n } : null)
    : (cells[value] ?? null);

  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!target) return;
    if (!placed.current) {
      // First layout: land, don't slide in from the left edge.
      placed.current = true;
      x.setValue(target.x); w.setValue(target.w);
      return;
    }
    // Quick and settled: a thumb that overshoots reads as loose.
    Animated.parallel([
      Animated.spring(x, { toValue: target.x, tension: 170, friction: 22, useNativeDriver: false }),
      Animated.spring(w, { toValue: target.w, tension: 170, friction: 22, useNativeDriver: false }),
    ]).start();
    if (fit === 'scroll' && trackW > 0) {
      // The lit one in view, with the one before it peeking.
      scrollRef.current?.scrollTo({ x: Math.max(0, target.x - 24), animated: true });
    }
  }, [target?.x, target?.w]); // eslint-disable-line react-hooks/exhaustive-deps

  const segments = (
    <>
      {target && (
        <Animated.View
          pointerEvents="none"
          style={[styles.segmentThumb, { width: w, backgroundColor: brand, transform: [{ translateX: x }] }]}
        />
      )}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segment, fit === 'scroll' && styles.segmentOwn]}
            onLayout={fit === 'scroll'
              ? (e) => { const { x: lx, width } = e.nativeEvent.layout; setCells((c) => (c[o.key]?.x === lx && c[o.key]?.w === width ? c : { ...c, [o.key]: { x: lx, w: width } })); }
              : undefined}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segmentLabel, { color: active ? contrastText(brand) : colors.muted }]} numberOfLines={1}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (fit === 'scroll') {
    return (
      // A horizontal ScrollView takes all the width it's given, so the track
      // can't simply shrink to it. The outer view measures the room; the
      // track is sized to the options, up to that, and past it they scroll.
      <View style={styles.segmentRoom} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <View style={[
        styles.segmentTrack, styles.segmentTrackScroll,
        { backgroundColor: colors.inputBg },
        // Hidden until both are known, so it doesn't flash full width first.
        trackW > 0 && contentW > 0 ? { width: Math.min(contentW, trackW) } : styles.unmeasured,
      ]}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={(cw) => setContentW(cw)}
          contentContainerStyle={styles.segmentScrollRow}
          keyboardShouldPersistTaps="handled"
          accessibilityRole="radiogroup"
        >
          {segments}
        </ScrollView>
      </View>
      </View>
    );
  }
  return (
    <View
      style={[styles.segmentTrack, { backgroundColor: colors.inputBg }]}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
    >
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentTrack: { flexDirection: 'row', marginHorizontal: 12, padding: SEG_PAD, borderRadius: COMMON_RADIUS, gap: SEG_GAP },
  // The scrolling track: its padding moves onto the scroller's content, so
  // the row can run under the track's rounded ends. Flush left and only as
  // wide as its options, up to the full width, where it starts to scroll.
  segmentTrackScroll: { padding: 0, overflow: 'hidden', marginHorizontal: 0 },
  // The full row the track may grow to — the track's own side margins, moved out here.
  segmentRoom:  { marginHorizontal: 12, alignItems: 'flex-start' },
  unmeasured:   { opacity: 0 },
  segmentScrollRow:   { flexDirection: 'row', gap: SEG_GAP, padding: SEG_PAD },
  segmentThumb: { position: 'absolute', top: SEG_PAD, bottom: SEG_PAD, left: 0, borderRadius: COMMON_RADIUS - SEG_PAD },
  segment:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4 },
  // Its own width, at full size — the row scrolls instead.
  segmentOwn:   { flex: 0, paddingHorizontal: 14 },
  segmentLabel: { fontSize: 13, fontFamily: FONT_INTER.bold },
});
