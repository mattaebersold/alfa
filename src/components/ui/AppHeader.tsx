import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Bell, MessageSquare, Warehouse, PenLine, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from './Avatar';
import NavDrawer from './NavDrawer';
import { useAppSelector } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetUnreadMessageCountQuery } from '../../api/apiService';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function perceivedBrightness(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

const BG = colors.primaryAlt;
const ICON_COLOR = perceivedBrightness(BG) < 128 ? '#FFFFFF' : '#000000';
const headerBarStyle = ICON_COLOR === '#FFFFFF' ? 'light-content' : 'dark-content';

export default function AppHeader() {
  const navigation = useNavigation<NavProp>();
  const { isLoggedIn, userInfo } = useAppSelector((s) => s.auth);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: notifData } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });
  const { data: msgData } = useGetUnreadMessageCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.MESSAGE_POLL_INTERVAL,
  });

  const notifCount = notifData?.count ?? 0;
  const msgCount = msgData?.count ?? 0;

  return (
    <>
      <StatusBar barStyle={headerBarStyle} backgroundColor={BG} />
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })} style={styles.profileBtn}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.firstName ?? '?'} size={36} />
          {userInfo?.username && (
            <Text style={[styles.username, { color: ICON_COLOR }]}>@{userInfo.username}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Create')} style={styles.action}>
            <PenLine size={26} color={ICON_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (navigation as any).navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Garage' } })} style={styles.action}>
            <Warehouse size={26} color={ICON_COLOR} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.action}>
            <MessageSquare size={26} color={ICON_COLOR} />
            {msgCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.action}>
            <Bell size={26} color={ICON_COLOR} />
            {notifCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.action}>
            <Menu size={26} color={ICON_COLOR} />
          </TouchableOpacity>
        </View>
      </View>

      <NavDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryAlt,
  },
  profileBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 },
  username:     { fontSize: 14, fontWeight: '700' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action:       { padding: 6, position: 'relative' },
  badge:        {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#e53935',
  },
});
