import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Pressable, Linking, Animated, Dimensions, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Car, Users, ShoppingBag, BookOpen, Flag, X, ChevronRight, Link, Store, Route, MessageCircle, UserRound, Bell, Info, CalendarCheck, Mail, Package, Home, LifeBuoy,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import Avatar from './Avatar';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetMyEventsCountQuery } from '../../api/apiService';
import MyEventsSheet from '../society/MyEventsSheet';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import { APP_VERSION } from '../../utils/appVersion';
import { ProUpsellModal } from '../pro/ProUpsell';
import SteeringWheel from './SteeringWheel';
import { logout } from '../../store/authSlice';
import { useIsPro, useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * The panel takes most of the screen rather than a column of it.
 *
 * At 85%/320 the cap was doing all the work on a modern phone — a 390pt screen
 * wanted 331 and got 320 — which left the two-up tiles narrow enough that the
 * longer labels wrapped, and the wrapping is what pushed the menu into a
 * scroll. The wider panel buys the tiles about 40pt each, which is the
 * difference between "ORS Rallys" fitting on one line and not.
 */
const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.92, 400);
/**
 * Half the row, minus the 8px gutter — and a pixel of slack for the panel's
 * hairline border, which comes out of the same content box. Without it two
 * tiles could overflow by a fraction and wrap to one per row.
 */
const TILE_WIDTH = Math.floor((PANEL_WIDTH - 32 - 8) / 2) - 1;
const SLIDE_DURATION = 220;

/**
 * Dark palette, matched to the web drawer: white-on-dark rather than derived
 * from the brand fill.
 *
 * The panel was once translucent glass over the blurred app. Android never
 * sold it — expo-blur falls back to a thin scrim there, so the panel read as a
 * washed-out grey sheet with the feed showing through — and it turned out iOS
 * didn't either: a real blur behind 6% white still leaves the feed legible
 * through the menu, so the labels compete with whatever happens to be scrolled
 * behind them. Both platforms now get the near-solid slab and the heavier
 * backdrop. The blur stays: it's what keeps the edges of the screen from
 * reading as a flat black box.
 */
const PRO_GOLD  = colors.pro;
const PANEL_BG  = 'rgba(18,18,18,0.985)';
const BACKDROP  = 'rgba(0,0,0,0.88)';
const TEXT_HI   = '#FFFFFF';
const TEXT_MID  = 'rgba(255,255,255,0.6)';
const TEXT_LO   = 'rgba(255,255,255,0.3)';
const TEXT_FAINT= 'rgba(255,255,255,0.45)';
const DIVIDER   = 'rgba(255,255,255,0.1)';
const TILE_BG   = 'rgba(255,255,255,0.07)';
const CHIP_BG   = 'rgba(255,255,255,0.1)';
const BRASS     = '#E5C58E';
const RED       = '#EC4632';

