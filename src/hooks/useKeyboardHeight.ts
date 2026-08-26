import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Platform } from 'react-native';
import type { KeyboardEvent } from 'react-native';

/**
 * How much of the screen the software keyboard is covering.
 *
 * The app is edge-to-edge on Android and its sheets are `statusBarTranslucent`
 * modals, and neither of those windows gets resized when the keyboard opens —
 * `adjustResize` and `KeyboardAvoidingView` both have nothing to act on. So the
 * inset is driven from the keyboard events directly, which behaves the same on
 * both platforms and hands us the system's own animation curve to move with.
 *
 * ## Why the two platforms are measured differently
 *
 * iOS reports the keyboard's frame, and `keyboardWillChangeFrame` fires for
 * every one of them — opening, closing, switching to the emoji keyboard,
 * growing a suggestion bar, docking a hardware keyboard's accessory strip.
 * Measuring from the frame's top edge (`screenY`) rather than its height is
 * what makes all of those land in the right place: a keyboard that's off-screen
 * has a `screenY` at the bottom of the window, so the arithmetic gives zero
 * without needing to special-case it, and a hardware keyboard's bare accessory
 * bar gives its own small height rather than a full keyboard's.
 *
 * Android only emits `keyboardDidShow` / `keyboardDidHide`, after the fact, and
 * its `screenY` is in screen coordinates that don't line up with the window
 * under edge-to-edge. Its `height` is well defined, so that's what's used, with
 * the hide event zeroing it explicitly.
 */
export interface KeyboardInset {
  /** Current height in points. 0 when the keyboard is down. */
  height: number;
  /**
   * The same value as an `Animated.Value`, moved on the system's own timing.
   * Drive `paddingBottom` / `translateY` off this rather than off `height`, so
   * the layout travels with the keyboard instead of snapping when it lands.
   *
   * JS-driven: neither padding nor layout height exists on the native side.
   */
  animated: Animated.Value;
  /** True from the moment the keyboard starts coming up. */
  visible: boolean;
}

export function useKeyboardInset(): KeyboardInset {
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState(false);
  const animated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const apply = (next: number, duration: number) => {
      setHeight(next);
      setVisible(next > 0);
      Animated.timing(animated, {
        toValue: next,
        // Android's `did` events arrive after the keyboard has finished moving,
        // so there's nothing left to travel with — a short fixed slide reads
        // better there than a curve that's already over.
        duration: duration || (Platform.OS === 'ios' ? 250 : 160),
        useNativeDriver: false,
      }).start();
    };

    if (Platform.OS === 'ios') {
      const onFrame = (e: KeyboardEvent) => {
        const windowH = Dimensions.get('window').height;
        apply(Math.max(0, windowH - e.endCoordinates.screenY), e.duration);
      };
      const change = Keyboard.addListener('keyboardWillChangeFrame', onFrame);
      // `willChangeFrame` covers dismissal too, but an interactive drag-to-
      // dismiss can end without one — this guarantees we get back to zero.
      const hide = Keyboard.addListener('keyboardWillHide', (e) => apply(0, e?.duration ?? 0));
      return () => { change.remove(); hide.remove(); };
    }

    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      apply(e.endCoordinates.height, e.duration));
    const hide = Keyboard.addListener('keyboardDidHide', (e) => apply(0, e?.duration ?? 0));
    return () => { show.remove(); hide.remove(); };
  }, [animated]);

  return { height, animated, visible };
}

/** Just the number, for callers that lay out from state rather than animate. */
export function useKeyboardHeight(): number {
  return useKeyboardInset().height;
}
