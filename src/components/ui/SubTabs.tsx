import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { TAB_EASING, TAB_LAYOUT, thumbMoveMs } from './tabMotion';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** The track behind the options: solid black, under any ground. */
const TRACK_BG = COLOR_BLACK;

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
export default function SubTabs<T extends string>({ options, value, onChange, stretch = false, inset = 12, padX }: {
  /** `Icon`, optionally, before the label in the label's colour. */
  options: { key: T; label: string; Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }[];
  value: T;
  onChange: (key: T) => void;
  /** Run the track the full width, the options sharing it equally. */
  stretch?: boolean;
  /** The track's side margin — 12 by default; a host lines it up with its own edge. */
  inset?: number;
  /** Each option's side padding when they keep their own widths — wider than the default 14 for a roomier row. */
  padX?: number;
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
  /** Where the thumb was last sent — for how far its next move is. */
  const lastX = useRef(0);
  useEffect(() => {
    if (!target) return;
    if (!placed.current) {
      // First layout: land, don't slide in from the left edge.
      placed.current = true;
      x.setValue(target.x); w.setValue(target.w);
      lastX.current = target.x;
      return;
    }
    // Out, with a slight overshoot, and longer the further it goes — see tabMotion.
    const duration = thumbMoveMs(target.x - lastX.current);
    lastX.current = target.x;
    Animated.parallel([
      Animated.timing(x, { toValue: target.x, duration, easing: TAB_EASING, useNativeDriver: false }),
      Animated.timing(w, { toValue: target.w, duration, easing: TAB_EASING, useNativeDriver: false }),
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
          // Eases to its new place and width when a label changes; measured
          // here, where its place in the row is.
          <Reanimated.View
            key={o.key}
            layout={TAB_LAYOUT}
            style={fit === 'equal' && styles.segmentShare}
            onLayout={fit === 'scroll'
              ? (e) => { const { x: lx, width } = e.nativeEvent.layout; setCells((c) => (c[o.key]?.x === lx && c[o.key]?.w === width ? c : { ...c, [o.key]: { x: lx, w: width } })); }
              : undefined}
          >
          <TouchableOpacity
            style={[styles.segment, fit === 'scroll' && styles.segmentOwn, fit === 'scroll' && padX != null && { paddingHorizontal: padX }]}
            onPress={() => onChange(o.key)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <View style={styles.segmentInner}>
              {o.Icon ? <o.Icon size={14} color={active ? contrastText(brand) : colors.muted} strokeWidth={2.4} /> : null}
              <Text style={[styles.segmentLabel, { color: active ? contrastText(brand) : colors.muted }]} numberOfLines={1}>
                {o.label}
              </Text>
            </View>
          </TouchableOpacity>
          </Reanimated.View>
        );
      })}
    </>
  );

  if (fit === 'scroll') {
    return (
      // A horizontal ScrollView takes all the width it's given, so the track
      // can't simply shrink to it. The outer view measures the room; the
      // track is sized to the options, up to that, and past it they scroll.
      <View style={[styles.segmentRoom, { marginHorizontal: inset }]} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
      <Reanimated.View layout={TAB_LAYOUT} style={[
        styles.segmentTrack, styles.segmentTrackScroll,
        { backgroundColor: TRACK_BG },
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
      </Reanimated.View>
      </View>
    );
  }
  return (
    <View
      style={[styles.segmentTrack, { backgroundColor: TRACK_BG, marginHorizontal: inset }]}
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
  // Sharing the track equally, in `stretch`.
  segmentShare: { flex: 1 },
  // No flex of its own: its wrapper (segmentShare) takes the share of the
  // track; flex here, in that column, collapsed it to nothing.
  segment:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 4 },
  // Its own width, at full size — the row scrolls instead.
  segmentOwn:   { paddingHorizontal: 14 },
  segmentInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmentLabel: { fontSize: 13, fontFamily: FONT_INTER.bold },
});
