import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated, Easing,
  Platform, useWindowDimensions, type StyleProp, type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useKeyboardOverlap } from '../../hooks/useKeyboardHeight';
import { COMMON_RADIUS } from '../../constants/radius';

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

/** A ceiling, not a size — a short summary gets a short panel. */
const MAX_HEIGHT_RATIO = 0.9;
const PANEL_RADIUS = 20;
/** Height to assume before the content has been measured. */
const UNMEASURED_RATIO = 0.55;
/**
 * How small the panel starts.
 *
 * Fixed rather than derived from the tapped row: a list row is nearly the
 * panel's width, so matching it would mean starting at 0.9 and barely growing
 * at all. This reads as coming out of the row because of *where* it starts, not
 * because it matches its shape.
 */
const START_SCALE = 0.42;

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
 * Everything that moves is a `transform` or an `opacity`, on **one** view, on
 * the native driver. Nothing is laid out per frame.
 *
 * The first version grew the panel from the tapped row's exact rect by
 * animating `left`/`top`/`width`/`height` — a true morph. Those are layout
 * properties: they cannot run on the native driver, so every frame crossed the
 * bridge and triggered a layout pass, and that is visibly janky however little
 * is inside the box. Two rewrites chasing it (a childless box, then a static
 * content layer) each helped and neither fixed it, because the cost was the
 * layout animation itself.
 *
 * So the morph is gone, replaced by a uniform scale from the row's position.
 * Lost: the panel no longer matches the row's exact shape on the way up. Kept:
 * it still comes out of the row you tapped, and the corners stay right. An
 * earlier attempt at a transform failed on that last point only because the
 * scale was wildly *non-uniform* — a fourteenth vertically against an eighth
 * horizontally — which turns square corners into ellipses. A uniform scale
 * gives a small box proportionally small corners, which is how a small box
 * should look.
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
  stacked,
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
  /**
   * A second summary to present over this one — see "Stacking" above. Render
   * it here rather than next to this panel, or it won't appear on iOS.
   */
  stacked?: React.ReactNode;
  children: React.ReactNode;
}) {
  const parentPanel = useSummaryPanel();
  const colors = useColors();
  const brand = useBrandColor();
  const { width: screenW, height: screenH } = useWindowDimensions();

  /** Stays true through the closing animation, so the panel can be seen leaving. */
  const [rendered, setRendered] = useState(false);
  /** True once grown — gates touches, so a panel still arriving can't eat them. */
  const [expanded, setExpanded] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const wasVisible = useRef(false);

  const progress = useRef(new Animated.Value(0)).current;

  /**
   * How far the panel has to rise to clear the keyboard.
   *
   * Only a summary with a field in it (the invite) ever raises one; for every
   * other summary this stays at zero. Applied to a wrapper rather than to the
   * panel itself, because the panel's transform is on the native driver and
   * this one can't be.
   */
  const panelRef = useRef<View>(null);
  const { animated: keyboardLift, onLayout: onPanelLayout } = useKeyboardOverlap(panelRef, 16);

  const panelW = screenW * WIDTH_RATIO;
  const panelX = (screenW - panelW) / 2;
  const maxH = screenH * MAX_HEIGHT_RATIO;

  /**
   * The panel's height: the scroller's content plus the footer.
   *
   * Measured off the scroller rather than off any container — this panel has no
   * height until it is given one, and a ScrollView inside a container with no
   * height reports almost nothing. Plain state, not an animated value: it
   * changes once or twice per open, so it costs one layout pass, not one per
   * frame.
   */
  const [scrollH, setScrollH] = useState<number | null>(null);
  const [footerH, setFooterH] = useState(0);
  const measured = scrollH == null ? null : scrollH + footerH;
  const settledH = Math.min(measured ?? maxH * UNMEASURED_RATIO, maxH);
  const panelY = (screenH - settledH) / 2;

  // Held for the life of the animation: `origin` belongs to a row that may well
  // unmount while the panel is open, and the panel still has to shrink back to
  // where it came from.
  const fallback: SummaryOrigin = { x: screenW / 2, y: screenH / 2, w: 0, h: 0 };
  const originRef = useRef<SummaryOrigin>(origin ?? fallback);
  if (visible && origin) originRef.current = origin;
  const from = (visible ? origin : originRef.current) ?? fallback;

  useEffect(() => {
    if (visible === wasVisible.current) return;
    wasVisible.current = visible;

    if (visible) {
      setRendered(true);
      setScrollH(null);
      progress.setValue(0);
      // One frame of head start, so the content's first (and only) layout pass
      // happens before the animation rather than during it.
      requestAnimationFrame(() => {
        Animated.spring(progress, {
          toValue: 1,
          stiffness: 200,
          damping: 20,
          mass: 0.9,
          useNativeDriver: true,
        }).start(({ finished }) => { if (finished) setExpanded(true); });
      });
      return;
    }

    setExpanded(false);
    Animated.timing(progress, {
      toValue: 0,
      // Slower than it arrives. Opening is a response to a tap and wants to
      // feel immediate; closing is the panel taking its leave, and at 190ms it
      // read as being snatched away.
      duration: 300,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setRendered(false);
      const go = pendingAction.current;
      pendingAction.current = null;
      if (go) requestAnimationFrame(go);
    });
  }, [visible, progress]);

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
  const panelHandle = useMemo<SummaryPanelHandle>(() => ({ closeThen }), [closeThen]);

  const runAction = useCallback(() => closeThen(onAction), [closeThen, onAction]);

  if (!rendered) return null;

  // Where the panel comes from: the tapped row's centre, relative to its own.
  // Translate is listed before scale, which keeps it in unscaled units.
  const dx = (from.x + from.w / 2) - (panelX + panelW / 2);
  const dy = (from.y + from.h / 2) - (panelY + settledH / 2);

  const track = (a: number, b: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
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
        <BlurView tint="dark" intensity={24} style={StyleSheet.absoluteFill} pointerEvents="none" />
      )}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          Platform.OS === 'ios' ? styles.scrim : styles.scrimOpaque,
          { opacity: progress },
        ]}
        pointerEvents="none"
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close"
      />

      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateY: Animated.multiply(keyboardLift, -1) }] }]}
        pointerEvents="box-none"
      >
      {/* The panel. Laid out once, then only transformed and faded. */}
      <Animated.View
        ref={panelRef}
        onLayout={onPanelLayout}
        style={[
          styles.panel,
          { borderColor: colors.border },
          { left: panelX, top: panelY, width: panelW, height: settledH },
          {
            opacity: progress.interpolate({
              inputRange: [0, 0.35, 1], outputRange: [0, 0.85, 1], extrapolate: 'clamp',
            }),
            transform: [
              { translateX: track(dx, 0) },
              { translateY: track(dy, 0) },
              { scale: track(START_SCALE, 1) },
            ],
          },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        {/* The scroller belongs to the panel rather than to each summary: it's
            the only thing that knows how tall the content wants to be, and
            every summary needs the same "grow to fit, then scroll". */}
        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
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
              style={[styles.actionBtn, { backgroundColor: brand }]}
              onPress={runAction}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {/* Black rather than `contrastText(brand)`. Both brand fills are
                  light — a mid blue and a gold — and the automatic contrast
                  picked white on the blue, which read as thin against it.
                  Black is the deliberate answer on both. */}
              <Text style={[styles.actionText, styles.onBrand]}>{actionLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      {/* Outside the panel, above its top-right corner — over the content it
          sat on the photo every summary opens with, and on a pale one it had
          to carry its own dark disc to stay visible. Out here it's on the
          dimmed backdrop, where white reads on its own. Clamped so a tall
          panel on a short screen can't push it off the top. */}
      <Animated.View
        style={[
          styles.close,
          { left: panelX + panelW - CLOSE_SIZE, top: Math.max(10, panelY - CLOSE_SIZE - 10) },
          { opacity: progress },
        ]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color="#FFFFFF" strokeWidth={2.2} />
        </TouchableOpacity>
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
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  // Doing the whole job on its own where there is no blur under it.
  scrimOpaque: { backgroundColor: 'rgba(0,0,0,0.78)' },

  panel: {
    position: 'absolute',
    borderRadius: PANEL_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    // Opaque: the blurred screen behind must not read through the panel that
    // is covering it.
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
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
  actionBtn: { borderRadius: COMMON_RADIUS, paddingVertical: 14, alignItems: 'center' },
  actionText:{ fontSize: 16, fontWeight: '600' },
  onBrand:   { color: '#000000' },
});
