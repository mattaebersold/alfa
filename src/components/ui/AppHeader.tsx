import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, MessageSquare, Warehouse, PenLine, Menu } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from './Avatar';
import NavDrawer from './NavDrawer';
import { useAppSelector } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetUnreadMessageCountQuery } from '../../api/apiService';
import { Colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

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
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.action}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.firstName ?? '?'} size={28} />
        </TouchableOpacity>

        <View style={styles.rightActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Create')} style={styles.action}>
            <PenLine size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Garage')} style={styles.action}>
            <Warehouse size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Messages')} style={styles.action}>
            <MessageSquare size={22} color="#FFFFFF" />
            {msgCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.action}>
            <Bell size={22} color="#FFFFFF" />
            {notifCount > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          {/* Hamburger rightmost — opens drawer */}
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.action}>
            <Menu size={22} color="#FFFFFF" />
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
    backgroundColor: Colors.brg,
  },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action:       { padding: 6, position: 'relative' },
  badge:        {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.speed,
  },
});
