import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Modal, Pressable, Animated, Easing, Dimensions, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** A rectangle in window coordinates — where a button was when it was pressed. */
export interface GrowOrigin { x: number; y: number; w: number; h: number }

/** How much of the screen the open panel takes; the content scrolls inside. */
export const GROW_PANEL_RATIO = 0.9;
export const GROW_PANEL_RADIUS = 20;
/** The header buttons' corner radius, which the growing box starts from. */
const BTN_RADIUS = 14;
/** How long the box takes to grow — and so how long the contents wait. */
const OPEN_MS = 420;
/**
 * How far past its mark the box goes before settling. The default back
 * easing (1.7) overshoots by a tenth, which on a box this size read as
 * wobble; this is a nudge — a couple of percent — that lets the box land
 * rather than stop dead. The bell's own copy uses the same figure.
 */
const OPEN_OVERSHOOT = 0.9;
/** How long the contents take to come up once the box has landed. */
const CONTENT_MS = 520;
/** How far below their place the contents start, rising as they fade in. */
const CONTENT_RISE = 10;
/**
 * Grey, not black — the same scrim the notifications bell uses. The panel is
 * true black, and against a black scrim its edges vanished into the dim: the
 * menu read as the screen going dark with some tiles in it. Grey gives the
 * panel something to sit on. On iOS the blur beneath it does most of the
 * separating, so the tint can stay light; Android has only the tint, which
 * is why it's a shade heavier than the bell's.
 */
const BACKDROP = Platform.OS === 'ios' ? 'rgba(64,64,64,0.55)' : 'rgba(64,64,64,0.82)';

/**
 * A panel that grows out of the button that opened it.
 *
 * The notifications bell opened this way first, and it was the right way: the
 * box you get is visibly the thing you pressed, swelling to take the screen,
 * rather than a new surface arriving from an edge. Then the menu wanted it,
 * then the garage — three buttons in one header row behaving three ways was
 * the problem this solves. The bell keeps its own copy because it also
 * animates its badge and a ghost of its face; everything else uses this.
 *
 * ## How it animates
 *
 * Two animated values, deliberately, because they can't share a driver:
 *  - `box` (JS-driven) moves and resizes the growing rectangle and carries its
 *    corner radius from the button's to the panel's. Radius is why this can't
 *    be a transform: scaling a box to a fraction of its height scales its
 *    corners with it, and the thing collapsing back into a button ends up a
 *    sharp-cornered sliver.
 *  - `reveal` (native) fades the scrim and the content.
 *
 * The box that moves is childless. The content lives in its own layer at the
 * panel's final size and only ever fades, so nothing re-lays out while the box
 * is in motion — that was the flicker an earlier version had.
 *
 * `closeThen(run)` closes and runs `run` once the panel has gone. Navigation
 * belongs there: iOS won't present a screen over a modal that's still
 * dismissing, and a transition started mid-collapse collides with it.
 */
