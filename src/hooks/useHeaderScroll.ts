import { useCallback, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * Auto-hiding header state.
 *
 * The header bar is an absolute overlay rendered as a *sibling* of each
 * screen's scroll view, so the two can't share state through props. Only one
 * screen is on-screen at a time, so a module-level animated value is enough —
 * and it keeps screens from each needing a context provider.
 *
 * `headerOffset` is 0 when shown and -hideDistance when hidden; AppHeader binds
 * it to a translateY.
 */
export const headerOffset = new Animated.Value(0);

/** Ignore jitter below this many points of scroll delta. */
const DELTA_THRESHOLD = 6;

/** Don't start hiding until the user is meaningfully down the list. */
const ENGAGE_AFTER = 24;

let hidden = false;
let animation: Animated.CompositeAnimation | null = null;

function setHidden(next: boolean, hideDistance: number) {
  if (next === hidden) return;
  hidden = next;

  animation?.stop();
  animation = Animated.timing(headerOffset, {
    toValue: next ? -hideDistance : 0,
    duration: 220,
    useNativeDriver: true,
  });
  animation.start();
}

/**
 * Bring the header back into view, animated — the same slide it makes when
 * you scroll up, from wherever it is. Always runs, whatever it thinks its
 * state is, so it can't be left part-way.
 */
export function showHeader() {
  hidden = false;
  animation?.stop();
  animation = Animated.timing(headerOffset, {
    toValue: 0,
    duration: 220,
    useNativeDriver: true,
  });
  animation.start();
}

/** Snap the header back into view without animating — used on screen mount. */
export function resetHeader() {
  animation?.stop();
  hidden = false;
  headerOffset.setValue(0);
}

/**
 * Returns an `onScroll` handler that hides the header on downward scroll and
 * reveals it on upward scroll. Spread onto a scroll view together with
 * `scrollEventThrottle={16}`.
 *
 * @param hideDistance How far the header travels to clear the screen —
 *                     normally `useHeaderPad()`.
 */
export function useHeaderScroll(hideDistance: number) {
  const lastY = useRef(0);

  // A screen that mounts (or refocuses) should always start with the header up.
  useEffect(() => {
    resetHeader();
    lastY.current = 0;
    return resetHeader;
  }, []);

  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastY.current;

      // Near the top the header is always visible, so overscroll bounce can't
      // leave it stuck off-screen.
      if (y <= ENGAGE_AFTER) {
        setHidden(false, hideDistance);
      } else if (dy > DELTA_THRESHOLD) {
        setHidden(true, hideDistance);
      } else if (dy < -DELTA_THRESHOLD) {
        setHidden(false, hideDistance);
      }

      lastY.current = y;
    },
    [hideDistance]
  );
}

/**
 * Where the floating header's bottom edge is, live: `headerPad` while it's
 * shown, sliding up as it hides. For something that pins under the header and
 * follows it — the marketplace's sticky search bar.
 *
 * A header with tabs only travels `stickRise` before its tab row sticks under
 * the status bar (AppHeader's TABS_STUCK_RISE); without tabs it goes all the
 * way, and the edge stops at `floor` (the status bar's inset, say).
 */
export function headerBottom(headerPad: number, floor: number, stickRise?: number) {
  if (stickRise != null) {
    return headerOffset.interpolate({
      inputRange: [-stickRise, 0],
      outputRange: [headerPad - stickRise, headerPad],
      extrapolate: 'clamp',
    });
  }
  return headerOffset.interpolate({
    inputRange: [-headerPad, 0],
    outputRange: [Math.min(floor, headerPad), headerPad],
    extrapolate: 'clamp',
  });
}
