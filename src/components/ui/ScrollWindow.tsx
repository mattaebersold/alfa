import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Dimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/**
 * How much of a long scroll is worth keeping drawn: what's on screen, and
 * this many screens' height either side of it.
 */
const KEEP_SCREENS = 1.5;

/** Where a scroll view is looking, for the cards in it to check against. */
export type ScrollWindow = {
  top: number;
  height: number;
  subscribe: (fn: () => void) => () => void;
};

/**
 * A scroll view's window, and the handler that keeps it current — for a long
 * list that isn't a list: the Cars page's mosaic is one row of a FlatList, so
 * the list can't drop the cards in it that have scrolled far away, and every
 * car loaded kept its photo decoded for as long as the tab was open.
 */
export function useScrollWindow() {
  const store = useRef<ScrollWindow & { listeners: Set<() => void> }>({
    top: 0,
    height: Dimensions.get('window').height,
    listeners: new Set(),
    subscribe(fn) {
      store.current.listeners.add(fn);
      return () => { store.current.listeners.delete(fn); };
    },
  });
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const s = store.current;
    s.top = e.nativeEvent.contentOffset.y;
    s.height = e.nativeEvent.layoutMeasurement.height;
    s.listeners.forEach((fn) => fn());
  }, []);
  return { scrollWindow: store.current as ScrollWindow, onScroll };
}

/**
 * Draws its children only while they're near the window; further off, a gap
 * of the same height in their place, so nothing around it moves.
 *
 * Where it sits in the scroll is read from the screen once it's laid out —
 * its place on screen plus how far the view had scrolled — which assumes the
 * scroll view starts at the top of the screen, as the app's full-screen lists
 * do. Out by a little either way is absorbed by the screen and a half kept.
 * Not yet laid out, it's always drawn: a gap can't be sized from nothing.
 */
export function WindowGate({ window, children }: { window?: ScrollWindow; children: React.ReactNode }) {
  const ref = useRef<View>(null);
  const [frame, setFrame] = useState<{ y: number; h: number } | null>(null);
  const [near, setNear] = useState(true);

  useEffect(() => {
    if (!window || !frame) return;
    const check = () => {
      const keep = window.height * KEEP_SCREENS;
      setNear(frame.y + frame.h > window.top - keep && frame.y < window.top + window.height + keep);
    };
    check();
    return window.subscribe(check);
  }, [window, frame]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    if (!window) return;
    const h = e.nativeEvent.layout.height;
    const top = window.top;
    ref.current?.measureInWindow((_x, y) => {
      setFrame((f) => (f && Math.abs(f.y - (y + top)) < 1 && f.h === h ? f : { y: y + top, h }));
    });
  }, [window]);

  const gapped = !near && !!frame;
  return (
    <View ref={ref} collapsable={false} onLayout={onLayout} style={gapped ? { height: frame!.h } : undefined}>
      {gapped ? null : children}
    </View>
  );
}
