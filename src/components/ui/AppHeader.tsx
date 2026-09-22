import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Animated, Easing, Platform } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerOffset, resetHeader } from '../../hooks/useHeaderScroll';
import { goBackToTop } from '../../hooks/useScrollTopOnBack';
import { ChevronLeft, Menu } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from './Avatar';
import NavDrawer from './NavDrawer';
import NotificationsBell from './NotificationsBell';
import GarageDoor from './GarageDoor';
import GaragePanel from '../cars/GaragePanel';
import { useAppSelector } from '../../store/store';
import { useGetUserGarageQuery } from '../../api/apiService';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import OilSheen, { useSheenTone, type SheenTone } from './OilSheen';
import type { AppStackParamList } from '../../navigation/types';
import { COMMON_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const BTN = 42;          // floating button edge length
// The app's shared corner — the sheen overlay reads this too, so the two
// can't drift apart.
const BTN_RADIUS = COMMON_RADIUS;
const ROW_PAD_V = 8;     // vertical padding around the button row

/**
 * How far below the safe-area inset the button row starts.
 *
 * iOS notch/island insets already clear the status bar generously, so the full
 * pad on top of them leaves the header sitting low. Android's inset is the
 * status bar height exactly and needs the breathing room.
 */
const TOP_OFFSET = Platform.OS === 'ios' ? 0 : ROW_PAD_V;

const ICON = '#000000';

/** The back button is narrower than the others — a chevron, not a destination. */
const BACK_W = 30;
/** Space between the back button and the logo, same as the right-hand row. */
const BACK_GAP = 7;

/** The bar's side padding — the back button's travel has to clear it too. */
const BAR_PAD_H = 11;
/**
 * Where the back button starts: fully past the left edge of the screen, with
 * room for its shadow, so it arrives from outside rather than fading up in
 * place. Always further out than the space opening beside the logo grows, so
 * it never passes over the logo on the way in.
 */
const BACK_ENTER_FROM = -(BAR_PAD_H + BACK_W + 8);

/** Length of the vertical PRO mark, along the word. */
const PRO_LEN = 25;

/** How far the scrim carries on past the buttons before it's gone. */
const SCRIM_FADE = 28;

/**
 * Height the header occupies below the safe-area inset.
 */
export const APP_HEADER_HEIGHT = BTN + TOP_OFFSET + ROW_PAD_V;

/**
 * Top padding a screen's scroll content needs so its first item starts clear of
 * the floating buttons. The bar is an absolute overlay and reserves no layout
 * space, so content scrolls up underneath it.
 */
export function useHeaderPad(): number {
  const insets = useSafeAreaInsets();
  return insets.top + APP_HEADER_HEIGHT;
}

/**
 * Floating header button — a rounded square fully filled with the brand color,
 * sitting below the status bar. `wide` relaxes the fixed width for buttons
 * that carry a label.
 */
function FloatingButton({
  onPress, children, label, tint, wide, bare, outlined, sheen,
}: {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
  tint: string;
  wide?: boolean;
  /**
   * No fill — just the glyph, like the notifications bell beside it.
   *
   * For the controls that aren't destinations. The shadow stays either way:
   * the bar floats over content of any brightness, and an unbacked white icon
   * needs it to stay legible over a pale photo.
   */
  bare?: boolean;
  /**
   * Outlined instead of filled: a white hairline over a barely-there black
   * ground. Between `bare` and the brand fill — enough of a surface to read as
   * a button, without claiming the brand colour.
   */
  outlined?: boolean;
  /** An oil-slick film over the fill — the home button's. See OilSheen. */
  sheen?: SheenTone;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The color lives on the shadowed view itself: iOS won't cast a shadow
      // from a view with no background, and it guarantees the tint fills the
      // button rather than relying on an absolutely-positioned sibling.
      style={[
        styles.btn,
        wide && styles.btnWide,
        bare ? styles.btnBare
          : outlined ? styles.btnOutlined
          : { backgroundColor: tint },
      ]}
    >
      {sheen && !bare && !outlined && <OilSheen tone={sheen} radius={BTN_RADIUS} />}
      <View style={[styles.btnIcon, wide && styles.btnIconWide]}>{children}</View>
    </TouchableOpacity>
  );
}

/**
 * Up to `max` overlapping car photos from the user's garage, followed by a
 * "+N" chip when the garage holds more than that. Renders nothing for an empty
 * garage — the button's door icon already stands on its own.
 */
function GarageThumbs({ cars, max = 2 }: { cars: GarageCar[]; max?: number }) {
  const shown = cars.slice(0, max);
  const overflow = cars.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <View style={styles.thumbRow}>
      {shown.map((car, i) => {
        const uri = car.profile_image
          ? imageUrl(car.profile_image) ?? undefined
          : firstGalleryUrl(car.gallery) ?? undefined;
        return (
          <ExpoImage
            key={car.internal_id ?? i}
            source={{ uri }}
            style={[styles.thumb, i > 0 && styles.thumbOverlap]}
            contentFit="cover"
          />
        );
      })}
      {overflow > 0 && (
        <View style={[styles.thumb, styles.thumbOverlap, styles.thumbMore]}>
          <Text style={styles.thumbMoreText}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

interface AppHeaderProps {
  /**
   * Reserve layout space for the header instead of floating over the content.
   * Screens whose scroll container applies `useHeaderPad()` leave this off so
   * their content passes under the buttons.
   */
  spacer?: boolean;
}

export default function AppHeader({ spacer }: AppHeaderProps = {}) {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, userInfo } = useAppSelector((s) => s.auth);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Where the menu button sits, captured at press time — the drawer grows out
  // of that rectangle, so it has to be measured, not assumed.
  const menuRef = useRef<View>(null);
  const [drawerOrigin, setDrawerOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // The garage opens the same way — measured off its own button.
  const garageRef = useRef<View>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  const [garageOrigin, setGarageOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const openGarage = useCallback(() => {
    const node = garageRef.current;
    if (!node) { setGarageOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setGarageOrigin({ x, y, w, h });
      setGarageOpen(true);
    });
  }, []);
  const openDrawer = useCallback(() => {
    const node = menuRef.current;
    if (!node) { setDrawerOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setDrawerOrigin({ x, y, w, h });
      setDrawerOpen(true);
    });
  }, []);

  // Buttons carry the brand color; icons are black on top of it.
  const tint = useBrandColor();
  const isPro = useIsPro();
  const sheenTone = useSheenTone();

  // `headerOffset` is shared across screens, so a screen left mid-scroll would
  // otherwise hand the next one a header that's still slid off-screen.
  useEffect(() => { resetHeader(); }, []);

  // Any screen with somewhere to return to gets a back button ahead of the
  // logo. `canGoBack` isn't reactive, so it's re-read whenever this screen comes
  // into focus — tab screens stay mounted, and the tab history behind them can
  // change while they're out of view.
  const [canGoBack, setCanGoBack] = useState(() => navigation.canGoBack());
  useFocusEffect(useCallback(() => { setCanGoBack(navigation.canGoBack()); }, [navigation]));

  // Starts collapsed so arriving on a screen pushes the button in from the edge
  // and eases the logo over to make room, rather than the logo simply being
  // there.
  // Width can't run on the native driver, and neither can anything sharing
  // this value with it.
  const backProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(backProgress, {
      toValue: canGoBack ? 1 : 0,
      duration: canGoBack ? 700 : 340,
      // In: ease-out-back — it runs past its spot, shoving the logo a little
      // further than it needs to, then rubber-bands back. Out: a plain ease,
      // since overshooting below zero would ask for a negative width.
      easing: canGoBack ? Easing.out(Easing.back(2.2)) : Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [canGoBack, backProgress]);

  const { data: garageData } = useGetUserGarageQuery(undefined, { skip: !isLoggedIn });
  const garageCars = garageData?.entries ?? [];

  const go = (screen: string, params?: object) =>
    (navigation as any).navigate('MainTabs', { screen, params });

  return (
    <>
      {/* The bar is transparent, so the status bar shows the screen behind it. */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {spacer && <View style={{ height: insets.top + APP_HEADER_HEIGHT }} />}

      {/* A scrim from the very top of the device down past the button row.
          The bar floats over whatever the screen is showing, and against a
          photo — which is most of this app — black icons on brand-coloured
          squares sat on top of the picture with nothing separating them, and
          the status bar's own clock and battery competed with it. It rides the
          same offset as the bar, so it leaves with it on scroll. */}
      <Animated.View
        style={[
          styles.scrim,
          {
            height: insets.top + APP_HEADER_HEIGHT + SCRIM_FADE,
            transform: [{ translateY: headerOffset }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.45)', 'transparent']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sits below the status bar, not behind it. Slides up out of view when
          the screen is scrolled down, back in when scrolled up. */}
      <Animated.View
        style={[
          styles.bar,
          {
            top: insets.top + TOP_OFFSET,
            transform: [{ translateY: headerOffset }],
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.leftActions}>
        {/* Back — collapses to nothing on a screen with no history. */}
        <Animated.View
          style={{ width: backProgress.interpolate({ inputRange: [0, 1], outputRange: [0, BACK_W + BACK_GAP], extrapolateLeft: 'clamp' }) }}
          pointerEvents={canGoBack ? 'box-none' : 'none'}
          accessibilityElementsHidden={!canGoBack}
          importantForAccessibility={canGoBack ? 'auto' : 'no-hide-descendants'}
        >
          <Animated.View
            style={{
              transform: [{ translateX: backProgress.interpolate({ inputRange: [0, 1], outputRange: [BACK_ENTER_FROM, 0] }) }],
            }}
          >
            <TouchableOpacity
              // Lands the screen it returns to at the top, header showing — see
              // useScrollTopOnBack. Swipe/hardware back keep their place.
              onPress={() => goBackToTop(navigation)}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 10, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.btn, styles.btnOutlined, styles.backBtn]}
            >
              <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.4} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Logo returns to the home feed */}
        <FloatingButton
          label={isPro ? 'Home feed, Pro member' : 'Home feed'}
          tint={tint}
          // Only widened when there's a word to make room for; a basic account
          // keeps the square button it has always had.
          wide={isPro}
          sheen={sheenTone}
          onPress={() => go('FeedTab', { screen: 'Feed' })}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            tintColor={ICON}
          />
          {/* Turned on its side and set tight against the mark — it's a
              qualifier on the logo rather than a second piece of branding, the
              gold fill behind it is already doing most of the saying, and
              upright it was the widest thing in the button. */}
          {isPro && (
            <View style={styles.proMark}>
              <Text style={styles.proMarkText}>PRO</Text>
            </View>
          )}
        </FloatingButton>
        </View>

        {/* Right — notifications unfilled, then profile, garage and menu.
            Search moved to the tab bar: it's something you do *while* looking
            at something, and the bar is on screen at all times where this row
            scrolls away with the header. */}
        <View style={styles.rightActions}>
          {/* Leads the row, and unfilled. The four buttons after it are places
              you choose to go; this one is the app telling you something, and
              a fifth identical pill made that indistinguishable. Always
              present — only its count bubble comes and goes. */}
          <NotificationsBell />

          <FloatingButton
            label="Your profile"
            tint={tint}
            outlined
            onPress={() => go('FeedTab', { screen: 'Profile' })}
          >
            {/* Sized inside the border rather than under it: the outer view's
                content box loses 1pt each side to the stroke, and an avatar
                still asking for the full width would be clipped to a slightly
                wrong shape at the corners. */}
            <Avatar
              user={userInfo}
              size={BTN - 2}
              radius={BTN_RADIUS - 1}
            />
          </FloatingButton>

          {/* A garage-door icon in place of the word: the row has five buttons
              to fit and the label was the widest thing in it. Only widened
              when there are thumbs to sit beside the icon. */}
          {/* Opens in place, like the bell and the menu beside it, rather
              than navigating to the garage tab. */}
          <View ref={garageRef} collapsable={false}>
            <FloatingButton
              label="Garage"
              tint={tint}
              outlined
              wide={garageCars.length > 0}
              onPress={openGarage}
            >
              <GarageDoor size={21} color="#FFFFFF" strokeWidth={2.4} />
              <GarageThumbs cars={garageCars} />
            </FloatingButton>
          </View>

          {/* No badge. An unread message raises a notice in the bell next to
              this button — a red dot on the menu could only say that something
              somewhere was waiting, and left you to open the drawer and hunt
              for it. The notice says who wrote and opens the conversation. */}
          <View ref={menuRef} collapsable={false}>
            <FloatingButton
              label="Menu"
              tint={tint}
              outlined
              onPress={openDrawer}
            >
              <Menu size={22} color="#FFFFFF" strokeWidth={2.2} />
            </FloatingButton>
          </View>
        </View>
      </Animated.View>

      <NavDrawer visible={drawerOpen} origin={drawerOrigin} onClose={() => setDrawerOpen(false)} />
      <GaragePanel visible={garageOpen} origin={garageOrigin} onClose={() => setGarageOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Behind the bar, and starting at the physical top of the screen rather than
  // below the safe-area inset — the status bar is translucent, so the content
  // runs underneath it too.
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 19,
  },

  bar: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BAR_PAD_H,
  },

  leftActions:  { flexDirection: 'row', alignItems: 'center' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },

  btn: {
    width: BTN, height: BTN,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  btnIcon: {
    // Fills whatever the parent leaves — `BTN` on a plain button, two points
    // less on a bordered one. Fixed at `BTN` it overflowed the stroke.
    width: '100%', height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the avatar to the button's corners. Sits inside the shadowed view
    // so overflow:hidden can't crop the shadow.
    borderRadius: BTN_RADIUS,
    overflow: 'hidden',
  },
  // Labelled buttons size to their content instead of the fixed square.
  // Unfilled, and no rounded ground to fill — the radius would only show as a
  // pressed-state artefact on a button that has no surface.
  btnBare: { backgroundColor: 'transparent' },
  btnOutlined: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    // 40% rather than solid: at full white the stroke was the brightest thing
    // in the bar and read as a focus ring rather than an edge.
    borderColor: 'rgba(255,255,255,0.4)',
  },
  backBtn:     { width: BACK_W },
  btnWide:     { width: undefined, paddingHorizontal: 11 },
  btnIconWide: {
    width: undefined, flexDirection: 'row', alignItems: 'center', gap: 6.5,
    overflow: 'visible',
  },

  thumbRow:     { flexDirection: 'row', alignItems: 'center' },
  thumb:        { width: 23, height: 23, borderRadius: 11.5, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  thumbOverlap: { marginLeft: -8.5 },
  // Solid dark grey rather than 75% black: the button behind it is now a 10%
  // black wash, so a translucent chip picked up whatever photo was underneath
  // and the count sat on a moving ground.
  thumbMore:    { backgroundColor: '#3A3A3A', alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:{ fontSize: 9.5, fontWeight: '800', color: '#FFFFFF' },

  logo: { width: 25, height: 25 },
  // A box the size of the *rotated* word, so the row lays out around what you
  // actually see. Pulled in tighter than the button's own gap: PRO belongs to
  // the mark, not beside it.
  proMark: {
    width: 11, height: PRO_LEN,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -1,
  },
  proMarkText: {
    fontSize: 9.5, fontWeight: '900', color: ICON,
    letterSpacing: 0.8,
    // Reads top-to-bottom. The width is the word's own length, overflowing the
    // box before the rotation swings it onto the short axis; both are centred
    // on the same point, so it lands centred.
    width: PRO_LEN, textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },

});
