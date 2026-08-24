import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing,
  useWindowDimensions,
} from 'react-native';
import { Bell, X } from 'lucide-react-native';
import NotificationsList, { DeleteAllButton } from '../notifications/NotificationsList';
import { useGetUnreadNotificationCountQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';

/** Matches the other header buttons, so the row stays even. */
const BTN = 44;
const BTN_RADIUS = 15;
/** How much of the screen the opened panel takes. */
const PANEL_RATIO = 0.9;
const PANEL_RADIUS = 20;
/** Past this the badge stops counting and starts saying "lots". */
const BADGE_MAX = 10;

/**
 * Unread notifications, as a header button that opens into the list.
 *
 * The button is always there; only the count bubble comes and goes. It is the
 * way into the list whether or not anything is waiting, and a control that
 * appears and disappears is one people stop reaching for.
 *
 * Tapping it grows the button itself into the panel rather than pushing a
 * screen, and the gold carries over — the box is still the button for the first
 * part of the move, bleeding to black as it takes the screen, so what you get
 * reads as the thing you pressed rather than as a new surface that replaced it.
 *
 * ## How the growth is animated
 *
 * Two animated values, deliberately, because they can't share a driver:
 *
 *  - `box` (JS-driven) moves and resizes the growing rectangle, and carries its
 *    corner radius from the button's 15 to the panel's 20. Radius is the reason
 *    this can't be a transform: scaling a box to a fourteenth of its height
 *    scales its corners with it, and the thing collapsing back into the header
 *    ends up a sharp-cornered sliver.
 *  - `reveal` (native) fades the scrim and the content.
 *
 * The box that animates is deliberately childless — two flat colour layers and
 * nothing else. An earlier version had the notification list inside it, so
 * every frame re-laid out the whole list; that was the flicker. The list now
 * lives in its own layer, pinned at the panel's final size, and only ever
 * fades. Nothing re-measures while the box moves.
 *
 * Colour follows from the same split: it can't be interpolated on the native
 * driver, so gold-to-black is a gold layer fading off a black one.
 *
 * The list that lands inside is the same component the full-screen
 * notifications route renders, so nothing about a notification behaves
 * differently depending on which way you opened it.
 */
export default function NotificationsBell() {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { data } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });
  const count = data?.count ?? 0;

  const btnRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  /** True once the box has finished growing — gates touches on the content. */
  const [expanded, setExpanded] = useState(false);
  // Where the button sits on screen, captured at press time — the panel grows
  // out of that rectangle, so it has to be measured, not assumed.
  const [origin, setOrigin] = useState({ x: 0, y: 0, w: BTN, h: BTN });

  const box = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  /**
   * The button's face drawn inside the modal. It needs its own value because
   * it isn't symmetrical: on the way up it holds long enough for the bubble to
   * make its exit and then gets out of the way, and on the way down it comes
   * back immediately so the bell and its count ride the shrinking box the whole
   * way home rather than appearing at the end of the trip.
   */
  const ghost = useRef(new Animated.Value(1)).current;

  const panelW = screenW * PANEL_RATIO;
  const panelH = screenH * PANEL_RATIO;
  const panelX = (screenW - panelW) / 2;
  const panelY = (screenH - panelH) / 2;

  const openPanel = useCallback(() => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setOrigin({ x, y, w: w || BTN, h: h || BTN });
      setOpen(true);
      box.setValue(0);
      reveal.setValue(0);
      ghost.setValue(1);
      badgeScale.setValue(1);

      // Two frames of head start. Mounting the modal renders the notification
      // list, and that is the one heavy chunk of JS in this whole interaction —
      // starting the box on the same frame means it stutters through its first
      // few. Letting the list land first buys a quiet thread to animate on.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(box, {
            toValue: 1,
            // Stiff enough to reach full size in about a quarter second, loose
            // enough (damping ratio ~0.6) to overshoot it by a tenth and rock
            // back — the box arrives, breathes past its mark, and settles. Any
            // less damping and the overshoot carries it off the bottom of the
            // screen rather than just past the edge.
            stiffness: 200,
            damping: 17,
            mass: 1,
            useNativeDriver: false,
          }),
          Animated.timing(reveal, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // The bubble doesn't just vanish — it winds up and snaps away, which
          // reads as it being taken rather than switched off.
          Animated.timing(badgeScale, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.elastic(1.4)),
            useNativeDriver: true,
          }),
          // Held until the bubble has finished leaving — fading the face out
          // any sooner takes the exit with it.
          Animated.timing(ghost, {
            toValue: 0,
            delay: 260,
            duration: 140,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setExpanded(true);
        });
      }));
    });
  }, [box, reveal, badgeScale, ghost]);

  /**
   * Shrink back into the button, then run whatever was waiting on the panel
   * being gone — opening a notification's target, usually. iOS refuses to
   * present a screen over a modal that is still dismissing, so the navigation
   * has to be the last thing that happens, not the first.
   *
   * Closing is a spring too, but a fully-damped one: an overshoot on the way
   * out would have the panel bounce off the header before vanishing.
   */
  const closePanel = useCallback((navigateAfter?: () => void) => {
    setExpanded(false);
    // Full size from the off. The real button underneath wears the bubble at
    // full size, so anything else here would pop at the hand-off.
    badgeScale.setValue(1);
    Animated.parallel([
      Animated.spring(box, {
        toValue: 0,
        stiffness: 120,
        damping: 22,
        mass: 0.85,
        useNativeDriver: false,
      }),
      // Quicker than the box: the content is pinned at full size, so it has to
      // be gone before the box shrinks out from under it.
      Animated.timing(reveal, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      // Straight back in, so the bell and count are over the gold for the whole
      // collapse instead of turning up once it has already landed.
      Animated.timing(ghost, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setOpen(false);
      if (navigateAfter) requestAnimationFrame(navigateAfter);
    });
  }, [box, reveal, badgeScale, ghost]);

  if (!isLoggedIn) return null;

  const grow = (from: number, to: number) =>
    box.interpolate({ inputRange: [0, 1], outputRange: [from, to] });

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={styles.btn}
        onPress={openPanel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${count} unread`}
      >
        <Bell size={21} color="#000000" strokeWidth={2.4} />
        {/* Not while the panel is up: the copy riding the box carries the
            bubble then, and by the tail of the collapse the scrim has faded
            enough to show this one too — two badges, a few pixels apart,
            chasing each other home. The swap back is invisible because the
            copy is exactly here at the moment the modal unmounts. */}
        {count > 0 && !open && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={() => closePanel()}
        statusBarTranslucent
      >
        {/* The ground dims as the panel grows, so the screen behind reads as
            being covered rather than as having gone dark on its own. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.scrim, { opacity: reveal }]}
          pointerEvents="none"
        />
        {/* Tapping outside closes, matching every other sheet in the app. */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => closePanel()}
          accessibilityLabel="Close notifications"
        />

        {/* The morphing box: colour and shape only, nothing to re-measure. */}
        <Animated.View
          style={[
            styles.morphBox,
            {
              left: grow(origin.x, panelX),
              top: grow(origin.y, panelY),
              width: grow(origin.w, panelW),
              height: grow(origin.h, panelH),
              borderRadius: grow(BTN_RADIUS, PANEL_RADIUS),
            },
          ]}
          pointerEvents="none"
        >
          <View style={[StyleSheet.absoluteFill, styles.morphBlack]} />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.morphGold,
              {
                opacity: box.interpolate({
                  inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp',
                }),
              },
            ]}
          />
        </Animated.View>

        {/* The button's own face, redrawn inside the modal.
            The real one in the header is behind this whole window, so during
            the grow and the shrink it is simply not visible — the bell and its
            count would vanish under the gold box the moment you pressed, and
            reappear only once the modal was gone. This tracks the box's leading
            corner at the button's own size, sits above the gold, and fades out
            as the box takes the screen. On the way back it fades in over the
            shrinking box and hands off to the real button underneath. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghostBtn,
            {
              left: grow(origin.x, panelX),
              top: grow(origin.y, panelY),
            },
          ]}
        >
          {/* Position and opacity are split across two views on purpose.
              A view with even one native-driven prop has its whole props node
              moved to native, and left/top don't exist there — putting the
              JS-driven position and the native-driven fade on one view gets you
              "Style property 'left' is not supported by native animated module"
              followed by the JS animation refusing to run at all. */}
          <Animated.View style={[styles.ghostFace, { opacity: ghost }]}>
            <Bell size={21} color="#000000" strokeWidth={2.4} />
            {count > 0 && (
              <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                <Text style={styles.badgeText}>
                  {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
                </Text>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>

        {/* Content, at its final size throughout — it only ever fades. */}
        <Animated.View
          style={[
            styles.content,
            { left: panelX, top: panelY, width: panelW, height: panelH },
            {
              opacity: reveal.interpolate({
                inputRange: [0, 0.45, 0.85], outputRange: [0, 0, 1], extrapolate: 'clamp',
              }),
            },
          ]}
          // Until the box has arrived this layer is invisible, and an invisible
          // sheet must not be swallowing taps meant for the backdrop.
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          {/* The bell alone says what this is — a heading spelling out
              "Notifications" over a list of notifications is a word doing no
              work. Archive-all sits with the close button because both are
              things you do to the panel rather than to a notification. */}
          <View style={styles.panelHeader}>
            <Bell size={20} color="#FFFFFF" strokeWidth={2.2} />
            <View style={styles.panelHeaderActions}>
              <DeleteAllButton />
              <TouchableOpacity
                onPress={() => closePanel()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <X size={30} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>

          <NotificationsList onDismiss={closePanel} revealStagger showDeleteAll={false} />
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: BTN, height: BTN,
    borderRadius: BTN_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.pro,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    // The badge hangs off this button's top-right corner, over the menu button
    // next to it. zIndex/elevation on the badge alone can't fix that — a child
    // only stacks within its own parent, and the menu button is a later sibling
    // that paints over this whole button, badge included. Lifting the *button*
    // above its neighbour is what puts the badge on top: iOS reads the zIndex,
    // Android the elevation, and the elevation has to actually exceed the
    // header buttons' 6 rather than tie with it — a tie falls back to draw
    // order, which is exactly the case being fixed.
    zIndex: 5,
    elevation: 9,
  },
  // Bigger than the plain dot it replaces, because it now has to carry a
  // number.
  badge: {
    position: 'absolute', top: -7, right: -7,
    minWidth: 24, height: 24, borderRadius: 12,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EC4632',
    zIndex: 10, elevation: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },

  scrim: { backgroundColor: 'rgba(0,0,0,0.6)' },

  /**
   * Stacking inside the modal, bottom to top: scrim, backdrop, this box, the
   * content, then the button's face on top of everything.
   *
   * Both properties on all three, because the two platforms decide this
   * differently. iOS honours tree order and zIndex; Android honours elevation
   * *over* tree order, so a later sibling with no elevation of its own is
   * painted underneath this box's 20 — which is precisely what put the bell and
   * the count behind the gold while it shrank.
   */
  morphBox: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    zIndex: 10, elevation: 20,
  },
  ghostBtn: {
    position: 'absolute',
    width: BTN, height: BTN,
    zIndex: 30, elevation: 24,
  },
  ghostFace: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  morphBlack: { backgroundColor: '#000000' },
  // Fades off the black beneath it — colour can't be interpolated natively, and
  // two layers cross-fading is the same picture without the bridge traffic.
  morphGold: { backgroundColor: colors.pro },

  content: {
    position: 'absolute',
    borderRadius: PANEL_RADIUS,
    overflow: 'hidden',
    zIndex: 20, elevation: 22,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
  },
  panelHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
});
