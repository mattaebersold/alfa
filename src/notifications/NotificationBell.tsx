import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Modal, Animated, Easing, useWindowDimensions, Platform,
} from 'react-native';
import { Text } from '../theme/Text';
import { BlurView } from 'expo-blur';
import { Bell, X } from 'lucide-react-native';
import NotificationsList, { MarkAllReadButton } from './NotificationsList';
import { useGetUnreadNotificationCountQuery, NOTIFICATION_POLL_INTERVAL, type OrsNotification } from './api';
import { useOrsSelector } from '../store/createStore';
import { HEADER_BTN as BTN, HEADER_BTN_RADIUS as BTN_RADIUS } from '../menu/HeaderButton';
import { PILL_RADIUS } from '../theme/radius';
import { FONT_INTER } from '../theme/fonts';

/** The most of the screen the opened panel takes; it scrolls past this. */
const PANEL_RATIO = 0.9;
/** The panel's height before the list has measured — a spinner's worth. */
const PANEL_LOADING_H = 220;
const PANEL_RADIUS = 20;
/** Past this the badge stops counting and starts saying "lots". */
const BADGE_MAX = 10;

/**
 * This app's unread notifications, as a header button that opens into the
 * list — alfa's bell, less its messages row (these apps have no inbox).
 *
 * Tapping it grows the button itself into the panel rather than pushing a
 * screen, so what you get reads as the thing you pressed rather than as a new
 * surface that replaced it. `onOpen` is called with a tapped row once the
 * panel has shrunk back home — iOS won't present a screen over a modal that is
 * still dismissing, so the navigation has to come last.
 *
 * ## How the growth is animated
 *
 * Two animated values, deliberately, because they can't share a driver:
 *
 *  - `box` (JS-driven) moves and resizes the growing rectangle, and carries its
 *    corner radius from the button's to the panel's. Radius is the reason this
 *    can't be a transform: scaling a box to a fraction of its height scales its
 *    corners with it, and the thing collapsing back into the header ends up a
 *    sharp-cornered sliver.
 *  - `reveal` (native) fades the scrim and the content.
 *
 * The box that animates is childless. The list lives in its own layer, pinned
 * at the panel's final size, and only ever fades — nothing re-measures while
 * the box moves.
 */
