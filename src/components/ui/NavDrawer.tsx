import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Pressable, Linking, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  Car, Users, ShoppingBag, BookOpen,
  Flag, X, ChevronRight, Link, Store, Route, MessageCircle,
  Search, UserRound, Bell, Info, CalendarCheck, Mail, Package, Home,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import Avatar from './Avatar';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetMyEventsCountQuery } from '../../api/apiService';
import MyEventsSheet from '../society/MyEventsSheet';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { CONFIG } from '../../constants/config';
import { logout } from '../../store/authSlice';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);
const SLIDE_DURATION = 220;

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Half-width tile — two per row, so the menu fits without scrolling. */
function NavTile({ label, Icon, onPress, textMid, textHi, tileBg, count, wide, flex }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  textMid: string;
  textHi: string;
  tileBg: string;
  /** Unread count — renders a red pill on the right when above zero. */
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
        { backgroundColor: tileBg },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={17} color={textMid} />
      <Text style={[styles.navTileLabel, { color: textHi }]} numberOfLines={1}>{label}</Text>
      {count != null && count > 0 && (
        <View style={styles.unreadPill}>
          <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Round icon button with an unread bubble — the header's inbox shortcuts. */
function HeaderIconButton({ Icon, count, onPress, bg, tint, label }: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  count?: number;
  onPress: () => void;
  bg: string;
  tint: string;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.headerIconBtn, { backgroundColor: bg }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count} unread` : label}
      hitSlop={6}
    >
      <Icon size={17} color={tint} />
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
  const { userInfo } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const brandColor = useBrandColor();
  const isPro = useIsPro();
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
  const { openEventSheet } = useEventSheet();

  const { isDark, textHi, textMid, textLo, divider, userCardBg, closeBtnBg } = useMemo(() => {
    const dark = perceivedBrightness(brandColor) < 128;
    return {
      isDark: dark,
      textHi:     dark ? '#FFFFFF' : '#000000',
      textMid:    dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
      textLo:     dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
      divider:    dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      userCardBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      closeBtnBg: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    };
  }, [brandColor]);

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
        {/* Blurred, dimmed backdrop that fades with the panel. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={24} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.panel, { backgroundColor: brandColor, transform: [{ translateX }] }]}>
          <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <Text style={[styles.panelLogo, { color: textHi }]} numberOfLines={1}>Open Road Society</Text>
              <View style={styles.headerActions}>
                {/* No count. An unread message raises a notice in the
                    notifications list, which is where you'll have seen it —
                    a second red bubble here would be the same news told twice,
                    and the one place it can't be acted on. */}
                <HeaderIconButton
                  Icon={Mail}
                  label="Messages"
                  bg={closeBtnBg}
                  tint={textMid}
                  onPress={() => closeThen(() => navigation.navigate('Messages'))}
                />
                <HeaderIconButton
                  Icon={Bell}
                  label="Notifications"
                  count={notifCount}
                  bg={closeBtnBg}
                  tint={textMid}
                  onPress={() => closeThen(() => navigation.navigate('Notifications'))}
                />
                <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: closeBtnBg }]} hitSlop={8}>
                  <X size={16} color={textMid} />
                </TouchableOpacity>
              </View>
            </View>

            {/* User card → Dashboard */}
            {userInfo && (
              <TouchableOpacity
                style={[styles.userCard, { backgroundColor: userCardBg }]}
                onPress={() => goFeed('Dashboard')}
                activeOpacity={0.8}
              >
                <Avatar
                  user={userInfo}
                  size={44}
                />
                <View style={styles.userCardText}>
                  <Text style={[styles.userCardName, { color: textHi }]}>@{displayName}</Text>
                  <Text style={[styles.userCardSub, { color: textMid }]}>Your Dashboard</Text>
                </View>
                <ChevronRight size={14} color={textMid} />
              </TouchableOpacity>
            )}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* The feed left the tab bar, so this is its way back. It shares
                  a row with Your Events — both are places you go rather than
                  things you browse, and full-width each they pushed the grid
                  below the fold. */}
              {/* A third and two thirds: "Home" is one short word, "Your Events"
                  carries a count pill as well and wants the room. */}
              <View style={styles.pairRow}>
                <NavTile label="Home" Icon={Home} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  flex={1}
                  onPress={() => goFeed('Feed')} />
                <NavTile label="Your Events" Icon={CalendarCheck} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  flex={2}
                  count={myEventsCount}
                  onPress={() => setMyEventsOpen(true)} />
              </View>

              <View style={[styles.pairRow, styles.rowGap]}>
                <NavTile label="Search" Icon={Search} tileBg={userCardBg} textMid={textMid} textHi={textHi} wide
                  onPress={() => goFeed('Search')} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>BROWSE</Text>
              {/* Two-column grid — half the height of a stacked list, which is
                  what kept the log-out button pushed below the fold. */}
              <View style={styles.grid}>
                <NavTile label="Events" Icon={Flag} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Events' } } as any))} />
                <NavTile label="ORS Rallys" Icon={Route} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Rallys' } } as any))} />
                <NavTile label="Cars" Icon={Car} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Cars' } } as any))} />
                <NavTile label="Groups" Icon={Users} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Groups')} />
                <NavTile label="Members" Icon={UserRound} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Members')} />
                <NavTile label="Articles" Icon={BookOpen} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Articles')} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>SHOP</Text>
              <View style={styles.grid}>
                <NavTile label="Marketplace" Icon={ShoppingBag} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Marketplace')} />
                <NavTile label="Shop" Icon={Store} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('Shop'))} />
                {/* The header's + used to be the only way to list a diecast; it
                    goes straight to a new post now, so the entry point lives
                    here beside the other selling surfaces. Pro-only, as before. */}
                {isPro && (
                  <NavTile label="List a Diecast" Icon={Package} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                    onPress={() => closeThen(() => navigation.navigate('DiecastCreate'))} />
                )}
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>MORE</Text>
              <View style={styles.grid}>
                <NavTile label="Instagram" Icon={Link} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => Linking.openURL('https://instagram.com/open.road.society/')} />
                <NavTile label="Discord" Icon={MessageCircle} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => Linking.openURL('https://discord.gg/MBHDngHvx')} />
              </View>

              {/* Dark slab rather than a tile — it's the story of the place, not
                  another destination in the grid. */}
              <TouchableOpacity
                style={[styles.aboutBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : '#111111' }]}
                onPress={() => closeThen(() => navigation.navigate('About'))}
                activeOpacity={0.85}
              >
                <Info size={18} color="#FFFFFF" />
                <Text style={styles.aboutBtnText}>About Open Road Society</Text>
                <ChevronRight size={15} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: divider }]}>
              {/* Compact, low-emphasis — it shouldn't compete with navigation. */}
              <View style={styles.footerTop}>
                <View style={styles.footerLinks}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')} hitSlop={8} style={styles.footerLinkBtn}>
                    <Text style={[styles.footerLink, { color: textLo }]}>Privacy</Text>
                  </TouchableOpacity>
                  <Text style={[styles.footerDot, { color: textLo }]}>·</Text>
                  <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')} hitSlop={8} style={styles.footerLinkBtn}>
                    <Text style={[styles.footerLink, { color: textLo }]}>Terms</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.logoutBtn, { borderColor: divider }]}
                  onPress={() => closeThen(() => dispatch(logout()))}
                  activeOpacity={0.8}
                  hitSlop={8}
                >
                  <LogOut size={13} color={textMid} />
                  <Text style={[styles.logoutText, { color: textMid }]}>Log Out</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.footerCopy, { color: textLo }]}>© {new Date().getFullYear()} Open Road Society</Text>
            </View>
          </View>
        </Animated.View>
      </View>

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
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  panelLogo:  { fontSize: 15, fontWeight: '800', letterSpacing: 0.3, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  headerBubble: {
    position: 'absolute', top: -3, right: -3,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: '#EC4632',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBubbleText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  closeBtn:   {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  userCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginBottom: 8, padding: 12,
    borderRadius: 16,
  },
  userCardText: { flex: 1 },
  userCardName: { fontSize: 15, fontWeight: '600' },
  userCardSub:  { fontSize: 13, marginTop: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 8 },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 },
  pairRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  navTile:  {
    // Two per row: half the space minus the gap between them.
    width: (PANEL_WIDTH - 32 - 8) / 2,
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 10, paddingVertical: 12, borderRadius: 10,
  },
  navTileWide:  { width: undefined, flex: 1 },
  navTileLabel: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },
  rowGap:       { marginTop: 8 },
  unreadPill:   {
    marginLeft: 'auto',
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: '#EC4632',
    alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  aboutBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 4, marginTop: 20,
    paddingHorizontal: 14, paddingVertical: 14, borderRadius: 12,
  },
  aboutBtnText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#FFFFFF' },

  sectionLabel:  {
    fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 6,
  },
  footer:        { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  logoutBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },
  logoutText:    { fontSize: 12, fontWeight: '700' },
  footerLinks:   { flexDirection: 'row', gap: 8 },
  footerLinkBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  footerLink:    { fontSize: 12 },
  footerDot:     { fontSize: 12, lineHeight: 23 },
  footerCopy:    { fontSize: 12 },
});
