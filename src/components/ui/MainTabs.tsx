import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { GUTTER, COLOR_WHITE, COLOR_BORDER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** One entry in a main tab row. */
export interface MainTab<K extends string = string> {
  key: K;
  label: string;
  /** Before the label, in the label's colour — the group page's tabs wear them too. */
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** A number after the label — how many are behind it. Nothing for 0 or none. */
  count?: number;
}

/**
 * Where a picked tab settles, in points from the row's left edge — far enough
 * in that the tab before it peeks into view. Not the first tab, which stays
 * on the inset.
 */
const ACTIVE_LEFT = 50;
/** Clear space after the last tab, at the end of the row's scroll. */
const END_SPACE = 24;
/** An unlit tab's label and icon — full white; the grey outline and lighter weight keep the lit one leading. */
const TAB_IDLE = COLOR_WHITE;

/**
 * Main tabs: the home screen's row of outlined pills — the lit one lettered
 * and outlined in the account's colour (red for Pro, blue otherwise), the
 * rest white on a grey outline, a weight lighter.
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
 * `stretch` spreads a short row across the full width: the tabs grow to
 * share what's left over, like flex. A row too long to fit keeps the tabs at
 * their own widths and scrolls as usual.
 *
 * The app header draws its tabs with this, and passes `itemsStyle` (the
 * shrink and indent as the header sticks) and `stuck` (the heavier weight
 * that goes with it). Anywhere else leaves both off.
 */
export default function MainTabs<K extends string>({
  tabs, value, onChange, inset = GUTTER, stretch = false, stuck = false, itemsStyle, contentContainerStyle, style,
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
  itemsStyle?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}) {
  const brand = useBrandColor();

  // Positions are each tab's own x within the row, measured as they lay out;
  // the row's inset is outside that, so it's added back to find where the tab
  // sits against the row's edge.
  const scrollRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!value) return;
    const x = tabX.current[value];
    if (x == null) return;
    const first = value === tabs[0]?.key;
    const to = first ? 0 : Math.max(0, inset + x - ACTIVE_LEFT);
    scrollRef.current?.scrollTo({ x: to, animated: true });
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
      <Animated.View style={[styles.items, stretch && styles.grow, itemsStyle]}>
        {tabs.map((t) => {
          const on = t.key === value;
          const color = on ? brand : TAB_IDLE;
          return (
            <TouchableOpacity
              key={t.key}
              onLayout={(e) => { tabX.current[t.key] = e.nativeEvent.layout.x; }}
              onPress={() => onChange?.(t.key)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={stretch && styles.grow}
            >
              <View style={[styles.pill, stretch && styles.pillStretch, { borderColor: on ? brand : COLOR_BORDER }]}>
                {t.Icon ? <t.Icon size={15} color={color} strokeWidth={on ? 2.4 : 2} /> : null}
                <Text
                  style={[
                    styles.label,
                    { color },
                    !on && styles.labelIdle,
                    stuck && (on ? styles.labelStuck : styles.labelIdleStuck),
                  ]}
                >
                  {t.label}
                </Text>
                {t.count ? (
                  // The lit tab's count filled in its colour; the rest a quiet grey.
                  <View style={[styles.count, on && { backgroundColor: brand }]}>
                    <Text style={[styles.countText, { color: on ? contrastText(brand) : COLOR_WHITE }]}>{t.count}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </ScrollView>
  );
}

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
  items: { flexDirection: 'row', alignItems: 'center', gap: 8, transformOrigin: 'left center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 34, paddingHorizontal: 14, borderRadius: 999,
    // The header buttons' outline: the same width, and unlit, the same colour.
    borderWidth: 1,
  },
  pillStretch: { justifyContent: 'center' },
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
});
