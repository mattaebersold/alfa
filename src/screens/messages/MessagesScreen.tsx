import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';
import { Plus, MoreVertical } from 'lucide-react-native';
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
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import type { AppStackParamList } from '../../navigation/types';
import type { Message } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

type ConversationSummary = {
  otherUserId: string;
  allThreadIds: string[];
  representative: Message;
  /** Newest message either way round — what the row previews and timestamps. */
  lastMessage: Message;
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
  const { representative: msg, lastMessage, hasUnread } = summary;

  const isMine = msg.sender_id === myUserId;
  const otherId = isMine ? msg.recipient_id : msg.sender_id;
  const populated = isMine ? msg.recipient : msg.sender;
  const { data: fetched } = useGetUserByIdQuery(otherId, { skip: !otherId || !!populated });
  const other = populated ?? fetched;
  const name = other?.username || 'Unknown';

  // Timestamp and preview both describe the newest message, so they agree —
  // showing "4 months ago" beside a line someone sent you last week doesn't.
  const timeAgo = lastMessage.created_at
    ? formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })
    : '';
  const lastIsMine = lastMessage.sender_id === myUserId;

  // Two steps: the menu names what you're acting on, the confirm covers the
  // fact that a mis-tap here isn't recoverable.
  const openMenu = () => {
    Alert.alert(`@${name}`, undefined, [
      {
        text: 'Delete conversation',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Delete conversation?',
          `Your whole history with @${name} will be removed. This cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: onDelete },
          ],
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {hasUnread && <View style={[styles.unreadBar, { backgroundColor: colors.primaryAlt }]} />}
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
        {/* Subject dropped: it duplicates the preview more often than it adds
            anything, and a row reads faster as handle + last line. */}
        <Text
          style={[
            styles.preview,
            { color: hasUnread && !lastIsMine ? colors.fg : colors.grey },
            hasUnread && !lastIsMine && styles.previewBold,
          ]}
          numberOfLines={1}
        >
          {lastIsMine ? `You: ${lastMessage.body}` : lastMessage.body}
        </Text>
      </View>
      <TouchableOpacity
        onPress={openMenu}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={`Options for conversation with ${name}`}
      >
        <MoreVertical size={18} color={colors.grey} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  // The inbox refreshes on its own so a new conversation appears without
  // reopening the app — slower than an open thread, since this only needs to be
  // roughly current rather than conversational.
  const appActive = useIsAppActive();
  const { data, isLoading, refetch } = useGetMessagesQuery({ limit: 50 }, {
    pollingInterval: appActive ? CONFIG.MESSAGE_POLL_INTERVAL : 0,
  });
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
        // Sorted explicitly rather than trusting the API's newest-first order,
        // since this collapses several threads into one conversation and their
        // messages interleave.
        const newestFirst = [...userMsgs].sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        );
        const unreadFromOther = userMsgs.filter((m) => m.sender_id !== myId && !m.read);
        const allThreadIds = [...new Set(userMsgs.map((m) => m.thread_id))];
        return {
          otherUserId: otherId,
          allThreadIds,
          representative,
          lastMessage: newestFirst[0] ?? representative,
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
  list:        { flexGrow: 1, paddingTop: 12, paddingBottom: 80 },
  // Each conversation is its own card. A hairline divider can't do the job on
  // this palette — the dark card and the dark border are two shades apart and
  // the rows run together — so the separation is the gap between them.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  rowContent:  { flex: 1, minWidth: 0 },
  rowHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:        { flex: 1, fontSize: 15, fontWeight: '600' },
  nameBold:    { fontWeight: '800' },
  time:        { fontSize: 10, marginLeft: 8 },
  preview:     { fontSize: 13, marginTop: 2 },
  previewBold: { fontWeight: '600' },
  // Full-height stripe rather than a dot: it doesn't need to know how tall the
  // card grew, and it reads at a glance down a list of them.
  unreadBar:   { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
