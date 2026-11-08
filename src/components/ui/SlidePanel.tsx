import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR_BLACK, PANE_BG, PANE_SCRIM } from '../../constants/config';

/**
 * A full-height pane that wipes in from the right edge, pushing the whole app
 * left the same distance — the main menu (NavDrawer).
 *
 * How far it comes in, as a share of the screen's width. What's left of the
 * app shows in the strip beside it, under a grey wash, as the way back.
 */
export const SLIDE_PANEL_RATIO = 0.95;
/**
 * Unhurried, and eased hard at the far end: a long glide in that settles
 * softly rather than braking — the app and the pane move as one heavy sheet.
 */
const OPEN_MS = 460;
const CLOSE_MS = 380;
/** easeOutQuint-ish: quick off the mark, a long soft landing. */
const OPEN_EASE = Easing.bezier(0.22, 1, 0.36, 1);
/** Symmetric in-out: gathers, then glides home. */
const CLOSE_EASE = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * 0 shut; 1 open on the right (the app pushed left), -1 open on the left
 * (the app pushed right). Module-level, like useHeaderScroll's headerOffset: the pane
 * lives in a Modal and the app it pushes is the root view, so the two can't
 * share it through props. Only one slide panel is ever open.
 */
export const appPush = new Animated.Value(0);

/**
 * The app, riding the panel: wrapped round the navigator once (App.tsx), it
 * slides left as the panel comes in, by exactly the panel's width.
 */
export function AppPushView({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const shift = width * SLIDE_PANEL_RATIO;
  const translateX = appPush.interpolate({ inputRange: [-1, 0, 1], outputRange: [shift, 0, -shift] });
  return <Animated.View style={[styles.fill, { transform: [{ translateX }] }]}>{children}</Animated.View>;
}

/**
 * Same shape as GrowPanel's API, so a caller can swap one for the other: the
 * children are a function handed `closeThen`, which slides the panel (and the
 * app) back and only then runs what's next — iOS won't present a screen over
 * a Modal that's still up.
 */
export default function SlidePanel({ visible, onClose, side = 'right', fullBleed = false, children }: {
  visible: boolean;
  onClose: () => void;
  /** Which edge it comes in from — the app is pushed the other way. The menu's on the right, the garage's on the left. */
  side?: 'left' | 'right';
  /**
   * Contents to the screen's very top and bottom, behind the system's bars —
   * for a pane whose list should scroll under them. It then clears the bars
   * itself (useSafeAreaInsets).
   */
  fullBleed?: boolean;
  /** `fitHeight` is a no-op here (the pane is always full height) — it's there so GrowPanel's children work unchanged. */
  children: (api: { closeThen: (run?: () => void) => void; fitHeight: (h: number) => void }) => React.ReactNode;
}) {
  const open = side === 'right' ? 1 : -1;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const paneW = Math.round(width * SLIDE_PANEL_RATIO);
  /** Touchable once it's on its way in, not before — a pane still arriving mustn't eat a tap. */
  const [ready, setReady] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    appPush.setValue(0);
    setReady(false);
    // A frame's head start, so the pane mounts before anything moves.
    const raf = requestAnimationFrame(() => {
      Animated.timing(appPush, {
        toValue: open, duration: OPEN_MS, easing: OPEN_EASE, useNativeDriver: true,
      }).start();
      setReady(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeThen = useCallback((run?: () => void) => {
    pending.current = run ?? null;
    setReady(false);
    Animated.timing(appPush, {
      toValue: 0, duration: CLOSE_MS, easing: CLOSE_EASE, useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      onClose();
      const go = pending.current;
      pending.current = null;
      go?.();
    });
  }, [onClose]);

  const paneX = side === 'right'
    ? appPush.interpolate({ inputRange: [0, 1], outputRange: [paneW, 0], extrapolate: 'clamp' })
    : appPush.interpolate({ inputRange: [-1, 0], outputRange: [0, -paneW], extrapolate: 'clamp' });
  const wash = appPush.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, 1] });
  const noop = useCallback(() => {}, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => closeThen()}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.fill}>
        {/* The app, pushed away and greyed — the strip beside the pane is it,
            and a tap there brings it back. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: PANE_SCRIM, opacity: wash }]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeThen()} accessibilityLabel="Close menu" />

        <Animated.View
          style={[styles.pane, side === 'right' ? styles.paneRight : styles.paneLeft, { width: paneW, transform: [{ translateX: paneX }] }]}
          pointerEvents={ready ? 'auto' : 'none'}
        >
          {/* Inside the system's bars, top and bottom: the pane's ground runs
              behind them, its contents stop short of them. */}
          <View style={[styles.fill, !fullBleed && { marginTop: insets.top, marginBottom: insets.bottom }]}>
            {children({ closeThen, fitHeight: noop })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pane: {
    position: 'absolute', top: 0, bottom: 0,
    backgroundColor: PANE_BG,
    // A shadow off its leading edge, onto the app it pushed aside.
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16,
    elevation: 24,
  },
  paneRight: { right: 0 },
  paneLeft:  { left: 0 },
});
