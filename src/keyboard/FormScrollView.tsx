import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, type NativeScrollEvent, type NativeSyntheticEvent, type View } from 'react-native';
import {
  KeyboardAwareScrollView,
  useKeyboardState,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

/** Clear space kept between the field you're typing in and the top of the keyboard. */
export const KEYBOARD_GAP = 24;

/**
 * The one way a form meets the keyboard, in every app.
 *
 * Put a form's fields in this instead of a ScrollView. Whichever field is
 * focused is scrolled to sit just above the keyboard — on focus, as the
 * keyboard rises, when you move to the next field, and as a multiline field
 * grows. There's nothing to measure and nothing to wire up per field.
 *
 * When the form is too short to scroll a field that far (the last field, or a
 * form that fits on screen), the view adds the keyboard's height as room at
 * the bottom, so there's always somewhere to scroll to. That's the whole
 * trick: the field never has to fit — the scroll view grows to make it.
 *
 * A field that needs more than a caret's worth of room under it asks for it
 * with `useKeyboardRoom` while it's focused, and the field is lifted that much
 * higher. One whose list opens *above* it (AutocompleteField) goes the other
 * way with `useKeyboardLift`: scrolled down to sit on the keyboard, so the
 * list has the screen above it.
 *
 * Built on react-native-keyboard-controller, which App.tsx wraps in its
 * `KeyboardProvider` at the root.
 */
const RoomContext = createContext<((px: number) => void) | null>(null);

/**
 * Set by a surface that already gives the keyboard its room — a sheet whose
 * column shrinks by the keyboard's height (SharedModal, on keyboard/
 * KeyboardAvoidingView). A FormScrollView inside it then adds no keyboard
 * space of its own: with both, the content gained a keyboard's worth of
 * empty room under its last field, and a short form sat at the top of the
 * sheet with nothing but padding below. The scroll-to-the-field pass still
 * runs; only the spacer goes.
 */
const HandledContext = createContext(false);
export function KeyboardHandledAbove({ children }: { children: React.ReactNode }) {
  return <HandledContext.Provider value>{children}</HandledContext.Provider>;
}

/**
 * Where a lifted field ended up: how far the form scrolled to put it there
 * (positive is up), and the top of the form's visible area, in window points.
 */
export type KeyboardLift = { shift: number; top: number };
type Lift = (node: View) => Promise<KeyboardLift | null>;
const LiftContext = createContext<Lift | null>(null);
/** Who wants to hear the form scroll — something drawn outside it, pinned to a field in it. */
const ScrolledContext = createContext<Set<() => void> | null>(null);

const FormScrollView = forwardRef<KeyboardAwareScrollViewRef, KeyboardAwareScrollViewProps>(
  function FormScrollView({ bottomOffset = KEYBOARD_GAP, children, onScroll, onContentSizeChange, onLayout, extraKeyboardSpace, ...rest }, ref) {
    const inner = useRef<KeyboardAwareScrollViewRef>(null);
    // Under a surface that handles the keyboard, take the keyboard's height
    // back off the spacer — see HandledContext.
    const handledAbove = useContext(HandledContext);
    const keyboardHeight = useKeyboardState((st) => st.height);
    const extraSpace = handledAbove ? -keyboardHeight : (extraKeyboardSpace ?? 0);
    useImperativeHandle(ref, () => inner.current as KeyboardAwareScrollViewRef);

    const [room, setRoom] = useState(0);

    // A new amount of room applies to the field already focused, not only the
    // next one: re-run the "keep it visible" pass once the offset has landed.
    useEffect(() => {
      inner.current?.assureFocusedInputVisible();
    }, [room]);

    // Kept for `lift`, which scrolls by a distance and so needs a start.
    const offsetY = useRef(0);
    const contentH = useRef(0);
    const viewH = useRef(0);
    const scrolled = useRef(new Set<() => void>()).current;

    /**
     * Scroll so `node`'s bottom sits just above the keyboard — down to it, not
     * only up out from behind it, which is all the aware view does. For a
     * field whose list opens above it: the lower the field, the more list.
     */
    const lift = useCallback<Lift>((node) => new Promise((resolve) => {
      const sv = inner.current as any;
      const kb = Keyboard.metrics();
      if (!sv || !kb) { resolve(null); return; }
      sv.measureInWindow((_sx: number, top: number) => {
        node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
          const delta = y + h - (kb.screenY - bottomOffset);
          // The keyboard's height is scrollable room under the content while it's up.
          const max = Math.max(0, contentH.current + kb.height - viewH.current);
          const next = Math.min(max, Math.max(0, offsetY.current + delta));
          const shift = next - offsetY.current;
          if (Math.abs(shift) > 1) sv.scrollTo({ y: next, animated: true });
          resolve({ shift, top });
        });
      });
    }), [bottomOffset]);

    return (
      <RoomContext.Provider value={setRoom}>
      <LiftContext.Provider value={lift}>
      <ScrolledContext.Provider value={scrolled}>
        <KeyboardAwareScrollView
          ref={inner}
          bottomOffset={bottomOffset + room}
          extraKeyboardSpace={extraSpace}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offsetY.current = e.nativeEvent.contentOffset.y;
            scrolled.forEach((fn) => fn());
            onScroll?.(e);
          }}
          onContentSizeChange={(w: number, h: number) => {
            contentH.current = h;
            onContentSizeChange?.(w, h);
          }}
          onLayout={(e) => {
            viewH.current = e.nativeEvent.layout.height;
            onLayout?.(e);
          }}
          // A tap on a button or a suggestion while typing should land, not
          // just close the keyboard.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          {...rest}
        >
          {children}
        </KeyboardAwareScrollView>
      </ScrolledContext.Provider>
      </LiftContext.Provider>
      </RoomContext.Provider>
    );
  },
);

