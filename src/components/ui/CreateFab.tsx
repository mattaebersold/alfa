import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { useBrandColor } from '../../hooks/useBrandColor';
import OilSheen, { useSheenTone } from './OilSheen';
import { GUTTER, COLOR_BLACK } from '../../constants/config';
import Avatar from './Avatar';
import { useAppSelector } from '../../store/store';
import ActionSheet from './ActionSheet';
import { ProUpsellModal } from '../pro/ProUpsell';
import { useIsPro } from '../../hooks/useBrandColor';
import { useGetUsageQuery } from '../../api/apiService';
import { LISTING_LIMIT_UPSELL } from '../../constants/config';

/**
 * 42 — down from 50, and 62 before that. In their tray the two circles read
 * as one control, and neither needs to be the biggest thing on the screen to
 * be found in its corner. Level with the header's buttons, which are 42 too.
 */
const FAB_SIZE = 42;
/** A full circle. */
const FAB_RADIUS = FAB_SIZE / 2;
/** Between the search circle and the + below it. */
const FAB_GAP = 6;
/**
 * In from the right edge — clear of an iPhone's rounded corner, not tucked
 * into it. Android's corners are square or barely rounded, and its GUTTER is
 * wider to begin with, so there it sits just past the gutter instead.
 */
export const FAB_RIGHT = Platform.OS === 'android' ? GUTTER + 8 : GUTTER * 4;
/** Around the two circles, inside their container. */
const FAB_TRAY_PAD = 8;
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
export const FAB_LANE = FAB_SIZE + FAB_TRAY_PAD * 2 + FAB_RIGHT + 8;

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
  const sheenTone = useSheenTone();
  const { userInfo, isLoggedIn } = useAppSelector((s) => s.auth);

  /**
   * What to make. A listing checks the member's monthly allowance first, as
   * the marketplace's + did: at the limit it's the Pro upsell, rather than a
   * form the server would refuse once it's filled in.
   */
  const [choosing, setChoosing] = useState(false);
  const [upsell, setUpsell] = useState(false);
  const isPro = useIsPro();
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro || !isLoggedIn });
  const listingsFull = !isPro && !!usage?.listings?.reached;
  const createOptions = [
    { label: 'Post', onPress: () => navigation.navigate('Create') },
    {
      label: 'Marketplace listing',
      onPress: () => (listingsFull ? setUpsell(true) : navigation.navigate('ListingCreate', { kind: 'sale' })),
    },
  ];

  return (
    <>
    <View style={[styles.cluster, { bottom: insets.bottom + FAB_BOTTOM }]} pointerEvents="box-none">
    <TouchableOpacity
      style={[styles.fab, styles.profile]}
      onPress={() => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Your profile"
    >
      <Avatar user={userInfo} size={FAB_SIZE} radius={FAB_SIZE / 2} />
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: tint }]}
      // A choice first: a post, or a listing for the marketplace — the
      // marketplace's own + went, and this is where listing starts now.
      onPress={() => setChoosing(true)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="New post"
    >
      {/* The same film as the header's home button — the two brand-filled
          buttons that bookend the screen. Warm on gold, full spectrum on blue. */}
      {/* Clips to its own radius, so it has to track the button's. */}
      <OilSheen tone={sheenTone} radius={FAB_RADIUS} />
      {/* Always black, rather than whatever contrasts with the fill.
          `contrastText` put a white plus on the basic account's blue — correct
          by contrast, but it made the same button look like two different
          controls depending on the account. The mark is black on gold and
          black on blue; both are legible, and it stays one button. */}
      <Plus size={23} color={COLOR_BLACK} strokeWidth={3.3} />
    </TouchableOpacity>
    </View>
    <ActionSheet
      visible={choosing}
      onClose={() => setChoosing(false)}
      title="Create"
      options={createOptions}
    />
    <ProUpsellModal
      visible={upsell}
      onClose={() => setUpsell(false)}
      title={LISTING_LIMIT_UPSELL.title}
      message={LISTING_LIMIT_UPSELL.message}
    />
    </>
  );
}

const styles = StyleSheet.create({
  // The two circles in one dark grey pill, so they read as a single control
  // floating over the feed rather than two loose buttons. The shadow is the
  // tray's now — heavier than the header buttons carry, since it has to sit
  // on top of the feed rather than in it.
  cluster: {
    position: 'absolute',
    right: FAB_RIGHT,
    // A column, search on top: the + keeps the corner a thumb rests in.
    flexDirection: 'column', alignItems: 'center', gap: FAB_GAP,
    padding: FAB_TRAY_PAD,
    borderRadius: FAB_SIZE / 2 + FAB_TRAY_PAD,
    backgroundColor: 'rgba(12,12,12,0.97)',
    // A wide, soft shadow rather than a tight drop: it lifts the tray off
    // whatever's scrolling under it without drawing a hard edge. boxShadow
    // blurs the same on both platforms, where Android's elevation can't be
    // told how far to spread.
    boxShadow: '0px 10px 30px 4px rgba(0, 0, 0, 0.55)',
    zIndex: 30,
  },
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  // Just the photo, no stroke — the tray is its frame. Clips it to the
  // circle; the tray carries the shadow, so nothing here is lost to it.
  profile: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
});
