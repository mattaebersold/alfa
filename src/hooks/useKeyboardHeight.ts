import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform } from 'react-native';
import type { KeyboardEvent } from 'react-native';

// Only SummaryModal still lifts itself this way. Everything else meets the
// keyboard through the kit: FormScrollView for forms, KeyboardAvoidingView for
// a composer under a list or a sheet riding on the keyboard.

/**
 * How far a view has to rise to clear the keyboard — measured, not computed.
 *
 * Every previous attempt at this did arithmetic: take the window height, take
 * the keyboard height, subtract, and hope the two numbers are in the same
 * coordinate space. On iOS they are. On Android, under edge-to-edge inside a
 * `statusBarTranslucent` Modal, they are not reliably — `Dimensions.get(
 * 'window')` and the keyboard's reported height disagree about whether the
 * navigation bar is part of the window, and the error is a device-dependent
 * band of 24–48pt. That band is exactly the height of a text input, which is
 * why the composer kept ending up just under the keyboard instead of just
 * above it.
 *
 * So this doesn't compute where the view *should* be. It asks the view where
 * it *is* — `measureInWindow`, in the same screen coordinates the keyboard
 * reports its own top edge in — and returns the difference. Two measurements
 * of the same kind, subtracted; no assumption about what the window includes.
 *
 * It is also self-correcting. The measurement is taken while the previous lift
 * is applied, so the lift is added back to recover the resting position before
 * comparing. Whatever else on screen is already moving this view — a sheet
 * that resizes for the keyboard, a safe-area inset — is therefore accounted
 * for automatically: if something else has already cleared the keyboard, the
 * overlap is zero and this contributes nothing.
 *
 * Apply the result as `marginBottom`/`paddingBottom` on a composer sitting at
 * the bottom of a flex column, so the scrollable content above it absorbs the
 * loss. Applying it as a transform moves the whole column and pushes the top
 * off-screen instead.
 */
export interface KeyboardOverlap {
  /** Points to raise the view by. Zero whenever it already clears. */
  lift: number;
  /** The same value, eased on the keyboard's own timing. */
  animated: Animated.Value;
  /** Wire to the composer's `onLayout` so growth is re-measured. */
  onLayout: () => void;
}

type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

export function useKeyboardOverlap(
  ref: React.RefObject<Measurable | null>,
  /** Breathing room between the view's bottom edge and the keyboard. */
  gap = 6,
): KeyboardOverlap {
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);
  // Screen Y of the keyboard's top edge; null whenever it's down.
  const keyboardTop = useRef<number | null>(null);
  const animated = useRef(new Animated.Value(0)).current;

  const apply = useCallback((next: number, duration: number) => {
    if (next === liftRef.current) return;
    liftRef.current = next;
    setLift(next);
    Animated.timing(animated, {
      toValue: next,
      duration: duration || 180,
      // Layout height — there is no native equivalent to drive.
      useNativeDriver: false,
    }).start();
  }, [animated]);

  const remeasure = useCallback((duration = 0) => {
    const node = ref.current;
    const top = keyboardTop.current;
    if (!node) return;
    if (top == null) return apply(0, duration);

    node.measureInWindow((_x, y, _w, h) => {
      if (!h) return; // not laid out yet — a later pass will catch it
      // Where this view would sit with no lift applied.
      const restingBottom = y + h + liftRef.current;
      apply(Math.max(0, Math.round(restingBottom - top + gap)), duration);
    });
  }, [ref, apply, gap]);

  useEffect(() => {
    const onShow = (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY;
      remeasure(e.duration);
      // Later passes, because a stale measurement is the difference between
      // clearing the keyboard and not. On Android the layout and the event
      // don't reliably arrive in that order — `keyboardDidShow` can fire
      // before the view tree has settled at its new size — so one frame later
      // and once more after the animation would have finished. Each pass is a
      // no-op if nothing moved, so the extra work costs a measure and stops.
      requestAnimationFrame(() => remeasure(0));
      if (Platform.OS === 'android') {
        setTimeout(() => remeasure(120), 150);
      }
    };
    const onHide = (e: KeyboardEvent) => {
      keyboardTop.current = null;
      apply(0, e?.duration ?? 0);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    return () => { show.remove(); hide.remove(); };
  }, [remeasure, apply]);

  /**
   * Call from the composer's `onLayout`.
   *
   * A multiline input grows as you type, and a view that was clear of the
   * keyboard at one line is not at four.
   */
  const onLayout = useCallback(() => remeasure(0), [remeasure]);

  return { lift, animated, onLayout };
}
