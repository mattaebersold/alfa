import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, Dimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useKeyboardInset, useComposerBottomPad } from '../../hooks/useKeyboardHeight';
import { COMMON_RADIUS } from '../../constants/radius';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Near-black surfaces — matches the car-detail pane look.
const SHEET_BG = '#161616';
// The header used to be pure black against the body's #161616, which read as a
// separate bar stuck on top of the sheet rather than part of it. One ground,
// with a hairline to mark the edge.
const SHEET_HEADER_BG = SHEET_BG;

/** How far down a drag has to go before release dismisses rather than snaps back. */
const DISMISS_DISTANCE = 90;
/** Or how fast, so a short flick still closes. */
const DISMISS_VELOCITY = 0.8;

// Android's bottom system UI (gesture bar / nav buttons) overlaps the sheet, so
// pad the bottom to keep content clear of it. iOS clearance is handled by the
// safe-area layout, so this is Android-only.

interface SharedModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Custom header content in place of the plain `title` text — for headers that
   * need more than a string (an avatar plus a name, say).
   */
  titleContent?: React.ReactNode;
  /** Extra element rendered on the right of the header (before the close X). */
  headerRight?: React.ReactNode;
  /**
   * Fired once the close animation finishes and the underlying RN Modal has
   * unmounted. Use this to chain a follow-up modal (iOS can't present a new
   * modal until the current one has fully dismissed).
   */
  onDismissed?: () => void;
  /**
   * Fill the screen instead of sizing to content.
   *
   * Content-sized is right for a sheet you skim and dismiss, but wrong for one
   * you live in — a chat thread sized to its content opens at the 50% floor and
   * leaves its message list with no room to scroll.
   */
  fullHeight?: boolean;
  /**
   * Pin the sheet to a fraction of the screen (0–1) instead of sizing to
   * content. For a sheet whose contents vary wildly — a list that might hold
   * two rows or fifty — a stable height beats one that jumps per open.
   */
  heightRatio?: number;
  /**
   * Keep the X in the header.
   *
   * Every sheet has a grabber now — tap it or drag it down — so the X is a
   * second control for the same job. It stays available for sheets that want
   * the extra affordance.
   */
  showClose?: boolean;
  children: React.ReactNode;
}

/**
 * Shared bottom-sheet modal — near-black, blurred overlay, grows with content
 * between 50% and 90% of screen height, or fills the screen with `fullHeight`.
 * Convert other modals to this when asked to "use SharedModal". The caller
 * supplies the scrollable content as children.
 */
export default function SharedModal({ visible, onClose, title, titleContent, headerRight, onDismissed, fullHeight = false, heightRatio, showClose = false, children }: SharedModalProps) {
  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);
  const insets = useSafeAreaInsets();

  /**
   * Keyboard clearance. The sheet sits on the bottom of the screen, which is
   * exactly what the keyboard covers, so the inset needs no correction — the
   * whole stack is simply padded up by it. See useKeyboardInset for why this
   * isn't a KeyboardAvoidingView.
   */
  const { height: keyboardHeight } = useKeyboardInset();
  const bottomPad = useComposerBottomPad();

  /**
   * The room the sheet has to live in, once the keyboard has taken its share.
   *
   * The sheet is resized rather than pushed. Padding the stack by the keyboard
   * moved the whole sheet — header, content and composer as one block — which
   * for a tall sheet means jamming it against the top of the screen and leaving
   * the composer stranded in the middle. Capping the height instead keeps the
   * bottom edge on the keyboard and lets the scrollable middle absorb the loss.
   */
  const available = SCREEN_HEIGHT - keyboardHeight - insets.top - 8;

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setRendered(true);
      slideY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        mountedRef.current = false;
        setRendered(false);
        onDismissed?.();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Drag the sheet down to dismiss it, by its grabber.
   *
   * The grabber is the affordance people already reach for on a sheet, and it
   * was missing — the only way out was the X, or a tap on the backdrop nobody
   * knew was tappable. The pan lives on the header rather than the whole sheet
   * so it can't fight a scrolling list underneath.
   *
   * Built once and held in a ref: PanResponder reads its handlers at creation,
   * so rebuilding it per render would hand the Modal a new responder mid-drag.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        // Downward only — dragging up shouldn't lift the sheet off the bottom.
        if (g.dy > 0) slideY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        // Far enough, or fast enough. A flick should close even if it's short.
        if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
          onCloseRef.current();
        } else {
          Animated.spring(slideY, {
            toValue: 0, tension: 60, friction: 12, useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={styles.stack}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]} pointerEvents="none">
          <BlurView tint="dark" intensity={28} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            heightRatio
              ? [styles.sheetRatio, { height: `${Math.round(heightRatio * 100)}%` as const }]
              : fullHeight ? styles.sheetFull : styles.sheetSized,
            {
              // The real home-indicator inset, and zero while the keyboard is
              // up — see useComposerBottomPad.
              paddingBottom: bottomPad,
              // Never taller than the space above the keyboard, and sitting
              // directly on top of it.
              maxHeight: available,
              // Capped against `available` for the same reason: a minimum
              // taller than the room left over beats the maximum and undoes it.
              ...(heightRatio || fullHeight
                ? null
                : { minHeight: Math.min(SCREEN_HEIGHT * 0.5, available) }),
              marginBottom: keyboardHeight,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          {/* No status-bar padding of its own. `maxHeight: available` already
              stops every sheet — full-height included — an inset plus 8pt short
              of the top of the screen, so adding the inset again here counted it
              twice and opened a band of dead black above the title. */}
          <View {...panResponder.panHandlers}>
            {/* Tap it or drag it down — both close. */}
            <Pressable onPress={onClose} style={styles.grabberHit} hitSlop={6}>
              <View style={styles.grabber} />
            </Pressable>
            <View style={styles.header}>
              {titleContent ?? <Text style={styles.title} numberOfLines={1}>{title}</Text>}
              <View style={styles.headerRight}>
                {headerRight}
                {showClose && (
                  <TouchableOpacity onPress={onClose} hitSlop={8}>
                    <X size={22} color="rgba(255,255,255,0.7)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stack: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SHEET_BG,
    overflow: 'hidden',
  },
  sheetSized: {
    borderTopLeftRadius: COMMON_RADIUS,
    borderTopRightRadius: COMMON_RADIUS,
  },
  // Fills whatever the keyboard leaves, so the sheet shrinks rather than slides
  // and its own bottom bar stays on screen. It still caps below the status bar
  // — `maxHeight: available` keeps it clear of the inset — so it has a top edge
  // to round like every other sheet.
  sheetFull: {
    flex: 1,
    borderTopLeftRadius: COMMON_RADIUS,
    borderTopRightRadius: COMMON_RADIUS,
  },
  // Fixed fraction: keeps the sized sheet's rounded cap, drops its min/max so
  // the explicit height is the only thing driving it.
  sheetRatio: {
    borderTopLeftRadius: COMMON_RADIUS,
    borderTopRightRadius: COMMON_RADIUS,
  },
  grabberHit: {
    alignItems: 'center', paddingTop: 8, paddingBottom: 4,
    backgroundColor: SHEET_HEADER_BG,
  },
  grabber: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10,
    backgroundColor: SHEET_HEADER_BG,
    // No rule under it: the header shares the sheet's ground now, so a line
    // only redraws a seam the colour change already removed.
  },
  title:       { flex: 1, fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