/** Half-width tile — two per row, so the menu fits without scrolling. */
function NavTile({ label, Icon, onPress, count, wide, flex }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  /** Unread count — renders a brass pill on the right when above zero. */
  count?: number;
  /** Fill the row instead of taking half of it. */
  wide?: boolean;
  /**
   * Share of the row, for pairs that shouldn't split it evenly — 1 against 2
   * gives a third and two thirds. Replaces the fixed half-width, so every tile
   * in the row needs one.
   */
  flex?: number;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.navTile,
        wide && styles.navTileWide,
        flex != null && { width: undefined, flex },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={19} color={TEXT_MID} />
      <Text style={styles.navTileLabel} numberOfLines={1}>{label}</Text>
      {/* Pinned to the corner rather than trailing the label — stacked, there
          is no end of the line for it to sit at. */}
      {count != null && count > 0 && (
        <View style={styles.unreadPill}>
          <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Round icon button with an unread bubble — the header's inbox shortcuts. */
function HeaderIconButton({ Icon, count, onPress, label }: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  count?: number;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={styles.headerIconBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
      hitSlop={6}
    >
      <Icon size={15} color={TEXT_MID} />
      {count != null && count > 0 && (
        <View style={styles.headerBubble}>
          <Text style={styles.headerBubbleText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface NavDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function NavDrawer({ visible, onClose }: NavDrawerProps) {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  // Measured rather than assumed: the header carries the status-bar inset and a
  // row of icon buttons, and the list has to start below whatever that adds up
  // to on this device.
  const [headerH, setHeaderH] = useState(72);
  const { userInfo } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const isPro = useIsPro();
  const brand = useBrandColor();
  const brandText = useBrandTextColor();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  // The bell's own count, so the drawer and the header always agree.
  const { data: notifData } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });
  const notifCount = notifData?.count ?? 0;

  // Upcoming events you've flagged interest in — the bubble on "Your Events".
  const { data: myEventsData } = useGetMyEventsCountQuery(undefined, { skip: !isLoggedIn });
  const myEventsCount = myEventsData?.count ?? 0;
  const [myEventsOpen, setMyEventsOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const { openEventSheet } = useEventSheet();

  const translateX = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Any navigation is deferred until the drawer has fully closed. Firing it
  // mid-animation is what made the next screen's transition collide with the
  // drawer's, showing hard-edged overlays sliding past each other.
  const pendingNav = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: SLIDE_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: PANEL_WIDTH,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }),
    ]).start(() => {
      translateX.setValue(PANEL_WIDTH);
      overlayOpacity.setValue(0);
      onClose();

      const go = pendingNav.current;
      pendingNav.current = null;
      go?.();
    });
  }, [onClose, translateX, overlayOpacity]);

  /** Close first, then navigate once the drawer is off-screen. */
  const closeThen = useCallback((go: () => void) => {
    pendingNav.current = go;
    handleClose();
  }, [handleClose]);

  /**
   * Confirmed, because the control is now an icon rather than a labelled
   * button. A mis-tap next to the close X would otherwise end the session, and
   * getting back in means finding a password.
   */
  const handleLogout = useCallback(() => {
    Alert.alert('Log out?', "You'll need to sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => closeThen(() => dispatch(logout())),
      },
    ]);
  }, [closeThen, dispatch]);

  const goFeed = useCallback((screen: 'Feed' | 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard' | 'Members' | 'Marketplace') => {
    closeThen(() => navigation.navigate('MainTabs', {
      screen: 'FeedTab',
      params: { screen },
    } as any));
  }, [closeThen, navigation]);

  const displayName = userInfo?.username ?? '';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Blurred, dimmed backdrop that fades with the panel. It runs the full
            width, so the translucent panel reads as glass over it. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={40} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BACKDROP }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
          {/* No insets on the wrapper any more — they belong to the scroll
              content, so the list runs the full height of the panel and pads
              itself clear of the notch and the home indicator. */}
          <View style={ss.fill}>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: headerH + 10, paddingBottom: insets.bottom + 24 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* First thing in the menu, above your own account row. It's the
                  only gold in a white-on-dark drawer, so it reads as the one
                  offer rather than another destination — and it's gone entirely
                  for members who already have it. */}
              {!isPro && (
                <TouchableOpacity
                  style={styles.proCallout}
                  onPress={() => setProOpen(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to Pro"
                >
                  <View style={styles.proCalloutIcon}>
                    <SteeringWheel size={16} color="#000000" strokeWidth={2.4} />
                  </View>
                  <View style={styles.proCalloutText}>
                    <Text style={styles.proCalloutTitle}>Upgrade to Pro</Text>
                    <Text style={styles.proCalloutSub}>
                      Unlimited garage, posts and routes
                    </Text>
                  </View>
                  <ChevronRight size={13} color="rgba(0,0,0,0.5)" />
                </TouchableOpacity>
              )}

              {/* Your own account, at the head of the list rather than pinned
                  above it. Pinned, it and the footer were eating fixed height
                  at both ends and squeezing the tiles into the band left over;
                  in the list it just scrolls away like everything else. */}
              {userInfo && (
                <TouchableOpacity
                  style={styles.userCard}
                  onPress={() => goFeed('Dashboard')}
                  activeOpacity={0.8}
                >
                  <Avatar
                    user={userInfo}
                    size={44}
                  />
                  <View style={styles.userCardText}>
                    <Text style={styles.userCardName}>@{displayName}</Text>
                    <Text style={styles.userCardSub}>Your Dashboard</Text>
                  </View>
                  <ChevronRight size={14} color={TEXT_HI} />
                </TouchableOpacity>
              )}

              {/* The feed left the tab bar, so this is its way back. It shares
                  a row with Your Events — both are places you go rather than
                  things you browse, and full-width each they pushed the grid
                  below the fold. */}
              {/* A third and two thirds: "Home" is one short word, "Your Events"
                  carries a count pill as well and wants the room. */}
              <View style={styles.pairRow}>
                <NavTile label="Home" Icon={Home}
                  flex={1}
                  onPress={() => goFeed('Feed')} />
                <NavTile label="Your Events" Icon={CalendarCheck}
                  flex={1}
                  count={myEventsCount}
                  onPress={() => setMyEventsOpen(true)} />
              </View>

              <Text style={styles.sectionLabel}>BROWSE</Text>
              {/* Two-column grid — half the height of a stacked list, which is
                  what kept the log-out button pushed below the fold. */}
              <View style={styles.grid}>
                <NavTile label="Events" Icon={Flag}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Events' } } as any))} />
                <NavTile label="ORS Rallys" Icon={Route}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Rallys' } } as any))} />
                <NavTile label="Cars" Icon={Car}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Cars' } } as any))} />
                <NavTile label="Groups" Icon={Users}
                  onPress={() => goFeed('Groups')} />
                <NavTile label="Members" Icon={UserRound}
                  onPress={() => goFeed('Members')} />
                <NavTile label="Articles" Icon={BookOpen}
                  onPress={() => goFeed('Articles')} />
              </View>

              <Text style={styles.sectionLabel}>SHOP</Text>
              <View style={styles.grid}>
                <NavTile label="Marketplace" Icon={ShoppingBag}
                  onPress={() => goFeed('Marketplace')} />
                <NavTile label="Shop" Icon={Store}
                  onPress={() => closeThen(() => navigation.navigate('Shop'))} />
                {/* The header's + used to be the only way to list a diecast; it
                    goes straight to a new post now, so the entry point lives
                    here beside the other selling surfaces. Pro-only, as before. */}
                {isPro && (
                  <NavTile label="List a Diecast" Icon={Package}
                    onPress={() => closeThen(() => navigation.navigate('DiecastCreate'))} />
                )}
              </View>

              <Text style={styles.sectionLabel}>MORE</Text>
              <View style={styles.grid}>
                <NavTile label="Instagram" Icon={Link}
                  onPress={() => Linking.openURL('https://instagram.com/open.road.society/')} />
                <NavTile label="Discord" Icon={MessageCircle}
                  onPress={() => Linking.openURL('https://discord.gg/MBHDngHvx')} />
                {/* Beside the other ways of reaching the society rather than
                    buried in settings — someone looking for help is looking
                    for a person, and this is where the people are. */}
                <NavTile label="Support" Icon={LifeBuoy} wide
                  onPress={() => closeThen(() => navigation.navigate('Support'))} />
              </View>

              {/* Dark slab rather than a tile — it's the story of the place, not
                  another destination in the grid. */}
              <TouchableOpacity
                style={[styles.aboutBtn, { backgroundColor: brand }]}
                onPress={() => closeThen(() => navigation.navigate('About'))}
                activeOpacity={0.85}
              >
                <Info size={16} color={brandText} />
                <Text style={[styles.aboutBtnText, { color: brandText }]}>About Open Road Society</Text>
                <ChevronRight size={12} color={brandText} style={styles.aboutChevron} />
              </TouchableOpacity>

              <View style={styles.footer}>
                {/* Above the copyright, on its own line — it's the one piece of
                    small print anyone actually goes looking for, usually to read
                    it out when something's wrong. A pill in mono, because that's
                    a build identifier rather than prose: the fixed widths make
                    the digits easy to read back over a call, and the chip marks
                    it as a value rather than a sentence. Tracks app.json, which
                    is what `npm run bump` rewrites. */}
                {APP_VERSION ? (
                  <Text style={styles.footerVersion}>v{APP_VERSION}</Text>
                ) : null}

                <View style={styles.footerBottom}>
                  <Text style={styles.footerCopy}>© {new Date().getFullYear()} Open Road Society</Text>
                  <View style={styles.footerLinks}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')} hitSlop={8}>
                      <Text style={styles.footerLink}>Privacy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')} hitSlop={8}>
                      <Text style={styles.footerLink}>Terms</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Header. Rendered after the list so it paints on top of it: an
                iOS blur samples whatever is beneath it in the hierarchy, which
                is what lets the tiles show through as they pass under. */}
            <View
              style={[styles.panelHeader, { paddingTop: insets.top + 14 }]}
              onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
            >
              <BlurView
                tint="dark"
                intensity={55}
                // Android has no real backdrop blur without this; without it
                // expo-blur degrades to a flat scrim and nothing shows through.
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              {/* Enough tint to keep the logo and icons legible over whatever
                  tile happens to be sliding under them, and no more. */}
              <View style={[StyleSheet.absoluteFill, styles.panelHeaderTint]} />
              <Text style={styles.panelLogo} numberOfLines={1}>Open Road Society</Text>
              <View style={styles.headerActions}>
                {/* No count. An unread message raises a notice in the
                    notifications list, which is where you'll have seen it —
                    a second red bubble here would be the same news told twice,
                    and the one place it can't be acted on. */}
                <HeaderIconButton
                  Icon={Mail}
                  label="Messages"
                  onPress={() => closeThen(() => navigation.navigate('Messages'))}
                />
                <HeaderIconButton
                  Icon={Bell}
                  label="Notifications"
                  count={notifCount}
                  onPress={() => closeThen(() => navigation.navigate('Notifications'))}
                />
                {/* Up here with the other things you do to your account, rather
                    than in the footer. It was costing the menu a row of its own
                    plus the gap around it — height the tiles could use — and it
                    was never navigation, which is what the list below is for. */}
                <HeaderIconButton
                  Icon={LogOut}
                  label="Log out"
                  onPress={handleLogout}
                />
                <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                  <X size={15} color={TEXT_MID} />
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </Animated.View>
      </View>

      <ProUpsellModal
        visible={proOpen}
        onClose={() => setProOpen(false)}
        title="Open Road Society Pro"
        message="We're working on a pro-level tier with additional features. If you're interested, then click Get Notified and we'll let you know when it's available."
      />

      <MyEventsSheet
        visible={myEventsOpen}
        onClose={() => setMyEventsOpen(false)}
        onSelectEvent={(event) => {
          setMyEventsOpen(false);
          // Close the drawer first — the sheet lives at the root, so it would
          // otherwise open behind it.
          closeThen(() => openEventSheet({ eventId: event.internal_id }));
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Backdrop colour now lives on the animated layer above, so this is bare.
  overlay:    { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  panel:      {
    width: PANEL_WIDTH, height: '100%',
    backgroundColor: PANEL_BG,
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: DIVIDER,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20,
  },
  panelHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
    // Clips the blur to the bar, and gives the list a visible edge to pass
    // beneath rather than fading into nothing.
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  panelHeaderTint: { backgroundColor: 'rgba(18,18,18,0.62)' },
  panelLogo:  { fontSize: 15, fontWeight: '800', letterSpacing: 0.3, color: TEXT_HI, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CHIP_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBubble: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: RED,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBubbleText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  closeBtn:   {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CHIP_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  userCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // No horizontal margin any more — the scroll content supplies the gutter
    // now that this sits inside it.
    marginBottom: 10, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 16, backgroundColor: TILE_BG,
  },
  userCardText: { flex: 1 },
  userCardName: { fontSize: 15, fontWeight: '600', color: TEXT_HI },
  userCardSub:  { fontSize: 14, fontWeight: '700', color: TEXT_MID, marginTop: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pairRow:  { flexDirection: 'row', gap: 8 },
  navTile:  {
    width: TILE_WIDTH,
    // Stacked, not inline. An icon beside a label is a list row wearing a
    // background; an icon over a label is a card. The height that costs is the
    // point of it — these were squeezed flat to keep the menu off a scroll,
    // and the menu scrolls now, which is the cheaper thing to give up.
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 16, borderRadius: 12,
    backgroundColor: TILE_BG,
  },
  navTileWide:  { width: undefined, flex: 1 },
  navTileLabel: {
    fontSize: 12.5, fontWeight: '700', color: TEXT_HI,
    textAlign: 'center', flexShrink: 1,
  },
  rowGap:       { marginTop: 8 },
  unreadPill:   {
    position: 'absolute', top: 7, right: 7,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6,
    backgroundColor: BRASS,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { fontSize: 11, fontWeight: '700', color: '#000000' },

  aboutBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 20,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12,
  },
  aboutBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },
  // The chevron is the same ink as the label, just quieter.
  aboutChevron: { opacity: 0.6 },

  sectionLabel:  {
    fontSize: 11, fontWeight: '700', color: TEXT_LO,
    letterSpacing: 0.9, paddingTop: 20, paddingBottom: 4,
  },
  footer:        {
    // Last thing in the list rather than a band pinned under it. The rule
    // still marks it off as small print — it just arrives when you reach the
    // end instead of holding a strip of the panel the whole time.
    marginTop: 20, paddingTop: 16, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  footerBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLinks:   { flexDirection: 'row', gap: 12 },
  footerLink:    { fontSize: 12, color: TEXT_MID },
  footerCopy:    { fontSize: 12, color: TEXT_FAINT },
  proCallout: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    marginHorizontal: 16, marginTop: 4, marginBottom: 10,
    paddingHorizontal: 13, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PRO_GOLD,
  },
  proCalloutIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  proCalloutText:  { flex: 1 },
  proCalloutTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  proCalloutSub:   { fontSize: 11.5, color: 'rgba(0,0,0,0.65)', marginTop: 1 },

  footerVersion: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CHIP_BG,
    // No mono is loaded, and the two platforms don't share a built-in name —
    // Android resolves anything it doesn't know to its default sans, so naming
    // one font here would quietly be mono on iOS only.
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 0.2,
    color: TEXT_MID,
  },
});
