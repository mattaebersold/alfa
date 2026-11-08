import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, FadeIn, FadeOut } from 'react-native-reanimated';
import { TAB_EASING_UI, TAB_LAYOUT, thumbMoveMs } from './tabMotion';
import { selectionHaptic } from '../../utils/haptics';
import { Text } from '@ors/kit';
import { GUTTER, COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { FONT_INTER } from '../../constants/fonts';

/** One entry in a main tab row. */
export interface MainTab<K extends string = string> {
  key: K;
  label: string;
  /** Before the label, in the label's colour — the group page's tabs wear them too. */
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** A number after the label — how many are behind it. Nothing for 0 or none. */
  count?: number;
  /** Just this tab as its icon, the label kept for screen readers — the home header's Feed. */
  iconOnly?: boolean;
}

/**
 * Where a picked tab settles, in points from the row's left edge — far enough
 * in that the tab before it peeks into view. Not the first tab, which stays
 * on the inset.
 */
const ACTIVE_LEFT = 50;
/** Clear space after the last tab, at the end of the row's scroll. */
const END_SPACE = 24;
/** The unlit tabs: white lettering on the black track. */
const TAB_IDLE_FG = COLOR_WHITE;
/** The track behind the row — solid black, as SubTabs' is. */
const TRACK_BG = COLOR_BLACK;
/** A quieter track, for the tabs in a summary panel — the reactions panels (`trackColor`). */
export const PANEL_TRACK_BG = SURFACE_MID;
/** The track's inner padding, and the room between tabs. */
const TRACK_PAD = 4;
const TRACK_GAP = 4;
/** Each tab's height — a step over SubTabs', which this is the larger of. */
export const TAB_H = 40;
/** `dense`: the tab's height, and the track's padding above and below it. */
const TAB_H_DENSE = 38;
const TRACK_PAD_DENSE = 5;
/** `dense`: the whole track's height — what AppHeader's tab row is sized from. */
export const DENSE_TRACK_H = TAB_H_DENSE + TRACK_PAD_DENSE * 2;

/**
 * Main tabs: SubTabs, a size up — the same black track, and the same thumb
 * that springs to whichever tab is picked rather than one tab lighting and
 * another going out. The brand colour — Pro red, or blue on a basic
 * membership — under readable lettering for the lit one; white,
 * a weight lighter, for the rest. Larger, and with room for an icon and a
 * count beside each label.
 *
 * For a choice between whole views or kinds of thing — the feed's sections,
 * a post's type. A choice *within* one (a category, a filter) is SubTabs.
 *
 * The row scrolls sideways and runs edge to edge; the first tab starts
 * `inset` in. A picked tab is brought toward the front, so the one before it
 * peeks in on the left and you can see there's somewhere to go back to. The
 * row can't scroll past its end, so the last few stop short of the mark but
 * are still all in view.
 *
 * `stretch`, on by default, spreads a short row across the full width: the
 * tabs grow to share what's left over, like flex, so the spare room falls
 * evenly between them. A row too long to fit keeps the tabs at their own
 * widths and scrolls as usual. Off, a short row hugs the left.
 *
 * The app header draws its tabs with this, and passes `itemsStyle` (the
 * shrink and indent as the header sticks) and `stuck` (the heavier weight
 * that goes with it). Anywhere else leaves both off.
 */
export default function MainTabs<K extends string>({
  tabs, value, onChange, inset = GUTTER, stretch = true, stuck = false, trackColor, thumbColor, idleColor, countColor, iconOnly = false, dense = false, pill = false, plainCounts = false, itemsStyle, contentContainerStyle, style,
}: {
  tabs: MainTab<K>[];
  value?: K;
  onChange?: (key: K) => void;
  /** Room before the first tab — line it up with the page under it. */
  inset?: number;
  /** Grow the tabs to fill the row when they'd leave room at the end. */
  stretch?: boolean;
  /** Scaled down under the status bar: a step heavier, so it reads as the same weight. */
  stuck?: boolean;
  /** The track's ground, in place of the black — for a panel that wants it quieter. */
  trackColor?: string;
  /** The lit tab's fill, in place of the brand colour; its lettering follows (white or black, whichever reads). */
  thumbColor?: string;
  /** The unlit tabs' lettering and icons, in place of white — the home header's grey. */
  idleColor?: string;
  /** Every count's lettering, lit tab or not, in place of the red-on-black / white pair. */
  countColor?: string;
  /**
   * Icons and counts, no words — for a summary panel's tabs, where six labels
   * ran past the panel's edge and had to scroll. The label is still what a
   * screen reader says. Every tab needs an Icon.
   */
  iconOnly?: boolean;
  /** Shorter tabs and a thinner track around them — the home header's row. */
  dense?: boolean;
  /** Fully round track and thumb, rather than the shared corner. */
  pill?: boolean;
  /**
   * Counts in a round black/70 chip beside the icon or label, in the tab's
   * own lettering colour — the summary panels' tabs (PanelTabs).
   */
  plainCounts?: boolean;
  itemsStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  // The lit tab: the member's brand colour, under whichever of black or white reads on it.
  const brand = useBrandColor();
  const TAB_ON_BG = thumbColor ?? brand;
  const TAB_ON_FG = contrastText(TAB_ON_BG);

  // Positions are each tab's own x within the row, measured as they lay out;
  // the row's inset is outside that, so it's added back to find where the tab
  // sits against the row's edge.
  const scrollRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});

  /**
   * The tab just tapped, lit at once — before the host has re-rendered for
   * it. A tap hands the change on a frame later (see the press), so the
   * thumb is already sliding by the time the host's heavy render — a pane
   * switch — takes the JS thread. Cleared when the host's `value` arrives.
   */
  const [picked, setPicked] = useState<K | null>(null);
  useEffect(() => { setPicked(null); }, [value]);
  const shown = picked ?? value;

  // The thumb: each tab's measured place in the track, and a slide to the
  // picked one's. On Reanimated, so it runs on the UI thread — width and all
  // — and keeps moving however busy JS is.
  const [cells, setCells] = useState<Record<string, { x: number; w: number }>>({});
  const target = shown ? cells[shown] : undefined;
  const thumbX = useSharedValue(0);
  const thumbW = useSharedValue(0);
  const thumbStyle = useAnimatedStyle(() => ({ width: thumbW.value, transform: [{ translateX: thumbX.value }] }));
  const placed = useRef(false);
  /** Where the thumb was last sent — for how far its next move is, and not sending it twice. */
  const last = useRef<{ x: number; w: number } | null>(null);
  const moveThumb = (to: { x: number; w: number }) => {
    if (last.current && last.current.x === to.x && last.current.w === to.w) return;
    if (!placed.current) {
      // First layout: land, don't slide in from the left edge.
      placed.current = true;
      thumbX.value = to.x; thumbW.value = to.w;
      last.current = to;
      return;
    }
    // Out, with a slight overshoot, and longer the further it goes — see tabMotion.
    const duration = thumbMoveMs(to.x - (last.current?.x ?? to.x));
    last.current = to;
    thumbX.value = withTiming(to.x, { duration, easing: TAB_EASING_UI });
    thumbW.value = withTiming(to.w, { duration, easing: TAB_EASING_UI });
  };
  // A tab's place changing under it — a label or count, or the row's
  // tabs swapping (a section's own) — carries the thumb with it.
  useEffect(() => {
    if (target) moveThumb(target);
  }, [target?.x, target?.w]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Brings the picked tab toward the front — see ACTIVE_LEFT. */
  const scrollToTab = (key: K, animated: boolean) => {
    const x = tabX.current[key];
    if (x == null) return false;
    const first = key === tabs[0]?.key;
    const to = first ? 0 : Math.max(0, inset + x - ACTIVE_LEFT);
    scrollRef.current?.scrollTo({ x: to, animated });
    return true;
  };
  /**
   * A row that mounts on a tab other than the first — a panel opened on the
   * count that was tapped — has nothing measured when the effect below first
   * runs, so the picked tab's own layout does it, once, without the slide.
   */
  const scrolledOnMount = useRef(false);
  useEffect(() => {
    if (!value) return;
    if (scrollToTab(value, true)) scrolledOnMount.current = true;
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={[styles.scroll, style]}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.row,
        // Stretched, the row ends at the inset — there's nothing past the
        // last tab to make room for.
        { paddingLeft: inset, paddingRight: stretch ? inset : inset + END_SPACE },
        stretch && styles.rowStretch,
        contentContainerStyle,
      ]}
      accessibilityRole="tablist"
    >
      {/* The header's shrink and indent on the outside (RN Animated); inside
          it, the track, which eases to its new width when a tab's does. */}
      <Animated.View style={[styles.itemsOuter, stretch && styles.grow, itemsStyle]}>
      <Reanimated.View layout={TAB_LAYOUT} style={[styles.items, dense && styles.itemsDense, pill && styles.round, stretch && styles.grow, trackColor ? { backgroundColor: trackColor } : null]}>
        {target && (
          <Reanimated.View
            pointerEvents="none"
            style={[styles.thumb, dense && styles.thumbDense, pill && styles.round, { backgroundColor: TAB_ON_BG }, thumbStyle]}
          />
        )}
        {tabs.map((t) => {
          const on = t.key === shown;
          const color = on ? TAB_ON_FG : (idleColor ?? TAB_IDLE_FG);
          return (
            // Eases to its new place and width when a label or count changes.
            // Measured here, where its place in the track is.
            <Reanimated.View
              key={t.key}
              layout={TAB_LAYOUT}
              // The row stays mounted when its tabs change — a section's own
              // replacing the home row — so those leaving fade out and those
              // arriving fade in, while the ones staying ease to their places.
              entering={TAB_ENTER}
              exiting={TAB_EXIT}
              style={stretch && styles.grow}
              onLayout={(e) => {
                const { x: lx, width } = e.nativeEvent.layout;
                tabX.current[t.key] = lx;
                if (t.key === value && !scrolledOnMount.current) {
                  scrolledOnMount.current = true;
                  // After the row's content has its width, or the scroll clamps short.
                  requestAnimationFrame(() => scrollToTab(t.key, false));
                }
                setCells((c) => (c[t.key]?.x === lx && c[t.key]?.w === width ? c : { ...c, [t.key]: { x: lx, w: width } }));
              }}
            >
            <TouchableOpacity
              onPress={() => {
                if (t.key === shown) { onChange?.(t.key); return; }
                selectionHaptic();
                // Lit and sliding now; the host hears a frame later.
                setPicked(t.key);
                const cell = cells[t.key];
                if (cell) moveThumb(cell);
                requestAnimationFrame(() => onChange?.(t.key));
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={iconOnly || t.iconOnly ? (t.count ? `${t.label}, ${t.count}` : t.label) : undefined}
              style={stretch && styles.grow}
            >
              <View style={[styles.pill, dense && styles.pillDense, stretch && styles.pillStretch, (iconOnly || t.iconOnly) && styles.pillIconOnly, t.iconOnly && styles.pillSoloIcon]}>
                {t.Icon ? <t.Icon size={iconOnly || t.iconOnly ? 17 : 15} color={color} strokeWidth={on ? 2.4 : 2} /> : null}
                {!iconOnly && !t.iconOnly && <Text
                  style={[
                    styles.label,
                    { color },
                    !on && styles.labelIdle,
                    stuck && (on ? styles.labelStuck : styles.labelIdleStuck),
                  ]}
                >
                  {t.label}
                </Text>}
                {t.count ? plainCounts ? (
                  <View style={styles.countCircle}>
                    <Text style={[styles.countText, { color: countColor ?? color }]}>{t.count}</Text>
                  </View>
                ) : (
                  // The lit tab's count black on its red; the rest a quiet grey.
                  <View style={[styles.count, on && { backgroundColor: TAB_ON_FG }]}>
                    <Text style={[styles.countText, { color: countColor ?? (on ? TAB_ON_BG : (idleColor ?? TAB_IDLE_FG)) }]}>{t.count}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
            </Reanimated.View>
          );
        })}
      </Reanimated.View>
      </Animated.View>
    </ScrollView>
  );
}

/** Tabs arriving and leaving when the row's set changes. */
const TAB_ENTER = FadeIn.duration(220).delay(80);
const TAB_EXIT = FadeOut.duration(140);

const styles = StyleSheet.create({
  // Full width, edge to edge — the row scrolls under both sides of the screen.
  scroll: { width: '100%', flexGrow: 0 },
  // The first tab starts `inset` in; the padding is on the content, not the
  // scroll view, so the row itself still runs to both edges.
  row:   { alignItems: 'center' },
  // At least the row's width, so there's room for the tabs to grow into.
  rowStretch: { flexGrow: 1 },
  // Grow, not flex: 1 — each tab keeps its own width as the floor, so a row
  // that doesn't fit still scrolls rather than squeezing its labels.
  grow:  { flexGrow: 1 },
  // Scales from its left edge (the header's shrink), so the first tab stays put.
  itemsOuter: { flexDirection: 'row', transformOrigin: 'left center' },
  // The track.
  items: {
    flexDirection: 'row', alignItems: 'center', gap: TRACK_GAP,
    padding: TRACK_PAD, borderRadius: COMMON_RADIUS, backgroundColor: TRACK_BG,
  },
  // Under the labels, sliding between them — SubTabs' thumb, a size up.
  thumb: {
    position: 'absolute', top: TRACK_PAD, bottom: TRACK_PAD, left: 0,
    borderRadius: COMMON_RADIUS - TRACK_PAD,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: TAB_H, paddingHorizontal: 15,
  },
  pillStretch: { justifyContent: 'center' },
  // `dense`: a shorter tab in a track padded only at its ends.
  pillDense:   { height: TAB_H_DENSE },
  itemsDense:  { paddingVertical: TRACK_PAD_DENSE },
  thumbDense:  { top: TRACK_PAD_DENSE, bottom: TRACK_PAD_DENSE },
  pillIconOnly: { paddingHorizontal: 8, gap: 5 },
  // A lone icon in a row of labelled tabs: a little more room either side, so it's a tab and not a stray glyph.
  pillSoloIcon: { paddingHorizontal: 14 },
  // Semibold at rest.
  label: { fontSize: 15, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  labelStuck: { fontFamily: FONT_INTER.bold },
  // The unlit tabs a weight lighter, at rest and stuck, so the lit one leads.
  labelIdle: { fontFamily: FONT_INTER.medium },
  labelIdleStuck: { fontFamily: FONT_INTER.semibold },
  count: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  countText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  // A circle at one digit, a capsule past it.
  countCircle: {
    minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  round: { borderRadius: PILL_RADIUS },
});
