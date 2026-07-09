import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Archive, CheckCheck } from 'lucide-react-native';
import {
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useArchiveNotificationMutation,
  useArchiveAllNotificationsMutation,
  useDeleteNotificationMutation,
  useApproveGroupMemberMutation,
  useRejectGroupMemberMutation,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Notification } from '../../types/api';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

// Map a notification's referenced content to a navigation target.
function targetForNotification(n: Notification): { name: keyof AppStackParamList; params: any } | null {
  const id = n.content_id;
  if (n.type === 'follow') {
    const uid = n.sender?.user_id ?? id;
    return uid ? { name: 'UserDetail', params: { userId: uid } } : null;
  }
  switch (n.content_type) {
    case 'post':      return id ? { name: 'PostDetailModal', params: { postId: id } } : null;
    case 'garagecar': return id ? { name: 'CarDetail', params: { carId: id } } : null;
    case 'user':      return id ? { name: 'UserDetail', params: { userId: id } } : null;
    case 'group':     return id ? { name: 'GroupDetail', params: { groupId: id } } : null;
    default:
      return n.sender?.user_id ? { name: 'UserDetail', params: { userId: n.sender.user_id } } : null;
  }
}

function NotificationRow({
  notification,
  onRead,
  onArchive,
  onDelete,
  onApprove,
  onDeny,
}: {
  notification: Notification;
  onRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const isJoinRequest = notification.type === 'group_join_request';
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
        {isJoinRequest && (
          <View style={styles.joinReqActions}>
            <TouchableOpacity style={styles.approveBtn} onPress={onApprove} activeOpacity={0.85}>
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.denyBtn} onPress={onDeny} activeOpacity={0.85}>
              <Text style={styles.denyText}>Deny</Text>
            </TouchableOpacity>
          </View>
        )}
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
  const navigation = useNavigation<NavProp>();
  const { data, isLoading, refetch } = useGetNotificationsQuery({ limit: 50 });
  const [markRead] = useMarkNotificationReadMutation();

  // Tapping a notification: mark read, close the pane, and open the referenced content.
  const handlePress = useCallback((n: Notification) => {
    if (!n.read_status) markRead(n.internal_id);
    const target = targetForNotification(n);
    navigation.goBack();
    if (target) navigation.navigate(target.name as any, target.params);
  }, [markRead, navigation]);
  const [markAllRead] = useMarkAllNotificationsReadMutation();
  const [archive] = useArchiveNotificationMutation();
  const [archiveAll] = useArchiveAllNotificationsMutation();
  const [deleteNotif] = useDeleteNotificationMutation();
  const [approveMember] = useApproveGroupMemberMutation();
  const [rejectMember] = useRejectGroupMemberMutation();

  // Approve / deny a group join request straight from the notification.
  const handleApprove = useCallback((n: Notification) => {
    const groupId = n.content_id;
    const userId = n.sender?.user_id;
    if (groupId && userId) approveMember({ groupId, userId });
    markRead(n.internal_id);
  }, [approveMember, markRead]);

  const handleDeny = useCallback((n: Notification) => {
    const groupId = n.content_id;
    const userId = n.sender?.user_id;
    if (groupId && userId) rejectMember({ groupId, userId });
    markRead(n.internal_id);
  }, [rejectMember, markRead]);

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
            onRead={() => handlePress(item)}
            onArchive={() => archive(item.internal_id)}
            onDelete={() => deleteNotif(item.internal_id)}
            onApprove={() => handleApprove(item)}
            onDeny={() => handleDeny(item)}
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
  joinReqActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn:  { backgroundColor: 'rgb(37, 162, 211)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  approveText: { color: '#000000', fontSize: 13, fontWeight: '800' },
  denyBtn:     { backgroundColor: '#2A2A2A', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  denyText:    { color: '#ECECEC', fontSize: 13, fontWeight: '700' },
  unreadDot:   {
    position: 'absolute', top: 14, left: 4,
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#e53935',
  },
});