export default function NotificationBell({ onOpen }: {
  /** Open what a tapped notification is about. Runs after the panel has gone. */
  onOpen: (n: OrsNotification) => void;
}) {
  const isLoggedIn = useOrsSelector((s) => s.auth.isLoggedIn);
  const { width: screenW, height: screenH } = useWindowDimensions();

  const { data } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: NOTIFICATION_POLL_INTERVAL,
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
   * The button's face drawn inside the modal. On the way up it holds long
   * enough for the bubble to make its exit, then gets out of the way; on the
   * way down it comes straight back so the bell rides the shrinking box home.
   */
  const ghost = useRef(new Animated.Value(1)).current;

  const panelW = screenW * PANEL_RATIO;
  const maxPanelH = screenH * PANEL_RATIO;
  const panelX = (screenW - panelW) / 2;
  // Anchored where the full-height panel's top edge would be, so a short panel
  // hangs from the top and grows or shrinks at its bottom edge only.
  const panelY = (screenH - maxPanelH) / 2;

  /**
   * As tall as what's in it, up to `maxPanelH`: the header row and the list's
   * rows are measured separately and added up; past the cap the list scrolls.
   * Animated rather than set — the rows can land after the box has started
   * growing, and marking or reading them changes the height under your thumb.
   */
  const [chromeH, setChromeH] = useState<number | null>(null);
  const [listH, setListH] = useState<number | null>(null);
  const fitH = chromeH != null && listH != null ? Math.min(chromeH + listH, maxPanelH) : null;
  const fitHRef = useRef(fitH);
  fitHRef.current = fitH;
  const panelH = useRef(new Animated.Value(PANEL_LOADING_H)).current;

  useEffect(() => {
    if (!open || fitH == null) return;
    Animated.spring(panelH, {
      toValue: fitH,
      stiffness: 220,
      damping: 26,
      mass: 1,
      useNativeDriver: false,
    }).start();
  }, [open, fitH, panelH]);

  const openPanel = useCallback(() => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setOrigin({ x, y, w: w || BTN, h: h || BTN });
      // Last time's height is the best guess until this open's rows measure.
      panelH.setValue(fitHRef.current ?? Math.min(PANEL_LOADING_H, maxPanelH));
      setOpen(true);
      box.setValue(0);
      reveal.setValue(0);
      ghost.setValue(1);
      badgeScale.setValue(1);

      // Two frames of head start: mounting the modal renders the list, the one
      // heavy chunk of JS here, and the box stutters if it starts on that frame.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(box, {
            toValue: 1,
            // GrowPanel's curve: an ease-out with a small back, so the box
            // slows into place, goes a touch past, and settles.
            duration: 420,
            easing: Easing.out(Easing.back(0.9)),
            useNativeDriver: false,
          }),
          Animated.timing(reveal, {
            toValue: 1,
            duration: 570,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // The bubble winds up and snaps away — taken rather than switched off.
          Animated.timing(badgeScale, {
            toValue: 0,
            duration: 480,
            easing: Easing.in(Easing.elastic(1.4)),
            useNativeDriver: true,
          }),
          // Held until the bubble has finished leaving.
          Animated.timing(ghost, {
            toValue: 0,
            delay: 390,
            duration: 210,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setExpanded(true);
        });
      }));
    });
  }, [box, reveal, badgeScale, ghost, panelH, maxPanelH]);

  /**
   * Shrink back into the button, then run whatever was waiting on the panel
   * being gone. A fully-damped spring: an overshoot on the way out would have
   * the panel bounce off the header before vanishing.
   */
  const closePanel = useCallback((after?: () => void) => {
    setExpanded(false);
    // Full size from the off — the real button underneath wears the bubble at
    // full size, so anything else would pop at the hand-off.
    badgeScale.setValue(1);
    Animated.parallel([
      Animated.spring(box, {
        toValue: 0,
        stiffness: 53,
        damping: 14.6,
        mass: 0.85,
        useNativeDriver: false,
      }),
      // Quicker than the box: the content is pinned at full size, so it has to
      // be gone before the box shrinks out from under it.
      Animated.timing(reveal, {
        toValue: 0,
        duration: 270,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ghost, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setOpen(false);
      if (after) requestAnimationFrame(after);
    });
  }, [box, reveal, badgeScale, ghost]);

  const openRow = useCallback((n: OrsNotification) => closePanel(() => onOpen(n)), [closePanel, onOpen]);

  if (!isLoggedIn) return null;

  const grow = (from: number, to: number) =>
    box.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const badgeText = count > BADGE_MAX ? `${BADGE_MAX}+` : String(count);

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={styles.btn}
        onPress={openPanel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={count ? `Notifications, ${count} unread` : 'Notifications'}
      >
        <Bell size={22} color="#FFFFFF" strokeWidth={2.2} />
        {/* Not while the panel is up: the copy riding the box carries the
            bubble then, and two badges would chase each other home. */}
        {count > 0 && !open && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
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
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: reveal }]} pointerEvents="none">
          {/* Blurred on iOS; Android keeps the flat shade. */}
          {Platform.OS === 'ios' && (
            <BlurView tint="dark" intensity={30} style={StyleSheet.absoluteFill} />
          )}
          <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Animated.View>
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
              // grow(origin.h, panelH), except the far end moves too.
              height: Animated.add(
                origin.h,
                Animated.multiply(box, Animated.subtract(panelH, origin.h)),
              ),
              borderRadius: grow(BTN_RADIUS, PANEL_RADIUS),
            },
          ]}
          pointerEvents="none"
        />

        {/* The button's own face, redrawn inside the modal — the real one is
            behind this whole window. Position and opacity on separate views:
            left/top are JS-driven, the fade native, and one view can't mix. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.ghostBtn, { left: grow(origin.x, panelX), top: grow(origin.y, panelY) }]}
        >
          <Animated.View style={[styles.ghostFace, { opacity: ghost }]}>
            <Bell size={22} color="#FFFFFF" strokeWidth={2.2} />
            {count > 0 && (
              <Animated.View style={[styles.badge, { transform: [{ scale: badgeScale }] }]}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>

        {/* Content, at its final size throughout — it only ever fades. Height
            and opacity on separate views for the same reason as the ghost. */}
        <Animated.View
          style={[styles.content, { left: panelX, top: panelY, width: panelW, height: panelH }]}
          // Invisible until the box has arrived, and an invisible sheet must
          // not swallow taps meant for the backdrop.
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          <Animated.View
            style={[
              styles.fill,
              {
                opacity: reveal.interpolate({
                  inputRange: [0, 0.45, 0.85], outputRange: [0, 0, 1], extrapolate: 'clamp',
                }),
              },
            ]}
          >
            {/* No heading — you just tapped the bell. Mark-all on the left,
                close on the right: apart, they can't be hit one for the other. */}
            <View style={styles.panelHeader} onLayout={(e) => setChromeH(e.nativeEvent.layout.height)}>
              <MarkAllReadButton color="#FFFFFF" />
              <TouchableOpacity
                onPress={() => closePanel()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close notifications"
              >
                <X size={30} color="#FFFFFF" strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={styles.fill}>
              <NotificationsList
                onOpen={openRow}
                showMarkAll={false}
                contentPaddingBottom={12}
                onContentHeight={setListH}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  /**
   * No fill, no outline — just the glyph. The buttons beside it are places you
   * go; this one is the app telling you something. The shadow keeps a bare
   * white icon legible over anything.
   */
  btn: {
    width: BTN, height: BTN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    // Lifted over the next button, so the badge that hangs off this one's
    // corner isn't painted under its neighbour.
    zIndex: 5,
    elevation: 9,
  },
  /** Tucked against the glyph's top-right rather than the button's corner. */
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 19, height: 19, borderRadius: PILL_RADIUS,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#3AA9EA', // the alert blue — alfa's COLOR_ALERT / theme colors.alert
    zIndex: 10, elevation: 12,
  },
  badgeText: { fontSize: 10.5, fontFamily: FONT_INTER.extrabold, color: '#000000' }, // always black on the alert blue

  // Grey, not black: the panel is true black and would vanish into a black dim.
  scrim: { backgroundColor: 'rgba(64,64,64,0.55)' },

  /**
   * Stacking inside the modal, bottom to top: scrim, backdrop, box, content,
   * then the button's face. zIndex for iOS, elevation for Android.
   */
  morphBox: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: '#000000',
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
});
