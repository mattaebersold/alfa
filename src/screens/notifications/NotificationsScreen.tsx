import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Archive, CheckCheck } from 'lucide-react-native';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useArchiveNotificationMutation,
  useArchiveAllNotificationsMutation,
  useDeleteNotificationMutation,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Notification } from '../../types/api';
import { ss } from '../../styles/shared';

function NotificationRow({
  notification,
  onRead,
  onArchive,
  onDelete,
}: {
  notification: Notification;
  onRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const timeAgo = notification.createdAt
    ? formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })
    : '';

  const isUnread = !notification.read_status;
  const username = notification.sender?.username ?? null;
  const senderName = username
    ? `@${username}`
    : [notification.sender?.firstName, notification.sender?.lastName].filter(Boolean).join(' ') || null;

  return (
    <TouchableOpacity
      style={[
        ss.listRow,
        isUnread ? styles.rowUnread : styles.rowRead,
        { borderBottomColor: 'rgba(255,255,255,0.06)' },
      ]}
      onPress={onRead}
      activeOpacity={0.8}
    >
      {isUnread && <View style={styles.unreadDot} />}
      <Avatar
        filename={notification.sender?.gallery?.[0]?.filename}
        name={username ?? '?'}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text style={[styles.message, { color: '#fff' }]} numberOfLines={3}>
          {senderName ? <Text style={styles.senderName}>{senderName} </Text> : null}
          {notification.message}
        </Text>
        <Text style={[styles.time, { color: '#888' }]}>{timeAgo}</Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={onArchive} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Archive size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Delete notification?', '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={16} color="#666" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const { data, isLoading, refetch } = useGetNotificationsQuery({ limit: 50 });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [archive] = useArchiveNotificationMutation();
  const [archiveAll] = useArchiveAllNotificationsMutation();
  const [deleteNotif] = useDeleteNotificationMutation();

  const notifications = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read_status).length;

  const handleMarkAll = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  const handleArchiveAll = useCallback(async () => {
    Alert.alert('Archive all?', 'This will archive all notifications.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive All', onPress: () => archiveAll() },
    ]);
  }, [archiveAll]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: '#000' }]} edges={['bottom']}>
      {/* Toolbar */}
      {notifications.length > 0 && (
        <View style={[styles.toolbar, { backgroundColor: '#111', borderBottomColor: '#333' }]}>
          {unreadCount > 0 ? (
            <TouchableOpacity style={styles.toolBtn} onPress={handleMarkAll}>
              <CheckCheck size={15} color={colors.primaryAlt} />
              <Text style={styles.toolBtnText}>Mark all read</Text>
            </TouchableOpacity>
          ) : <View />}
          <TouchableOpacity style={styles.toolBtn} onPress={handleArchiveAll}>
            <Archive size={15} color={colors.grey} />
            <Text style={[styles.toolBtnText, { color: colors.grey }]}>Archive all</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            onRead={() => !item.read_status && markRead(item.internal_id)}
            onArchive={() => archive(item.internal_id)}
            onDelete={() => deleteNotif(item.internal_id)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No notifications" message="You're all caught up." />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toolbar:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toolBtnText: { fontSize: 13, fontWeight: '600', color: colors.primaryAlt },
  list:        { flexGrow: 1, paddingBottom: 24 },
  rowRead:     { backgroundColor: '#000' },
  rowUnread:   { backgroundColor: '#1c1c1c' },
  rowContent:  { flex: 1 },
  message:     { fontSize: 14, lineHeight: 20 },
  senderName:  { fontWeight: '700' },
  time:        { fontSize: 12, marginTop: 3 },
  rowActions:  { flexDirection: 'row', gap: 12, paddingTop: 2 },
  unreadDot:   {
    position: 'absolute', top: 14, left: 4,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#e53935',
  },
});
