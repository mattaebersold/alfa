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

  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
        !notification.read_status && styles.rowUnread,
      ]}
      onPress={onRead}
      activeOpacity={0.8}
    >
      <Avatar
        filename={notification.sender?.gallery?.[0]?.filename}
        name={notification.sender?.firstName ?? '?'}
        size={38}
      />
      <View style={styles.rowContent}>
        <Text style={[styles.message, { color: colors.fg }]} numberOfLines={3}>{notification.message}</Text>
        <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={onArchive} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Archive size={16} color={colors.grey} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Delete notification?', '', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={16} color={colors.grey} />
        </TouchableOpacity>
      </View>
      {!notification.read_status && <View style={styles.unreadDot} />}
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
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Toolbar */}
      {notifications.length > 0 && (
        <View style={[styles.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {unreadCount > 0 ? (
            <TouchableOpacity style={styles.toolBtn} onPress={handleMarkAll}>
              <CheckCheck size={15} color={colors.cyan} />
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
  safe:        { flex: 1 },
  toolbar:     {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toolBtnText: { fontSize: 13, fontWeight: '600', color: colors.cyan },
  list:        { flexGrow: 1, paddingBottom: 24 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
    position: 'relative',
  },
  rowUnread:   { backgroundColor: '#D4D4D4' },
  rowContent:  { flex: 1 },
  message:     { fontSize: 14, lineHeight: 20 },
  time:        { fontSize: 12, marginTop: 3 },
  rowActions:  { flexDirection: 'row', gap: 12, paddingTop: 2 },
  unreadDot:   {
    position: 'absolute', top: 14, left: 4,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.cyan,
  },
});
