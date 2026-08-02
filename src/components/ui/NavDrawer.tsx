import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Pressable, Linking, Animated, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  House, Car, Users, ShoppingBag, BookOpen, Headphones,
  Flag, X, ChevronRight, Settings, Link, LayoutDashboard, Store, Route, MessageCircle,
  Search, MessageSquare, UserRound,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import Avatar from './Avatar';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { logout } from '../../store/authSlice';
import { useBrandColor } from '../../hooks/useBrandColor';
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
function NavTile({ label, Icon, onPress, textMid, textHi, tileBg }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  textMid: string;
  textHi: string;
  tileBg: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.navTile, { backgroundColor: tileBg }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={17} color={textMid} />
      <Text style={[styles.navTileLabel, { color: textHi }]} numberOfLines={1}>{label}</Text>
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

  const goFeed = useCallback((screen: 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard' | 'Members' | 'Marketplace') => {
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
              <Text style={[styles.panelLogo, { color: textHi }]}>Open Road Society</Text>
              <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: closeBtnBg }]} hitSlop={8}>
                <X size={16} color={textMid} />
              </TouchableOpacity>
            </View>

            {/* User card → Dashboard */}
            {userInfo && (
              <TouchableOpacity
                style={[styles.userCard, { backgroundColor: userCardBg }]}
                onPress={() => goFeed('Dashboard')}
                activeOpacity={0.8}
              >
                <Avatar
                  filename={userInfo.gallery?.[0]?.filename}
                  name={userInfo.username ?? '?'}
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
              {/* Search + Messages — full-width, they're the most-used actions. */}
              <View style={styles.pairRow}>
                <NavTile label="Search" Icon={Search} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Search')} />
                <NavTile label="Messages" Icon={MessageSquare} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('Messages'))} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>BROWSE</Text>
              {/* Two-column grid — half the height of a stacked list, which is
                  what kept the log-out button pushed below the fold. */}
              <View style={styles.grid}>
                <NavTile label="Home" Icon={House} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'FeedTab' }))} />
                <NavTile label="Events" Icon={Flag} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Society' } } as any))} />
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
                <NavTile label="Podcasts" Icon={Headphones} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Podcasts')} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>SHOP</Text>
              <View style={styles.grid}>
                <NavTile label="Marketplace" Icon={ShoppingBag} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Marketplace')} />
                <NavTile label="Shop" Icon={Store} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('Shop'))} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>MY ACCOUNT</Text>
              <View style={styles.grid}>
                <NavTile label="Dashboard" Icon={LayoutDashboard} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => goFeed('Dashboard')} />
                <NavTile label="Settings" Icon={Settings} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => closeThen(() => navigation.navigate('Settings'))} />
              </View>

              <Text style={[styles.sectionLabel, { color: textLo }]}>MORE</Text>
              <View style={styles.grid}>
                <NavTile label="Instagram" Icon={Link} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => Linking.openURL('https://instagram.com/open.road.society/')} />
                <NavTile label="Discord" Icon={MessageCircle} tileBg={userCardBg} textMid={textMid} textHi={textHi}
                  onPress={() => Linking.openURL('https://discord.gg/MBHDngHvx')} />
              </View>
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
  panelLogo:  { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
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
  navTileLabel: { fontSize: 13.5, fontWeight: '700', flexShrink: 1 },

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
