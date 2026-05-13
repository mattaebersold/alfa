import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Pressable, Linking, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  House, Car, Users, ShoppingBag, BookOpen, Headphones, Search,
  Flag, X, ChevronRight, Settings, Link, LayoutDashboard,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from './Avatar';
import { useAppSelector } from '../../store/store';
import { Colors } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const PANEL_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);
const SLIDE_DURATION = 220;
const BRG_DARK = '#1f3e40';

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function NavRow({ label, Icon, onPress }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
      <Icon size={16} color="rgba(255,255,255,0.7)" />
      <Text style={styles.navLabel}>{label}</Text>
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

  // Navigate to a FeedStack screen (keeps tab bar + AppHeader visible)
  const goFeed = useCallback((screen: 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard') => {
    handleClose();
    navigation.navigate('MainTabs', {
      screen: 'FeedTab',
      params: { screen },
    } as any);
  }, [handleClose, navigation]);

  const displayName = userInfo
    ? [userInfo.firstName, userInfo.lastName].filter(Boolean).join(' ') || userInfo.username
    : '';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <Text style={styles.panelLogo}>Open Road Society</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
                <X size={16} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {/* User card → Dashboard */}
            {userInfo && (
              <TouchableOpacity
                style={styles.userCard}
                onPress={() => goFeed('Dashboard')}
                activeOpacity={0.8}
              >
                <Avatar
                  filename={userInfo.gallery?.[0]?.filename}
                  name={userInfo.firstName ?? '?'}
                  size={44}
                />
                <View style={styles.userCardText}>
                  <Text style={styles.userCardName}>{displayName}</Text>
                  <Text style={styles.userCardSub}>Your Dashboard</Text>
                </View>
                <ChevronRight size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <NavRow label="Home" Icon={House} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'FeedTab' });
              }} />
              <NavRow label="Events" Icon={Flag} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'SocietyTab' });
              }} />
              <NavRow label="Marketplace" Icon={ShoppingBag} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'MarketTab' });
              }} />
              <NavRow label="Cars" Icon={Car} onPress={() => {
                handleClose();
                navigation.navigate('MainTabs', { screen: 'CarsTab' });
              }} />
              <NavRow label="Groups"    Icon={Users}       onPress={() => goFeed('Groups')} />
              <NavRow label="Articles"  Icon={BookOpen}    onPress={() => goFeed('Articles')} />
              <NavRow label="Podcasts"  Icon={Headphones}  onPress={() => goFeed('Podcasts')} />
              <NavRow label="Search"    Icon={Search}      onPress={() => goFeed('Search')} />

              <SectionLabel>My Account</SectionLabel>
              <NavRow label="Dashboard" Icon={LayoutDashboard} onPress={() => goFeed('Dashboard')} />
              <NavRow label="Profile"   Icon={Settings}        onPress={() => { handleClose(); navigation.navigate('Profile'); }} />
              <NavRow label="Settings"  Icon={Settings}        onPress={() => { handleClose(); navigation.navigate('Settings'); }} />

              <SectionLabel>More</SectionLabel>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Linking.openURL('https://instagram.com/open.road.society/')}
                activeOpacity={0.7}
              >
                <Link size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.navLabel}>Instagram</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => Linking.openURL('http://shop.openroadsociety.co')}
                activeOpacity={0.7}
              >
                <ShoppingBag size={16} color="rgba(255,255,255,0.7)" />
                <Text style={styles.navLabel}>Shop</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')}>
                  <Text style={styles.footerLink}>Privacy</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')}>
                  <Text style={styles.footerLink}>Terms</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.footerCopy}>© {new Date().getFullYear()} Open Road Society</Text>
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
    backgroundColor: BRG_DARK,
    shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  panelLogo:  { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  closeBtn:   {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  userCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 12, marginBottom: 8, padding: 12,
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  userCardText: { flex: 1 },
  userCardName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  userCardSub:  { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 1 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 8 },
  navRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12,
  },
  navLabel:      { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600', flex: 1 },
  sectionLabel:  {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '800',
    letterSpacing: 0.8, paddingHorizontal: 12, paddingTop: 20, paddingBottom: 4,
  },
  footer:        { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  footerLinks:   { flexDirection: 'row', gap: 8, marginBottom: 4 },
  footerLink:    { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  footerDot:     { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
  footerCopy:    { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
});
