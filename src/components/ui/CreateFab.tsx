import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import OilSheen from './OilSheen';
import { GUTTER, COLOR_BLACK } from '../../constants/config';
import Avatar from './Avatar';
import { useAppSelector } from '../../store/store';

/**
 * The + — 46, a little over the header's 42-point buttons: it's the one
 * thing here you're most likely to reach for, and the photo above it is
 * smaller still. (It was 50, and 62 before that.)
 */
const FAB_SIZE = 46;
/** A full circle. */
const FAB_RADIUS = FAB_SIZE / 2;
/**
 * Your photo, above the +: smaller than it — the + is the one that leads —
 * and set to the tray's right, so the two line up along the edge nearest the
 * screen's and the tray narrows toward the top.
 */
const PROFILE_SIZE = 34;
/**
 * How far right of the +'s centre the photo's centre sits — past flush with
 * its right edge, so the photo steps out toward the screen's edge and the
 * tray leans with it.
 */
const PROFILE_NUDGE = 12;
/** Between the photo and the + below it. */
const FAB_GAP = 6;
/**
 * In from the right edge — clear of an iPhone's rounded corner, not tucked
 * into it. Android's corners are square or barely rounded, and its GUTTER is
 * wider to begin with, so there it sits just past the gutter instead.
 */
export const FAB_RIGHT = Platform.OS === 'android' ? GUTTER + 8 : 16;
/** Around the two circles, inside their container. */
const FAB_TRAY_PAD = 7;
/** The tray's width: whichever reaches further right, the + or the stepped-out photo, padded. */
const TRAY_W_ = Math.max(FAB_SIZE, FAB_SIZE / 2 + PROFILE_NUDGE + PROFILE_SIZE / 2) + FAB_TRAY_PAD * 2;
/**
 * Offset from the safe-area inset. With no tab row left to line up with, the
 * tray sits low: on iOS a little way into the home indicator's inset (which is
 * mostly empty space above the bar itself), on Android just clear of the
 * system navigation.
 */
export const FAB_BOTTOM = Platform.OS === 'android' ? 16 : -6;
/**
 * Width the tab bar keeps clear on its right for this button.
 *
 * The button sits in the corner, over the bar rather than above it, so without
 * this the last tab would end up underneath it and unpressable.
 */
export const FAB_LANE = TRAY_W_ + FAB_RIGHT + 8;

/** The tray's box: the two circles stacked, with their padding — wide enough for the photo's step out. */
const TRAY_W = TRAY_W_;
const TRAY_H = PROFILE_SIZE + FAB_GAP + FAB_SIZE + FAB_TRAY_PAD * 2;
/** Each circle's centre across the tray: the +, and the photo stepped right of it. */
const PLUS_CX = FAB_SIZE / 2 + FAB_TRAY_PAD;
const PROFILE_CX = PLUS_CX + PROFILE_NUDGE;
/**
 * Where on each end's circle the side leaves it to curve in toward the waist,
 * in degrees past the horizontal. Higher pinches the middle in further.
 */
const WAIST_ANGLE = 25;

/**
 * The tray's outline: a round end around each button, the sides drawn in
 * between them like an hourglass. Each end is an arc of the circle around its
 * button, padded — the top one smaller and off to the right, as the photo is;
 * each side is a curve that leaves one arc along its tangent, dips in to the
 * waist, and meets the other the same way, so there's no corner.
 */
