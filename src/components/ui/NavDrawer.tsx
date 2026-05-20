import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Pressable, Linking, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  House, Car, Users, ShoppingBag, BookOpen, Headphones, Search,
  Flag, X, ChevronRight, Settings, Link, LayoutDashboard, User,
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

function NavRow({ label, Icon, onPress, textMid, textHi }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  textMid: string;
  textHi: string;
}) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
      <Icon size={16} color={textMid} />
      <Text style={[styles.navLabel, { color: textHi }]}>{label}</Text>
    </TouchableOpacity>
  );
}

interface NavDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export default function NavDrawer({ visible, onClose }: NavDrawerProps) {
  const navigation = useNavigation<NavProp>();
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

  useEffect(() => {
    if (visible) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: SLIDE_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    Animated.timing(translateX, {
      toValue: PANEL_WIDTH,
      duration: SLIDE_DURATION,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(PANEL_WIDTH);
      onClose();
    });
  }, [onClose, translateX]);

  const goFeed = useCallback((screen: 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard') => {
    handleClose();
    navigation.navigate('MainTabs', {
      screen: 'FeedTab',
      params: { screen },
    } as any);
  }, [handleClose, navigation]);

  const displayName = userInfo?.username ?? '';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.panel, { backgroundColor: brandColor, transform: [{ translateX }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
              <NavRow label="Home" Icon={House} textMid={textMid} textHi={textHi} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'FeedTab' });
              }} />
              <NavRow label="Events" Icon={Flag} textMid={textMid} textHi={textHi} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'SocietyTab' });
              }} />
              <NavRow label="Marketplace" Icon={ShoppingBag} textMid={textMid} textHi={textHi} onPress={() => {
                handleClose();
                navigation.navigate('Marketplace');
              }} />
              <NavRow label="Cars"      Icon={Car}         textMid={textMid} textHi={textHi} onPress={() => { handleClose(); navigation.navigate('MainTabs', { screen: 'CarsTab' }); }} />
              <NavRow label="Groups"    Icon={Users}       textMid={textMid} textHi={textHi} onPress={() => goFeed('Groups')} />
              <NavRow label="Members"   Icon={Users}       textMid={textMid} textHi={textHi} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Members' } } as any);
              }} />
              <NavRow label="Articles"  Icon={BookOpen}    textMid={textMid} textHi={textHi} onPress={() => goFeed('Articles')} />
              <NavRow label="Podcasts"  Icon={Headphones}  textMid={textMid} textHi={textHi} onPress={() => goFeed('Podcasts')} />
              <NavRow label="Search"    Icon={Search}      textMid={textMid} textHi={textHi} onPress={() => goFeed('Search')} />

              <Text style={[styles.sectionLabel, { color: textLo }]}>MY ACCOUNT</Text>
              <NavRow label="Dashboard" Icon={LayoutDashboard} textMid={textMid} textHi={textHi} onPress={() => goFeed('Dashboard')} />
              <NavRow label="Profile"   Icon={User}            textMid={textMid} textHi={textHi} onPress={() => { handleClose(); (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } }); }} />
              <NavRow label="Settings"  Icon={Settings}        textMid={textMid} textHi={textHi} onPress={() => { handleClose(); navigation.navigate('Settings'); }} />
              <NavRow label="Log Out"   Icon={LogOut}          textMid={textMid} textHi={textHi} onPress={() => { handleClose(); dispatch(logout()); }} />

              <Text style={[styles.sectionLabel, { color: textLo }]}>MORE</Text>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Linking.openURL('https://instagram.com/open.road.society/')}
                activeOpacity={0.7}
              >
                <Link size={16} color={textMid} />
                <Text style={[styles.navLabel, { color: textHi }]}>Instagram</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Linking.openURL('http://shop.openroadsociety.co')}
                activeOpacity={0.7}
              >
                <ShoppingBag size={16} color={textMid} />
                <Text style={[styles.navLabel, { color: textHi }]}>Shop</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: divider }]}>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')} hitSlop={8} style={styles.footerLinkBtn}>
                  <Text style={[styles.footerLink, { color: textLo }]}>Privacy</Text>
                </TouchableOpacity>
                <Text style={[styles.footerDot, { color: textLo }]}>·</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')} hitSlop={8} style={styles.footerLinkBtn}>
                  <Text style={[styles.footerLink, { color: textLo }]}>Terms</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.footerCopy, { color: textLo }]}>© {new Date().getFullYear()} Open Road Society</Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: 'rgba(100,100,100,0.5)' },
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
  navRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12,
  },
  navLabel:      { fontSize: 16, fontWeight: '600', flex: 1 },
  sectionLabel:  {
    fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 4,
  },
  footer:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },
  footerLinks:   { flexDirection: 'row', gap: 8, marginBottom: 6 },
  footerLinkBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  footerLink:    { fontSize: 11 },
  footerDot:     { fontSize: 11, lineHeight: 23 },
  footerCopy:    { fontSize: 11 },
});
