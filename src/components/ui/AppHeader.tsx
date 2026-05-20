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
import { useBrandColor, useBrandTextColor } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

export default function AppHeader() {
  const navigation = useNavigation<NavProp>();
  const { isLoggedIn, userInfo } = useAppSelector((s) => s.auth);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const brandBg = useBrandColor();
  const iconColor = useBrandTextColor();
  const statusBarStyle = iconColor === '#FFFFFF' ? 'light-content' : 'dark-content';

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
      <StatusBar barStyle={statusBarStyle} backgroundColor={brandBg} />
      <View style={[styles.bar, { backgroundColor: brandBg }]}>
        <TouchableOpacity onPress={() => (navigation as any).navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Profile' } })} style={styles.profileBtn}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.username ?? '?'} size={36} />
          {userInfo?.username && (
            <Text style={[styles.username, { color: iconColor }]}>@{userInfo.username}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Create')} style={styles.action} hitSlop={4}>
            <PenLine size={24} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (navigation as any).navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Garage' } })} style={styles.action} hitSlop={4}>
            <Warehouse size={24} color={iconColor} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.action} hitSlop={4}>
            <MessageSquare size={24} color={iconColor} />
            {msgCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.action} hitSlop={4}>
            <Bell size={24} color={iconColor} />
            {notifCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.action} hitSlop={4}>
            <Menu size={24} color={iconColor} />
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
  },
  profileBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6 },
  username:     { fontSize: 14, fontWeight: '700' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  action:       { padding: 10, position: 'relative' },
  badge:        {
    position: 'absolute', top: 6, right: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#e53935',
  },
});