export default function GrowPanel({
  visible,
  origin,
  onClose,
  children,
  surface = '#000000',
}: {
  visible: boolean;
  /** The button's rect. Falls back to the header's right end when unmeasured. */
  origin?: GrowOrigin | null;
  onClose: () => void;
  /** Rendered inside the panel; gets `closeThen` to leave with. */
  children: (api: { closeThen: (run?: () => void) => void; expanded: boolean }) => React.ReactNode;
  /** The panel's own colour — the box wears it while it grows. */
  surface?: string;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get('window');

  // Nine tenths of the screen, and never under the status bar — on a short
  // phone the centred top edge would be.
  const panelW = screenW * GROW_PANEL_RATIO;
  const panelH = screenH * GROW_PANEL_RATIO;
  const panelX = (screenW - panelW) / 2;
  const panelY = Math.max(insets.top + 8, (screenH - panelH) / 2);

  const box = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  /**
   * The contents' own fade, held until the box has landed.
   *
   * The surface arrives, then what's on it: the contents start fading in the
   * moment the box stops growing, not before — filling a box still in motion
   * reads as a screen appearing rather than a panel opening. But only that
   * long. This used to wait a full second, which was the box's travel plus
   * cover for the old spring's overshoot; with a plain ease-out the box is
   * still at 420ms and there's nothing after it to wait for. On close they
   * go at once, ahead of the box.
   */
  const content = useRef(new Animated.Value(0)).current;
  /** True once the box has arrived — gates touches on the content. */
  const [expanded, setExpanded] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  // Held for the life of the animation: the origin is whatever button opened
  // us, and the panel has to shrink back to it even if the prop has moved on.
  const originRef = useRef<GrowOrigin>({ x: screenW - 16 - 42, y: insets.top + 8, w: 42, h: 42 });
  if (visible && origin) originRef.current = origin;
  const from = originRef.current;

  useEffect(() => {
    if (!visible) return;
    box.setValue(0);
    reveal.setValue(0);
    content.setValue(0);
    setExpanded(false);
    // Two frames of head start, so the content mounts before the box moves.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(box, {
          toValue: 1,
          // An ease-out with a small back: fast off the button, slowing into
          // place, a touch past it, then settled — all inside OPEN_MS, so the
          // contents still arrive on a box that has stopped. This was a spring
          // that overshot by a tenth and rocked back, and that much read as
          // wobble on a box this big.
          duration: OPEN_MS,
          easing: Easing.out(Easing.back(OPEN_OVERSHOOT)),
          useNativeDriver: false,
        }),
        Animated.timing(reveal, {
          toValue: 1,
          duration: 570,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(content, {
          toValue: 1,
          delay: OPEN_MS,
          // Unhurried, and a slight rise with the fade (see contentRise): the
          // contents settle onto the surface rather than switching on.
          duration: CONTENT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setExpanded(true);
      });
    }));
    return () => cancelAnimationFrame(raf);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeThen = useCallback((run?: () => void) => {
    pending.current = run ?? null;
    setExpanded(false);
    Animated.parallel([
      // Quick and fully damped on the way home: the open earns its slow
      // breath because you're waiting for the contents, but a close is a
      // dismissal, and a dismissal that lingers feels like it didn't take.
      Animated.spring(box, {
        toValue: 0,
        stiffness: 180,
        damping: 26,
        mass: 0.7,
        useNativeDriver: false,
      }),
      // Quicker than the box: the content is pinned at full size, so it has
      // to be gone before the box shrinks out from under it.
      Animated.timing(reveal, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(content, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      onClose();
      const go = pending.current;
      pending.current = null;
      go?.();
    });
  }, [onClose, box, reveal, content]);

  const grow = (a: number, b: number) => box.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  /**
   * The box is see-through at the button's size.
   *
   * It lands exactly on the button, and an opaque box there is a black
   * square sitting on the icon until the modal unmounts — the button looks
   * blanked out at the end of every close and the start of every open. Fading
   * it in over the first sliver of growth lets the real button show through
   * both moments; by the time it's opaque it's already visibly a panel.
   */
  const boxOpacity = box.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 1, 1] });
  /** The contents' rise, driven by their own fade so the two always agree. */
  const contentRise = content.interpolate({ inputRange: [0, 1], outputRange: [CONTENT_RISE, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => closeThen()} statusBarTranslucent>
      <View style={styles.fill}>
        {/* The screen behind, blurred and dimmed, fading with the panel.
            Blurred on iOS only: Android has no real backdrop blur without
            configuration the panel can't give it, and expo-blur's fallback
            there is a flat tint — which the scrim already is. */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal }]} pointerEvents="none">
          {Platform.OS === 'ios' && (
            <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeThen()} accessibilityLabel="Close" />

        {/* The growing box: colour and shape only, nothing to re-measure. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.morphBox,
            { backgroundColor: surface, opacity: boxOpacity },
            {
              left: grow(from.x, panelX),
              top: grow(from.y, panelY),
              width: grow(from.w, panelW),
              height: grow(from.h, panelH),
              borderRadius: grow(BTN_RADIUS, GROW_PANEL_RADIUS),
            },
          ]}
        />

        {/* The content, at its final size throughout — it only ever fades.
            Until the box has arrived it's invisible, and an invisible sheet
            must not swallow taps meant for the backdrop. */}
        <Animated.View
          style={[styles.panel, { left: panelX, top: panelY, width: panelW, height: panelH }]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          <Animated.View style={[styles.fill, { opacity: content, transform: [{ translateY: contentRise }] }]}>
            {children({ closeThen, expanded })}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /**
   * Stacking, bottom to top: scrim, backdrop press, the box, the content.
   * Both zIndex and elevation, because iOS honours tree order and zIndex
   * while Android honours elevation over tree order.
   */
  morphBox: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20,
    zIndex: 10, elevation: 20,
  },
  panel: {
    position: 'absolute',
    borderRadius: GROW_PANEL_RADIUS,
    overflow: 'hidden',
    zIndex: 20, elevation: 22,
  },
});