const TRAY_PATH = (() => {
  // Top: the photo's circle, padded. Bottom: the +'s.
  const r1 = PROFILE_SIZE / 2 + FAB_TRAY_PAD;
  const r2 = FAB_SIZE / 2 + FAB_TRAY_PAD;
  const cx1 = PROFILE_CX;
  const cx2 = PLUS_CX;
  const cy1 = r1;
  const cy2 = TRAY_H - r2;
  const a = (WAIST_ANGLE * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  // Where each side leaves the top arc and meets the bottom one.
  const tR = [cx1 + r1 * cos, cy1 + r1 * sin];
  const tL = [cx1 - r1 * cos, cy1 + r1 * sin];
  const bR = [cx2 + r2 * cos, cy2 - r2 * sin];
  const bL = [cx2 - r2 * cos, cy2 - r2 * sin];
  // How far each control point runs along its tangent: a share of the gap
  // the curve has to cross, so it bends without overshooting the waist.
  const k = (bR[1] - tR[1]) * 0.45;
  const kx = k * sin;
  const ky = k * cos;
  const p = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  return [
    `M ${p(tL[0], tL[1])}`,
    `A ${r1} ${r1} 0 1 1 ${p(tR[0], tR[1])}`,
    `C ${p(tR[0] - kx, tR[1] + ky)} ${p(bR[0] - kx, bR[1] - ky)} ${p(bR[0], bR[1])}`,
    `A ${r2} ${r2} 0 1 1 ${p(bL[0], bL[1])}`,
    `C ${p(bL[0] + kx, bL[1] - ky)} ${p(tL[0] + kx, tL[1] + ky)} ${p(tL[0], tL[1])}`,
    'Z',
  ].join(' ');
})();

/**
 * The bottom-right corner: your profile photo stacked above "new post" —
 * two circles.
 *
 * The photo was the header's, where it sat among the square buttons; it swapped
 * places with search, which moved up there. Down here it's you, next to the
 * thing you most often do as you — and a round photo sits naturally beside the
 * round +. The brand-filled + stays the one that leads.
 *
 * "New post", as a circle in the bottom-right corner of the screen.
 *
 * It used to be one of four equal squares in the header, where the single most
 * common thing anyone does here looked exactly as important as opening the
 * menu. Down here it's the only round thing on the screen, in the corner a
 * thumb already rests on — right at the bottom, in the tab bar's own row rather
 * than hovering above it.
 *
 * Rendered once by MainTabNavigator rather than per screen, so it stays put
 * while tabs change underneath it.
 */
export default function CreateFab() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tint = useBrandColor();
  const isPro = useIsPro();
  const { userInfo } = useAppSelector((s) => s.auth);

  return (
    <>
    <View style={[styles.cluster, { bottom: insets.bottom + FAB_BOTTOM }]} pointerEvents="box-none">
    {/* Both circles placed on the tray's outline (TRAY_PATH) rather than
        flowed, since the photo steps out of the column. */}
    <Svg width={TRAY_W} height={TRAY_H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={TRAY_PATH} fill={COLOR_BLACK} />
    </Svg>
    <TouchableOpacity
      style={styles.profile}
      onPress={() => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
    >
      <Avatar user={userInfo} size={PROFILE_SIZE} radius={PROFILE_SIZE / 2} edge={false} />
    </TouchableOpacity>
    <TouchableOpacity
      // The brand colour: solid Pro red for a Pro account, blue otherwise.
      style={[styles.fab, { backgroundColor: tint }]}
      // The form; its Add Media is where the camera is.
      onPress={() => navigation.navigate('Create')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="New post"
    >
      {/* The oil-slick film on blue only — Pro's red is solid. Clips to its
          own radius, so it has to track the button's. */}
      {!isPro && <OilSheen tone="cool" radius={FAB_RADIUS} />}
      {/* Always black, rather than whatever contrasts with the fill.
          `contrastText` put a white plus on the basic account's blue — correct
          by contrast, but it made the same button look like two different
          controls depending on the account. The mark is black on gold and
          black on blue; both are legible, and it stays one button. */}
      <Plus size={25} color={COLOR_BLACK} strokeWidth={3.3} />
    </TouchableOpacity>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  // The two circles in one black hourglass (TRAY_PATH, drawn behind them), so
  // they read as a single control floating over the feed rather than two
  // loose buttons. No shadow.
  // The photo on top, the + below it: the + keeps the corner a thumb rests in.
  cluster: {
    position: 'absolute',
    right: FAB_RIGHT,
    width: TRAY_W, height: TRAY_H,
    zIndex: 30,
  },
  fab: {
    position: 'absolute', left: PLUS_CX - FAB_SIZE / 2, bottom: FAB_TRAY_PAD,
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  // Just the photo, no stroke — the tray is its frame. Clips it to the
  // circle; stepped right of the + below (PROFILE_NUDGE).
  profile: {
    position: 'absolute', left: PROFILE_CX - PROFILE_SIZE / 2, top: FAB_TRAY_PAD,
    width: PROFILE_SIZE, height: PROFILE_SIZE, borderRadius: PROFILE_SIZE / 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
});
