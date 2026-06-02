import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetMessagesQuery,
  useDeleteMessageThreadMutation,
  useGetUserByIdQuery,
  useMarkMessageReadMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Message } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

type ConversationSummary = {
  otherUserId: string;
  allThreadIds: string[];
  representative: Message;
  lastFromOther: Message | null;
  hasUnread: boolean;
  unreadFromOtherIds: string[];
};

function ConversationRow({
  summary,
  myUserId,
  onPress,
  onDelete,
}: {
  summary: ConversationSummary;
  myUserId: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const { representative: msg, lastFromOther, hasUnread } = summary;

  const isMine = msg.sender_id === myUserId;
  const otherId = isMine ? msg.recipient_id : msg.sender_id;
  const populated = isMine ? msg.recipient : msg.sender;
  const { data: fetched } = useGetUserByIdQuery(otherId, { skip: !otherId || !!populated });
  const other = populated ?? fetched;
  const name = other?.username || 'Unknown';

  const previewMsg = lastFromOther ?? msg;
  const timeAgo = previewMsg.created_at
    ? formatDistanceToNow(new Date(previewMsg.created_at), { addSuffix: true })
    : '';

  return (
    <TouchableOpacity
      style={[
        ss.listRow,
        { backgroundColor: colors.card, borderBottomColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {hasUnread && <View style={styles.unreadDot} />}
      <Avatar
        filename={other?.gallery?.[0]?.filename}
        name={other?.username ?? '?'}
        size={44}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.name, { color: colors.fg }, hasUnread && styles.nameBold]} numberOfLines={1}>
            @{name}
          </Text>
          <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
        </View>
        {msg.subject ? (
          <Text style={[styles.subject, { color: colors.muted }]} numberOfLines={1}>{msg.subject}</Text>
        ) : null}
        {lastFromOther ? (
          <Text style={[styles.preview, { color: hasUnread ? colors.fg : colors.grey }, hasUnread && styles.previewBold]} numberOfLines={1}>
            {lastFromOther.body}
          </Text>
        ) : (
          <Text style={[styles.preview, { color: colors.grey }]} numberOfLines={1}>
            You: {msg.body}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => Alert.alert('Delete thread?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ])}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Trash2 size={16} color={colors.grey} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const { data, isLoading, refetch } = useGetMessagesQuery({ limit: 50 });
  const [deleteThread] = useDeleteMessageThreadMutation();
  const [markRead] = useMarkMessageReadMutation();

  // Refetch when returning from a thread so read status is always current
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const messages = data?.entries ?? [];

  // Build one summary per other-user (collapses multiple threads with the same person)
  const conversations = React.useMemo<ConversationSummary[]>(() => {
    // Group all messages by the other person's user_id (API returns newest-first)
    const byUser = new Map<string, Message[]>();
    for (const m of messages) {
      const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id;
      const arr = byUser.get(otherId) ?? [];
      arr.push(m);
      byUser.set(otherId, arr);
    }

    const seenUsers = new Set<string>();
    return messages
      .filter((m) => {
        const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id;
        if (seenUsers.has(otherId)) return false;
        seenUsers.add(otherId);
        return true;
      })
      .map((representative) => {
        const otherId = representative.sender_id === myId ? representative.recipient_id : representative.sender_id;
        const userMsgs = byUser.get(otherId) ?? [representative];
        const fromOther = userMsgs.filter((m) => m.sender_id !== myId);
        const unreadFromOther = fromOther.filter((m) => !m.read);
        const allThreadIds = [...new Set(userMsgs.map((m) => m.thread_id))];
        return {
          otherUserId: otherId,
          allThreadIds,
          representative,
          lastFromOther: fromOther[0] ?? null,
          hasUnread: unreadFromOther.length > 0,
          unreadFromOtherIds: unreadFromOther.map((m) => m.internal_id),
        };
      });
  }, [messages, myId]);

  const handlePress = useCallback((summary: ConversationSummary) => {
    summary.unreadFromOtherIds.forEach((id) => markRead(id));
    const { representative: msg } = summary;
    const isMine = msg.sender_id === myId;
    navigation.navigate('MessageThread', {
      threadId: msg.thread_id,
      recipientId: isMine ? msg.recipient_id : msg.sender_id,
      subject: msg.subject,
    });
  }, [navigation, myId, markRead]);

  const handleDelete = useCallback((summary: ConversationSummary) => {
    summary.allThreadIds.forEach((tid) => deleteThread(tid));
  }, [deleteThread]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.otherUserId}
        renderItem={({ item }) => (
          <ConversationRow
            summary={item}
            myUserId={myId}
            onPress={() => handlePress(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No messages" message="Start a conversation." />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={false}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('ComposeMessage', {})}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:        { flexGrow: 1, paddingBottom: 80 },
  rowContent:  { flex: 1, minWidth: 0 },
  rowHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { flex: 1, fontSize: 15, fontWeight: '600' },
  nameBold:    { fontWeight: '800' },
  time:        { fontSize: 12, marginLeft: 8 },
  subject:     { fontSize: 13, fontWeight: '600', marginTop: 2 },
  preview:     { fontSize: 13, marginTop: 2 },
  previewBold: { fontWeight: '600' },
  unreadDot:   {
    position: 'absolute', top: 18, left: 6,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primaryAlt,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
