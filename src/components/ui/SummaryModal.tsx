import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated, Easing, Platform,
  useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useKeyboardOverlap } from '../../hooks/useKeyboardHeight';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** The rectangle a summary grows out of, in window coordinates. */
export interface SummaryOrigin { x: number; y: number; w: number; h: number }

/**
 * Measures a view and hands its rect on — or `null` when there's nothing
 * mounted to measure, which opens the panel from the centre instead.
 *
 * Split out of SummaryTouchable for rows whose tap target isn't the row itself
 * (a "View" button inside it), but whose panel should still grow out of the row.
 */
export function measureOrigin(
  node: View | null,
  then: (origin: SummaryOrigin | null) => void,
) {
  if (!node) return then(null);
  node.measureInWindow((x, y, w, h) => then({ x, y, w, h }));
}

/**
 * What a summary's contents — and any summary stacked on it — can ask of the
 * panel they're in.
 */
export interface SummaryPanelHandle {
  /**
   * Close this panel, then run `run` once it has gone.
   *
   * When this panel is itself stacked on another, the whole stack closes before
   * `run` does: whatever `run` navigates to would otherwise open *under* the
   * panel that's still up, and on iOS a screen can't be presented over a modal
   * at all.
   */
  closeThen: (run?: () => void) => void;
  /**
   * Scroll the panel's body so this view is in sight.
   *
   * For a field that opens partway down the content — a reply under a
   * comment. When the keyboard comes up the panel shrinks to fit above it
   * (see "The keyboard" at the lift below), and a field that was in view can
   * end up under the fold. Measured in window coordinates, the same ones the
   * panel is sized in, so it is right whatever the panel has done.
   */
  scrollIntoView: (node: { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null) => void;
  /** Scroll the panel's body to its foot — for a composer that lives there. */
  scrollToEnd: (animated?: boolean) => void;
}

const SummaryPanelContext = createContext<SummaryPanelHandle | null>(null);

/**
 * The panel the caller is inside, or `null` outside one.
 *
 * Called from a summary's *contents*, it's that summary's panel. Called from a
 * component that renders a SummaryModal of its own, it's the panel *that* one
 * is stacked on — which is how a stacked summary knows to close its parent.
 */
export const useSummaryPanel = () => useContext(SummaryPanelContext);

/**
 * A row or card that hands its own position to its press handler, so the
 * summary it opens can grow out of it.
 *
 * Lives here rather than in each list because measuring needs a ref per item,
 * and a ref per item needs a component per item — which is the whole reason
 * the callers were passing `null` and getting a panel from nowhere.
 */
export function SummaryTouchable({
  onPress,
  children,
  style,
  activeOpacity = 0.85,
  disabled,
  accessibilityLabel,
}: {
  onPress: (origin: SummaryOrigin | null) => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const ref = useRef<View>(null);

  return (
    <TouchableOpacity
      ref={ref}
      style={style}
      activeOpacity={activeOpacity}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => measureOrigin(ref.current, onPress)}
    >
      {children}
    </TouchableOpacity>
  );
}

const WIDTH_RATIO = 0.9;
/** The close button's edge, and so how far above the panel it sits. */
const CLOSE_SIZE = 38;
/** Space between the close button and the panel, and between it and the status bar. */
const CLOSE_GAP = 10;

const PANEL_RADIUS = 32;
/** The panel's border, which the content sits inside rather than over. */
const PANEL_BORDER = 1;
/** Height to assume before the content has been measured. */
const UNMEASURED_RATIO = 0.55;
/**
 * The least a panel shrinks to for the keyboard. Below this it rises instead:
 * better a panel partly under the status bar than one too short to show the
 * field being typed into and anything of what it's answering.
 */
const MIN_KEYBOARD_H = 220;
/** How long the box takes to grow — and so how long the contents wait. */
const OPEN_MS = 420;
/**
 * How far past its mark the box goes before settling — a nudge, not a
 * wobble. The same figure as GrowPanel's, which this now opens like.
 */
const OPEN_OVERSHOOT = 0.9;
/** How long the contents take to come up once the box has landed. */
const CONTENT_MS = 260;
/**
 * Slower than it arrives. Opening is a response to a tap and wants to feel
 * immediate; closing is the panel taking its leave, and at 190ms it read as
 * being snatched away.
 */
const CLOSE_MS = 180;
/** When the contents start to fade in — and so, near enough, become scrollable. */
const CONTENT_DELAY_MS = 300;
/** The close settles to this scale as it fades. */
const EXIT_SCALE = 0.94;

/**
 * A summary of one thing, in a panel that grows out of whatever you tapped.
 *
 * The pattern: a list shows you enough to find the thing, this shows you enough
 * to decide about it, and "view more" is the way to the whole page. Tapping a
 * row in a list shouldn't have to mean leaving the list.
 *
 * The panel takes its height from its content, up to 90% of the screen — past
 * that the content scrolls inside it. A fixed 90% left a two-line summary
 * sitting in a mostly-empty box.
 *
 * ## Why it animates the way it does
 *
 * The same way GrowPanel does, with two layers and three values:
 *  - The **box** is childless: the black surface, its border and its shadow,
 *    and nothing else. It morphs from the tapped row's rect to the panel's on
 *    the JS driver (`box`), since position, size and corner radius are layout.
 *    With nothing inside it there's nothing to re-lay out, so a frame costs
 *    one rectangle. It's see-through at the row's size and opaque by an
 *    eighth of the way out, so it never sits as a black slab on the row.
 *  - The **content** is laid out once, at the panel's final size, and only
 *    ever fades (`content`, native). It waits for the box to land.
 *  - The scrim and the close button fade on `reveal` (native).
 *
 * The version before this put all of it — surface, content, and a uniform
 * scale out of the row — on one view, driven natively, and on iOS the black
 * surface appeared only once the grow had finished. Two things fed that:
 *  - The panel re-renders while it grows: the scroller reports its content
 *    height a frame or two in, and that moves the panel and its origin
 *    offsets. Each render built fresh interpolations of a natively-driven
 *    value, and a natively-driven value's JS side still reads 0 until the
 *    animation ends — so every mid-grow commit handed the panel opacity 0
 *    and start-scale again, and it stayed that way until the finished
 *    spring synced its 1 back.
 *  - The spring started a frame after the Modal was *asked* for, not after
 *    it was on screen. iOS presents it as a view controller of its own, and
 *    a native animation that runs while that's still happening drives views
 *    that aren't there yet.
 *
 * So here the surface lives on the JS driver, where every commit carries its
 * real current value; every native-driven view has a style that never
 * changes from render to render, so a re-render has nothing to overwrite; and
 * nothing starts until the Modal reports itself shown.
 *
 * ## Stacking
 *
 * A summary can open another over itself — a group's member, a post's liker —
 * through `stacked`. That node is rendered *inside* this panel's Modal, not
 * beside it, and that placement is the whole trick:
 *
 * - iOS presents a Modal from the nearest view controller up its view tree.
 *   Inside this panel, that's this panel's own controller, so the second one
 *   presents over it. As a sibling it would try to present from the root
 *   controller, which is already presenting this panel — and UIKit refuses
 *   that with a console warning and nothing on screen.
 * - Android gives every Modal its own Dialog window, and a newer one sits over
 *   an older one wherever it was rendered, so either placement works there.
 *   Back closes the top one first, because the top Dialog takes the key.
 *
 * Any action in a stacked summary — its bottom button, or anything its
 * contents run through `useSummaryPanel().closeThen` — closes the whole stack
 * before it runs. See SummaryPanelHandle.
 */
export default function SummaryModal({
  visible,
  onClose,
  origin,
  actionLabel = 'View more',
  onAction,
  actionIcon: ActionIcon,
  actionPill = false,
  actionColor,
  stacked,
  header,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Rect to grow out of. The centre of the screen when omitted. */
  origin?: SummaryOrigin | null;
  /** Bottom button. Omitted along with `onAction` to leave it out. */
  actionLabel?: string;
  /**
   * Runs *after* the panel has finished closing — iOS won't present a screen
   * over a modal that is still dismissing, and this is nearly always a
   * navigation.
   */
  onAction?: () => void;
  /** An icon before the bottom button's label — a message bubble, say. */
  actionIcon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /**
   * The bottom button as a pill in the body font, rather than the rounded
   * rectangle in the heading face — for an action phrased as a sentence
   * ("Message @matt about this") rather than a word.
   */
  actionPill?: boolean;
  /** The bottom button's fill, instead of the brand colour — gold for a purchase. */
  actionColor?: string;
  /**
   * A second summary to present over this one — see "Stacking" above. Render
   * it here rather than next to this panel, or it won't appear on iOS.
   */
  stacked?: React.ReactNode;
  /**
   * Pinned above the scroller — a heading that should stay put while the
   * content under it scrolls, and stay in sight when the keyboard shrinks the
   * panel and the scroller goes to the field.
   */
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const parentPanel = useSummaryPanel();
  const colors = useColors();
  const brand = useBrandColor();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /** Stays true through the closing animation, so the panel can be seen leaving. */
  const [rendered, setRendered] = useState(false);
  /** True once grown — gates touches, so a panel still arriving can't eat them. */
  const [expanded, setExpanded] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const wasVisible = useRef(false);
  /**
   * Whether the Modal is up. Reopening during the close animation finds it
   * still up, and then there's no `onShow` coming to start the grow.
   */
  const presented = useRef(false);

  /** The box's morph — JS-driven: it's layout. */
  const box = useRef(new Animated.Value(0)).current;
  /** The scrim and the close button — native. */
  const reveal = useRef(new Animated.Value(0)).current;
  /** The contents' fade, held until the box has landed — native. */
  const content = useRef(new Animated.Value(0)).current;
  /** The close: 1 while up, fading and settling smaller to 0 on the way out. */
  const exit = useRef(new Animated.Value(1)).current;
  /** When the contents become scrollable — cleared if it closes first. */
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Built once, not per render: see "Why it animates" — a native-driven view
  // whose props are the same from one render to the next is one a mid-grow
  // re-render leaves alone.
  const fadeStyles = useMemo(() => ({
    reveal: { opacity: reveal },
    content: { flex: 1, opacity: content },
  }), [reveal, content]);

  /**
   * How far the panel has to rise to clear the keyboard.
   *
   * Only a summary with a field in it (the invite) ever raises one; for every
   * other summary this stays at zero. Applied to a wrapper rather than to the
   * panel itself, so the layers inside it can each keep their own driver.
   */
  // Measured off an invisible stand-in at the panel's resting rect rather
  // than off the panel: the panel shrinks and rises for the keyboard, and
  // measuring a view mid-move is what had it bouncing on Android. See the
  // hook's `resting`.
  const restRef = useRef<View>(null);
  const { lift, animated: keyboardLift, onLayout: onRestLayout } = useKeyboardOverlap(restRef, 16, { resting: true });
  const keyboardUp = lift > 0;
  /** The body's scroller, and where it is — for scrollIntoView. */
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const panelW = screenW * WIDTH_RATIO;
  const panelX = (screenW - panelW) / 2;
  /**
   * Short enough that the close button, which sits above the panel, always
   * clears the status bar. The panel is centred, so the room it leaves above
   * is half of what it leaves in all — at the full ratio on a notched phone
   * the button landed on the clock and the battery, where it can't be tapped.
   */
  const closeClearance = insets.top + CLOSE_SIZE + CLOSE_GAP * 2;
  /**
   * Room kept at the foot: clear of the home indicator, and no more. The top
   * has to leave the close button its room, but the bottom has nothing to
   * leave room for — so a tall panel uses it, rather than stopping as far
   * from the bottom as it does from the top.
   */
  const footClearance = insets.bottom + CLOSE_GAP * 2;
  const maxH = screenH - closeClearance - footClearance;

  /**
   * The panel's height: the scroller's content plus the footer.
   *
   * Measured off the scroller rather than off any container — this panel has no
   * height until it is given one, and a ScrollView inside a container with no
   * height reports almost nothing. Plain state, not an animated value: it
   * changes once or twice per open, so it costs one layout pass, not one per
   * frame. The box follows it on the JS driver, so a late measurement moves
   * the box's target rather than fighting a native animation.
   */
  const [scrollH, setScrollH] = useState<number | null>(null);
  const [footerH, setFooterH] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const measured = scrollH == null ? null : scrollH + headerH + footerH + PANEL_BORDER * 2;
  const liveH = Math.min(measured ?? maxH * UNMEASURED_RATIO, maxH);
  /**
   * Held still while the keyboard is up.
   *
   * The lift was computed against this height and this screen. Anything that
   * moves either while the keyboard is up — Android resizing the window
   * under the keyboard, a content measurement arriving late, a field growing
   * a line — would move the resting rect, and the lift with it: the panel
   * visibly hunting. So the panel keeps the size it had when the keyboard
   * came up, and takes any change once the keyboard has gone.
   */
  const held = useRef(liveH);
  if (!keyboardUp) held.current = liveH;
  const settledH = keyboardUp ? held.current : liveH;
  // Centred while it fits; past that, pinned under the close button and
  // growing down toward the foot.
  const panelY = Math.max(closeClearance, (screenH - settledH) / 2);

  /**
   * The keyboard: the panel rises only as far as the close button's room
   * allows, and gives up height for the rest.
   *
   * It used to rise by the whole overlap. A short panel (the invite) has room
   * above it and that was fine; a tall one (the comments) had none, and the
   * whole thing went up under the status bar, its top third off the screen.
   * Now the overlap is split, rise first: `moveUp` is what fits in the room
   * above, and `shrink` is the remainder, taken off the panel's height so its
   * foot lands on the keyboard with its head under the close button. A
   * centred panel rises and shrinks together; one already pinned at the top
   * only shrinks. The scroller inside is the part that gives, which is what
   * it's for. A floor keeps the field and some of the thread in view; past it
   * the panel rises after all.
   *
   * Both are derived from the hook's one animated value, so they ease on the
   * keyboard's own timing. The hook's self-correction holds: it recovers the
   * resting position by adding the lift it applied back onto where the panel's
   * foot is, and the foot has moved by exactly moveUp + shrink.
   */
  const room = Math.max(0, panelY - closeClearance);
  const maxShrink = Math.max(0, settledH - MIN_KEYBOARD_H);
  const clampTo = (v: Animated.Animated, cap: number) =>
    cap > 0
      ? (v as Animated.Value).interpolate({ inputRange: [0, cap], outputRange: [0, cap], extrapolate: 'clamp' })
      : (v as Animated.Value).interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  const moveUp = clampTo(keyboardLift, room);
  const shrink = clampTo(Animated.subtract(keyboardLift, moveUp), maxShrink);
  // Whatever neither could take: the panel rises regardless, as it used to.
  const overflow = Animated.subtract(Animated.subtract(keyboardLift, moveUp), shrink);
  const rise = Animated.add(moveUp, overflow);

  // Held for the life of the animation: `origin` belongs to a row that may well
  // unmount while the panel is open, and the panel still has to shrink back to
  // where it came from.
  const fallback: SummaryOrigin = { x: screenW / 2, y: screenH / 2, w: 0, h: 0 };
  const originRef = useRef<SummaryOrigin>(origin ?? fallback);
  if (visible && origin) originRef.current = origin;
  const from = (visible ? origin : originRef.current) ?? fallback;

  const grow = useCallback(() => {
    // Two frames of head start, so the content's first layout pass — and the
    // re-render its measurement causes — land before the box moves.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(box, {
          toValue: 1,
          // An ease-out with a small back: fast off the row, slowing into
          // place, a touch past it, settled — all inside OPEN_MS.
          duration: OPEN_MS,
          easing: Easing.out(Easing.back(OPEN_OVERSHOOT)),
          useNativeDriver: false,
        }),
        Animated.timing(reveal, {
          toValue: 1,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // The surface arrives, then what's on it: filling a box still in
        // motion reads as a screen appearing rather than a panel opening.
        //
        // A little before the box has quite settled, though — the last of its
        // travel is the small overshoot, and the contents can ride that.
        Animated.timing(content, {
          toValue: 1,
          delay: CONTENT_DELAY_MS,
          duration: CONTENT_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      // Scrollable as soon as the contents start to show, not once every fade
      // has finished — waiting that out made a panel feel stuck.
      unlockTimer.current = setTimeout(() => setExpanded(true), CONTENT_DELAY_MS + 60);
    }));
  }, [box, reveal, content]);

  const onShow = useCallback(() => {
    presented.current = true;
    // Closed again before the Modal made it up: growing now would stop the
    // close animation short, and the panel would never unmount.
    if (wasVisible.current) grow();
  }, [grow]);

  useEffect(() => {
    if (visible === wasVisible.current) return;
    wasVisible.current = visible;

    if (visible) {
      setRendered(true);
      box.setValue(0);
      reveal.setValue(0);
      content.setValue(0);
      exit.setValue(1);
      // Already up means reopened mid-close: same content, which won't report
      // a size change, so keep the height it last measured — and no `onShow`
      // is coming, so start from here. Otherwise the Modal's `onShow` does.
      if (presented.current) grow();
      else setScrollH(null);
      return;
    }

    setExpanded(false);
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    // Fade and settle in place, rather than flying back to the row it came
    // from — on the way out that travel is just something to wait for.
    Animated.parallel([
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
      presented.current = false;
      setRendered(false);
      const go = pendingAction.current;
      pendingAction.current = null;
      if (go) requestAnimationFrame(go);
    });
  }, [visible, box, reveal, content, exit, grow]);

  // Through refs, because a stacked panel calls `closeThen` from its own close
  // animation's callback — a closure from a render 300ms ago, whose `onClose`
  // may since have been replaced.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const parentRef = useRef(parentPanel);
  parentRef.current = parentPanel;

  const closeThen = useCallback((run?: () => void) => {
    const parent = parentRef.current;
    // Up the stack before running: the parent closes (and so on up), and only
    // the last one to go runs `run`.
    pendingAction.current = run ? (parent ? () => parent.closeThen(run) : run) : null;
    onCloseRef.current();
  }, []);
  const scrollIntoView = useCallback<SummaryPanelHandle['scrollIntoView']>((node) => {
    const scroller = scrollRef.current;
    if (!node || !scroller) return;
    // The scroller's host view is what has a window position.
    const host = scroller.getNativeScrollRef?.() as unknown as { measureInWindow?: typeof node.measureInWindow } | null;
    if (!host?.measureInWindow) return;
    host.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
      node.measureInWindow((_nx, ny, _nw, nh) => {
        if (!sh || !nh) return;
        const below = ny + nh - (sy + sh);
        const above = sy - ny;
        if (below > 0) scroller.scrollTo({ y: scrollOffset.current + below + 8, animated: true });
        else if (above > 0) scroller.scrollTo({ y: Math.max(0, scrollOffset.current - above - 8), animated: true });
      });
    });
  }, []);
  const scrollToEnd = useCallback((animated = true) => { scrollRef.current?.scrollToEnd({ animated }); }, []);

  const panelHandle = useMemo<SummaryPanelHandle>(
    () => ({ closeThen, scrollIntoView, scrollToEnd }),
    [closeThen, scrollIntoView, scrollToEnd],
  );



  const runAction = useCallback(() => closeThen(onAction), [closeThen, onAction]);

  if (!rendered) return null;

  const track = (a: number, b: number) =>
    box.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
    >
      <SummaryPanelContext.Provider value={panelHandle}>
      {/* Blur plus a tint, not a tint alone: the panel sits over a list of the
          very things it is summarising, and the blur is what stops the row
          behind it competing with it.

          It never animates. A blur that fades re-composites everything behind
          it every frame, which is the most expensive thing this component could
          do. Android gets none — it is costlier there and the platform
          imitation is poor, so it takes a heavier scrim instead.

          To rule the blur out as a cost, delete these three lines; nothing else
          depends on it. */}
      {Platform.OS === 'ios' && (
        <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'ios' ? styles.scrim : styles.scrimOpaque,
          fadeStyles.reveal,
        ]}
        pointerEvents="none"
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close"
      />

      <View
        ref={restRef}
        onLayout={onRestLayout}
        pointerEvents="none"
        style={{ position: 'absolute', left: panelX, top: panelY, width: panelW, height: settledH }}
      />

      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: Animated.multiply(rise, -1) }] }]}
        pointerEvents="box-none"
      >
      {/* The close's fade and settle, on its own view: the box inside runs a
          JS-driven layout animation, and one view can't mix the two drivers. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: exit, transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [EXIT_SCALE, 1] }) }] }]}
        pointerEvents="box-none"
      >
      {/* The growing box: the surface, and nothing to re-measure. See-through
          at the row's size — opaque there, it's a black slab on the row at the
          start of every open and the end of every close — and solid by the
          time it's visibly a panel. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.box,
          { borderColor: colors.border },
          {
            opacity: box.interpolate({
              inputRange: [0, 0.12, 1], outputRange: [0, 1, 1], extrapolate: 'clamp',
            }),
            left: track(from.x, panelX),
            top: track(from.y, panelY),
            width: track(from.w, panelW),
            height: Animated.subtract(track(from.h, settledH), shrink),
            borderRadius: track(Math.min(PANEL_RADIUS, from.h / 2), PANEL_RADIUS),
          },
        ]}
      />

      {/* The content, at the panel's final size throughout. The positioned
          view is plain, so a late measurement moving it touches no animated
          props; the fade is on the view inside, whose style never changes. */}
      <Animated.View
        style={[styles.panel, { left: panelX, top: panelY, width: panelW, height: Animated.subtract(settledH, shrink) }]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <Animated.View style={fadeStyles.content}>
          {header ? (
            <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>{header}</View>
          ) : null}
          {/* The scroller belongs to the panel rather than to each summary: it's
              the only thing that knows how tall the content wants to be, and
              every summary needs the same "grow to fit, then scroll". */}
          <ScrollView
            ref={scrollRef}
            style={styles.body}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => { scrollOffset.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={32}
            // A button under an open keyboard should take the first tap, not
            // spend it on dismissing the keyboard.
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={(_w, h) => setScrollH(h)}
          >
            {children}
          </ScrollView>

          {onAction && (
            <View
              style={[styles.footer, { borderTopColor: colors.border }]}
              onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
            >
              <TouchableOpacity
                style={[styles.actionBtn, actionPill && styles.actionPill, { backgroundColor: actionColor ?? brand }]}
                onPress={runAction}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {/* Black rather than `contrastText(brand)`. Both brand fills are
                    light — a mid blue and a gold — and the automatic contrast
                    picked white on the blue, which read as thin against it.
                    Black is the deliberate answer on both. */}
                {ActionIcon ? <ActionIcon size={16} color={COLOR_BLACK} strokeWidth={2.4} /> : null}
                <Text
                  style={[actionPill ? styles.actionPillText : styles.actionText, styles.onBrand]}
                  numberOfLines={1}
                >
                  {actionLabel}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </Animated.View>

      {/* Outside the panel, above its top-right corner — over the content it
          sat on the photo every summary opens with, and on a pale one it had
          to carry its own dark disc to stay visible. Out here it's on the
          dimmed backdrop, where white reads on its own. Clamped so a tall
          panel on a short screen can't push it off the top. Positioned by a
          plain view and faded by the one inside, for the same reason as the
          content. */}
      <View
        style={[
          styles.close,
          { left: panelX + panelW - CLOSE_SIZE, top: Math.max(insets.top + CLOSE_GAP, panelY - CLOSE_SIZE - CLOSE_GAP) },
        ]}
        pointerEvents={expanded ? 'box-none' : 'none'}
      >
        <Animated.View style={fadeStyles.reveal}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={22} color={COLOR_WHITE} strokeWidth={2.2} />
          </TouchableOpacity>
        </Animated.View>
      </View>
      </Animated.View>
      </Animated.View>

      {/* Last, and inside this Modal — see "Stacking" above. A Modal takes no
          room in the layout it's written in, so where in here it sits doesn't
          matter; that it's in here at all is what lets iOS present it. */}
      {stacked}
      </SummaryPanelContext.Provider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Lighter than it would be on its own — the blur underneath is doing most of
  // the separating.
  // A dark grey over the blur — the screen behind reads as dimmed and
  // frosted, so the panel stands forward of it rather than sitting on a
  // screen that is still nearly as bright as it is.
  scrim: { backgroundColor: 'rgba(30,30,30,0.55)' },
  // Android, with no blur under it: doing the whole job on its own, as a
  // heavier grey. GrowPanel's `summary` backdrop matches it.
  scrimOpaque: { backgroundColor: 'rgba(20,20,20,0.92)' },

  /**
   * Stacking, bottom to top: scrim, backdrop press, the box, the content, the
   * close button. Both zIndex and elevation, because iOS honours tree order
   * and zIndex while Android honours elevation over tree order.
   */
  box: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: PANEL_BORDER,
    // Opaque: the blurred screen behind must not read through the panel that
    // is covering it.
    backgroundColor: COLOR_BLACK,
    shadowColor: COLOR_BLACK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    zIndex: 10, elevation: 20,
  },
  // No surface of its own — the box under it is the surface. The transparent
  // border keeps the content inside the box's border rather than over it.
  panel: {
    position: 'absolute',
    borderRadius: PANEL_RADIUS,
    borderWidth: PANEL_BORDER,
    borderColor: 'transparent',
    overflow: 'hidden',
    zIndex: 20, elevation: 22,
  },
  // Takes what the footer leaves. Once the content is taller than the cap, this
  // is the bounded box it scrolls inside.
  body: { flexShrink: 1 },

  close: { position: 'absolute', width: CLOSE_SIZE, height: CLOSE_SIZE, zIndex: 30, elevation: 24 },
  closeBtn: {
    width: CLOSE_SIZE, height: CLOSE_SIZE, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    // Faint disc rather than none: the backdrop is a blurred photograph as
    // often as not, and a bare glyph disappears into a bright one.
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  footer:    { padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: {
    borderRadius: COMMON_RADIUS, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  actionPill: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 16 },
  actionPillText: { fontSize: 14.5, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  actionText:{ fontSize: 16, fontFamily: FONT_INTER.semibold },
  onBrand:   { color: COLOR_BLACK },
});
