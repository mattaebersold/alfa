import React, { useRef, useState } from 'react';
import { View, Animated, StyleSheet, type ScrollView, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SubTabs from '../components/ui/SubTabs';
import { headerBottom, holdHeader } from './useHeaderScroll';
import { GUTTER } from '../constants/config';

/** The pinned bar's height — what a section lands under when its tab is tapped. */
const BAR_H = 52;
/** How far the pinned bar rides up into the header's foot — its padding, not its buttons. */
const PIN_TUCK = 8;
/** Each tab's side padding: roomier than SubTabs' default. */
const TAB_PAD_X = 19;

/**
 * A long page's sections as sub tabs — the profile's, a car's.
 *
 * Each section reports where it sits (`measure(key)` on a wrapping View), and
 * a tab shows only for a section with something in it. The row (`row`) sits
 * in the page where the host puts it; once scrolled up to the header a copy
 * (`pinned`, rendered over the scroll view) pins just under the header's foot
 * and follows it if the header hides. A tap scrolls its section up under the
 * pinned bar; the lit tab follows the scroll. Spread `onScroll` into the
 * scroll view's, with `scrollEventThrottle={16}`.
 *
 * `headerPad` is the floating header's height (useHeaderPad), tabs and all.
 */
export function useSectionTabs<K extends string>({ sections, scrollRef, headerPad }: {
  sections: { key: K; label: string }[];
  scrollRef: React.RefObject<ScrollView | null>;
  headerPad: number;
}) {
  const insets = useSafeAreaInsets();
  const [layout, setLayout] = useState<Partial<Record<K, { y: number; h: number }>>>({});
  const [rowY, setRowY] = useState<number | null>(null);
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState<K | null>(null);
  /** While a tapped tab's scroll runs, the lit tab stays the tapped one. */
  const jumpingUntil = useRef(0);

  /** Where the pinned bar sits with the header shown — for the scroll maths. */
  const pinTop = headerPad - PIN_TUCK;
  /**
   * And live: under the header's foot as it slides away, stopping at the
   * status bar. As a translate from `pinTop`, not a `top` — the header's offset
   * runs on the native driver, which can move a view but not re-lay it out.
   */
  const pinShift = Animated.subtract(headerBottom(headerPad, insets.top + PIN_TUCK), headerPad);

  const measure = (key: K) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setLayout((prev) => (prev[key]?.y === y && prev[key]?.h === height ? prev : { ...prev, [key]: { y, h: height } }));
  };

  const tabs = sections.filter((sec) => (layout[sec.key]?.h ?? 0) > 0);
  const value = active ?? tabs[0]?.key;

  const jumpTo = (key: K) => {
    const at = layout[key];
    if (!at) return;
    setActive(key);
    jumpingUntil.current = Date.now() + 600;
    // A jump isn't a swipe: the header stays as it is through it.
    holdHeader(700);
    scrollRef.current?.scrollTo({ y: Math.max(0, at.y - pinTop - BAR_H), animated: true });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    if (rowY != null) {
      const next = y > rowY - pinTop;
      if (next !== stuck) setStuck(next);
    }
    if (Date.now() < jumpingUntil.current) return;
    // The last section whose top has reached the pinned bar.
    let current = tabs[0]?.key;
    for (const sec of tabs) {
      const at = layout[sec.key];
      if (at && at.y - pinTop - BAR_H - 8 <= y) current = sec.key;
    }
    if (current && current !== active) setActive(current);
  };

  const tabsEl = tabs.length > 1 && value ? (
    // In from the edges by the header's own margin, so the row lines up with
    // the buttons above it.
    <SubTabs options={tabs} value={value} onChange={jumpTo} padX={TAB_PAD_X} inset={GUTTER} />
  ) : null;

  // Hidden — but still holding its place — while the pinned copy shows, so
  // the two are never on screen together: with the header slid away the
  // pinned bar sits higher than where the row hands over to it.
  const row = (
    // No tabs, no room: an empty row's padding was a gap on a page with no sections.
    <View style={[tabsEl && styles.row, stuck && styles.rowHidden]} pointerEvents={stuck ? 'none' : 'auto'} onLayout={(e) => setRowY(e.nativeEvent.layout.y)}>
      {tabsEl}
    </View>
  );

  // Its black track straight over the page, no strip behind it.
  const pinned = stuck && tabsEl ? (
    <Animated.View style={[styles.pinned, { top: pinTop, transform: [{ translateY: pinShift }] }]} pointerEvents="box-none">
      {tabsEl}
    </Animated.View>
  ) : null;

  return { measure, row, pinned, onScroll };
}

const styles = StyleSheet.create({
  row: { paddingTop: 14 },
  rowHidden: { opacity: 0 },
  pinned: {
    position: 'absolute', left: 0, right: 0, zIndex: 15,
    height: BAR_H, justifyContent: 'center',
  },
});
