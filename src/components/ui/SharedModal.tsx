import React, { useRef, useEffect, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Animated, Pressable, PanResponder, useWindowDimensions,
} from 'react-native';
import { Text } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { KeyboardAvoidingView, HomeIndicatorSpacer, PortalHost, KeyboardHandledAbove } from '@ors/kit';
import { COMMON_RADIUS, COLOR_GRAY_22, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

// Near-black surfaces — matches the car-detail pane look.
const SHEET_BG = COLOR_GRAY_22;
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
  /**
   * The sheet's own colour, header and grabber included, in place of the
   * near-black default — true black for a sheet that wants to be a void
   * behind its content, like What's new.
   */
  surface?: string;
  children: React.ReactNode;
}

/**
 * Shared bottom-sheet modal — near-black, blurred overlay, grows with content
 * between 50% and 90% of screen height, or fills the screen with `fullHeight`.
 * Convert other modals to this when asked to "use SharedModal". The caller
 * supplies the scrollable content as children.
 */
export default function SharedModal({ visible, onClose, title, titleContent, headerRight, onDismissed, fullHeight = false, heightRatio, showClose = false, surface, children }: SharedModalProps) {
  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();


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
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* A Modal is its own window, so the app root's layer is under it: a
          layer of its own for lists that float over the sheet (autocompletes). */}
      <PortalHost>
      <View style={styles.fill}>
        {/* A dark grey, translucent scrim that fades with the sheet. No blur:
            a blur can't fade and either popped in or cost the whole open. */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,20,20,0.7)', opacity: overlayOpacity }]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        {/* The sheet rides on the keyboard: this fills the screen below the
            status bar and shrinks by the keyboard's height (kit's
            KeyboardAvoidingView), and the sheet sits at its bottom, capped to
            it — a short sheet lifts, a tall one shrinks. Callers with fields
            give it a FormScrollView body. `box-none` lets a tap on the empty
            part through to the backdrop. */}
        <KeyboardAvoidingView
          style={[styles.stack, { paddingTop: insets.top + 8 }]}
          pointerEvents="box-none"
        >
        <Animated.View
          style={[
            styles.sheet,
            surface != null && { backgroundColor: surface },
            heightRatio
              // A flex basis that can shrink, not a fixed height: the stack
              // pads itself by the keyboard, and a fixed height ignored that
              // — `maxHeight: '100%'` resolves against the stack's full
              // height, padding included — so the sheet kept its size and
              // was pushed up out of the screen instead of giving up room.
              ? [styles.sheetRatio, { flexBasis: Math.round(heightRatio * windowHeight) }]
              : fullHeight ? styles.sheetFull : styles.sheetSized,
            { transform: [{ translateY: slideY }] },
          ]}
        >
          {/* No status-bar padding of its own: the stack's top padding already
              keeps every sheet, full-height included, clear of it. */}
          <View {...panResponder.panHandlers}>
            {/* Tap it or drag it down — both close. */}
            <Pressable onPress={onClose} style={[styles.grabberHit, surface != null && { backgroundColor: surface }]} hitSlop={6}>
              <View style={styles.grabber} />
            </Pressable>
            <View style={[styles.header, surface != null && { backgroundColor: surface }]}>
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
          {/* The sheet has already shrunk for the keyboard: a FormScrollView
              inside adds no keyboard space of its own. */}
          <KeyboardHandledAbove>{children}</KeyboardHandledAbove>
          {/* The home indicator's clearance, only while the keyboard is down —
              with it up, the keyboard covers that strip. A spacer that
              collapses as the keyboard rises, not a padding switched on its
              events: that switch made the sheet's foot hop on Android. */}
          <HomeIndicatorSpacer height={Math.max(insets.bottom, 12)} />
        </Animated.View>
        </KeyboardAvoidingView>
      </View>
      </PortalHost>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill:  { flex: 1 },
  stack: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: SHEET_BG,
    overflow: 'hidden',
    // Never taller than the room left above the keyboard.
    maxHeight: '100%',
  },
  // Grows with its content from half of that room, and gives it back to the
  // keyboard — `flexShrink`, since the percentage cap doesn't see the padding.
  sheetSized: {
    minHeight: '50%',
    flexShrink: 1,
    borderTopLeftRadius: COMMON_RADIUS,
    borderTopRightRadius: COMMON_RADIUS,
  },
  // Fills whatever the keyboard leaves, so the sheet shrinks rather than slides
  // and its own bottom bar stays on screen. It still stops below the status
  // bar, so it has a top edge to round like every other sheet.
  sheetFull: {
    flex: 1,
    borderTopLeftRadius: COMMON_RADIUS,
    borderTopRightRadius: COMMON_RADIUS,
  },
  // A fraction of the screen to start from: keeps the sized sheet's rounded
  // cap, drops its minimum, and shrinks for the keyboard — see the basis above.
  sheetRatio: {
    flexShrink: 1, flexGrow: 0,
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
  title:       { flex: 1, fontSize: 17, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
