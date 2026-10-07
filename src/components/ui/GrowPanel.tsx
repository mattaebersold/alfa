import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Modal, Pressable, Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLOR_BLACK } from '../../constants/config';

/** A rectangle in window coordinates — where a button was when it was pressed. */
export interface GrowOrigin { x: number; y: number; w: number; h: number }

/** How much of the screen the open panel takes — at most; the content scrolls inside. */
export const GROW_PANEL_RATIO = 0.9;
/** The shortest a panel sized to its content gets, so a near-empty one still reads as a panel. */
const MIN_FIT_H = 220;
export const GROW_PANEL_RADIUS = 32;
/** How long the box takes to grow — and so how long the contents wait. */
const OPEN_MS = 260;
/** When the contents start to fade in — and so, near enough, become touchable. */
const CONTENT_DELAY_MS = 40;
/** The close: a fade, and a slight settle to this scale. */
const CLOSE_MS = 180;
const EXIT_SCALE = 0.94;
/**
 * How far past its mark the box goes before settling. The default back
 * easing (1.7) overshoots by a tenth, which on a box this size read as
 * wobble; this is a nudge — a couple of percent — that lets the box land
 * rather than stop dead. The bell's own copy uses the same figure.
 */
const OPEN_OVERSHOOT = 0.9;
/** Where the panel starts from on the way in, as a fraction of its size. */
const OPEN_SCALE_FROM = 0.9;
/** How far above its place the panel starts, coming straight down. */
const OPEN_DROP = 28;
/** How long the contents take to come up once the box has landed. */
const CONTENT_MS = 200;
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
// No blur any more: a blur can't fade (it is re-composited on every frame of
// an opacity change), so it either popped in or cost the whole open. A dark
// grey, translucent scrim fades in and out with the panel instead.
const BACKDROP = 'rgba(40,40,40,0.82)';
/**
 * SummaryModal's backdrop, for a panel that should read as one of those: a
 * lighter blur that stays put while a black tint fades over it (see there).
 */
// Android has no blur to separate the panel from the screen behind, so a
// lighter, heavier grey does it instead — against black the dark panels sank.
const SUMMARY_BACKDROP = 'rgba(20,20,20,0.85)';

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
  surface = COLOR_BLACK,
  backdrop = 'grey',
  contentFade,
}: {
  visible: boolean;
  /** The button's rect. Falls back to the header's right end when unmeasured. */
  origin?: GrowOrigin | null;
  onClose: () => void;
  /** Rendered inside the panel; gets `closeThen` to leave with. */
  children: (api: {
    closeThen: (run?: () => void) => void;
    expanded: boolean;
    /**
     * Size the panel to this — the content's own height — rather than the
     * screen, like SummaryModal. Capped at GROW_PANEL_RATIO of the screen, past
     * which the content scrolls. Never called, and the panel is full height.
     */
    fitHeight: (h: number) => void;
  }) => React.ReactNode;
  /** The panel's own colour — the box wears it while it grows. */
  surface?: string;
  /** `summary` borrows SummaryModal's backdrop, so the two look alike side by side. */
  backdrop?: 'grey' | 'summary';
  /**
   * The contents' fade-in, for a panel that wants it noticed: when it starts
   * and how long it takes, in ms. Defaults to a quick fade under the box's
   * own growth (CONTENT_DELAY_MS, CONTENT_MS).
   */
  contentFade?: { delay?: number; duration?: number };
}) {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get('window');

  // Nine tenths of the screen, or less when the content asked for less — and
  // never under the status bar, where on a short phone the centred top edge
  // would be.
  const [fit, setFit] = useState<number | null>(null);
  const fitHeight = useCallback((h: number) => setFit((prev) => (prev != null && Math.abs(prev - h) < 1 ? prev : h)), []);
  const maxH = screenH * GROW_PANEL_RATIO;
  const panelW = screenW * GROW_PANEL_RATIO;
  const panelH = fit != null ? Math.min(maxH, Math.max(MIN_FIT_H, fit)) : maxH;
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
  /** True once the contents start to show — gates touches on them. */
  const [expanded, setExpanded] = useState(false);
  /**
   * The close: the whole panel fading and settling a little smaller where it
   * is. It used to shrink back into the button that opened it, which on the
   * way out is a lot of travel for something you've already finished with.
   */
  const exit = useRef(new Animated.Value(1)).current;
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
    exit.setValue(1);
    setExpanded(false);
    // Touchable as soon as the contents start to show, not once every fade has
    // finished — waiting that out made the menu feel stuck for half a second.
    const fadeDelay = contentFade?.delay ?? CONTENT_DELAY_MS;
    const unlock = setTimeout(() => setExpanded(true), fadeDelay + 40);
    // One frame of head start, so the content mounts before the box moves.
    const raf = requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(box, {
          toValue: 1,
          // An ease-out with a small back: fast off the button, slowing into
          // place, a touch past it, then settled. On the native driver now:
          // it used to tween the box's left/top/width/height on the JS thread,
          // the one thread the menu's own mount was busy on, so it stuttered.
          duration: OPEN_MS,
          easing: Easing.out(Easing.back(OPEN_OVERSHOOT)),
          useNativeDriver: true,
        }),
        Animated.timing(reveal, {
          toValue: 1,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(content, {
          toValue: 1,
          // A little before the box has quite settled — the last of its
          // travel is the small overshoot, and the contents can ride that.
          delay: fadeDelay,
          // Unhurried, and a slight rise with the fade (see contentRise): the
          // contents settle onto the surface rather than switching on.
          duration: contentFade?.duration ?? CONTENT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
    return () => { cancelAnimationFrame(raf); clearTimeout(unlock); };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeThen = useCallback((run?: () => void) => {
    pending.current = run ?? null;
    setExpanded(false);
    Animated.parallel([
      // Fade and settle in place — quick, because a dismissal that lingers
      // feels like it didn't take. The box stays put; `exit` carries it.
      Animated.timing(exit, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(reveal, {
        toValue: 0,
        duration: CLOSE_MS,
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
  }, [onClose, exit, reveal]);

  const grow = (a: number, b: number) => box.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  /**
   * The panel's travel: down from just above its place, growing as it comes.
   * One axis only — moving on both at once from the button's corner read as
   * the menu arriving at an angle. A translate and a scale, so the native
   * driver runs it, rather than the rectangle itself being tweened.
   */
  const travel = {
    transform: [
      { translateY: grow(-OPEN_DROP, 0) },
      { scale: grow(OPEN_SCALE_FROM, 1) },
    ],
  };
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
        {/* The screen behind, dimmed, fading in and out with the panel. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: backdrop === 'summary' ? SUMMARY_BACKDROP : BACKDROP, opacity: reveal }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeThen()} accessibilityLabel="Close" />

        {/* The box and the content ride one wrapper, so the close fades and
            settles them together. Native-driven, and a separate view from the
            box's own layout animation, so the two drivers never share one. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: exit, transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [EXIT_SCALE, 1] }) }] }]}
          pointerEvents="box-none"
        >
        {/* The box and the content travel together — see `travel`. */}
        <Animated.View style={[StyleSheet.absoluteFill, travel]} pointerEvents="box-none">
        {/* The box: colour and shape only, at its final size throughout. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.morphBox,
            { backgroundColor: surface, opacity: boxOpacity },
            { left: panelX, top: panelY, width: panelW, height: panelH, borderRadius: GROW_PANEL_RADIUS },
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
            {children({ closeThen, expanded, fitHeight })}
          </Animated.View>
        </Animated.View>
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
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 10 },
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