export default FormScrollView;

/**
 * Ask the enclosing FormScrollView to keep `px` clear below the focused field.
 * Returns a setter: pass the room on focus and 0 on blur. A no-op outside one.
 */
export function useKeyboardRoom(): (px: number) => void {
  const set = useContext(RoomContext);
  return useCallback((px: number) => set?.(px), [set]);
}

/**
 * Ask the enclosing FormScrollView to scroll a view down (or up) to just above
 * the keyboard. Call it once the keyboard is up. Resolves null outside one, or
 * with no keyboard.
 */
export function useKeyboardLift(): Lift {
  const lift = useContext(LiftContext);
  return useCallback<Lift>((node) => (lift ? lift(node) : Promise.resolve(null)), [lift]);
}

/** Calls `fn` whenever the enclosing FormScrollView scrolls. A no-op outside one. */
export function useFormScrolled(fn: () => void) {
  const set = useContext(ScrolledContext);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(() => {
    if (!set) return undefined;
    const call = () => latest.current();
    set.add(call);
    return () => { set.delete(call); };
  }, [set]);
}

/** The least a list above a field is squeezed to — about two rows. */
const ROOM_ABOVE_MIN = 90;
/** Between the list and the field it hangs off. */
const ROOM_ABOVE_GAP = 6;

/**
 * For a field whose list opens above it (a tag search, a spot search): once
 * the keyboard is up, bring the field down to sit on it, and size the list to
 * what's left between the field and the top of the form. The lower the field,
 * the more list; the list never runs up under the header or off the screen.
 *
 * Put `ref` on the view around the field (`collapsable={false}`), call
 * `onFocus` / `onBlur` from the input, and cap the list at `maxHeight`, which
 * starts at `max`. Outside a FormScrollView nothing scrolls and the cap stays
 * at `max`. AutocompleteField does the same, with a portal on top.
 */
export function useRoomAbove(max: number) {
  const lift = useKeyboardLift();
  const ref = useRef<View>(null);
  const [maxHeight, setMaxHeight] = useState(max);
  /** Focus as of now, so a measurement that lands after a blur is dropped. */
  const hasFocus = useRef(false);
  const waiting = useRef<{ remove: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    waiting.current?.remove();
    waiting.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  // After the keyboard is up, and a beat after that: the form's own scroll
  // (out from behind the keyboard) runs as it rises, and this should land
  // after it rather than race it.
  const onFocus = useCallback(() => {
    hasFocus.current = true;
    stop();
    const run = () => {
      timer.current = null;
      const node = ref.current;
      if (!hasFocus.current || !node) return;
      node.measureInWindow((_x, top) => {
        lift(node).then((r) => {
          if (!hasFocus.current || !r) return;
          const room = top - r.shift - r.top - ROOM_ABOVE_GAP;
          setMaxHeight(Math.max(ROOM_ABOVE_MIN, Math.min(max, room)));
        });
      });
    };
    if (Keyboard.isVisible()) {
      timer.current = setTimeout(run, 150);
    } else {
      waiting.current = Keyboard.addListener('keyboardDidShow', () => {
        waiting.current?.remove();
        waiting.current = null;
        timer.current = setTimeout(run, 50);
      });
    }
  }, [lift, max, stop]);

  const onBlur = useCallback(() => {
    hasFocus.current = false;
    stop();
  }, [stop]);

  return { ref, maxHeight, onFocus, onBlur };
}
