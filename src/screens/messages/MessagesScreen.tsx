import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetMessagesQuery,
  useDeleteMessageThreadMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { AppStackParamList } from '../../navigation/types';
import type { Message } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function ThreadRow({
  message,
  myUserId,
  onPress,
  onDelete,
}: {
  message: Message;
  myUserId: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  const isMine = message.sender_id === myUserId;
  const other = isMine ? message.recipient : message.sender;
  const name = other ? `${other.firstName} ${other.lastName}` : 'Unknown';
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';
  const isUnread = !message.read && !isMine;

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Avatar
        filename={other?.gallery?.[0]?.filename}
        name={other?.firstName ?? '?'}
        size={44}
      />
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.name, isUnread && styles.nameBold]} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
        {message.subject ? (
          <Text style={styles.subject} numberOfLines={1}>{message.subject}</Text>
        ) : null}
        <Text style={styles.preview} numberOfLines={1}>{message.body}</Text>
      </View>
      <TouchableOpacity
        onPress={() => Alert.alert('Delete thread?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ])}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Trash2 size={16} color={Colors.grey} />
      </TouchableOpacity>
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const { data, isLoading, refetch } = useGetMessagesQuery({ limit: 50 });
  const [deleteThread] = useDeleteMessageThreadMutation();

  const messages = data?.entries ?? [];

  // Deduplicate by thread_id — keep the latest message per thread
  const threads = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const m of messages) {
      if (!seen.has(m.thread_id)) {
        seen.add(m.thread_id);
        out.push(m);
      }
    }
    return out;
  }, [messages]);

  const handlePress = useCallback((msg: Message) => {
    const isMine = msg.sender_id === myId;
    const other = isMine ? msg.recipient : msg.sender;
    navigation.navigate('MessageThread', {
      threadId: msg.thread_id,
      recipientId: isMine ? msg.recipient_id : msg.sender_id,
      subject: msg.subject,
    });
  }, [navigation, myId]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.thread_id}
        renderItem={({ item }) => (
          <ThreadRow
            message={item}
            myUserId={myId}
            onPress={() => handlePress(item)}
            onDelete={() => deleteThread(item.thread_id)}
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

      {/* FAB — compose */}
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
  safe:      { flex: 1, backgroundColor: Colors.cream },
  list:      { flexGrow: 1, paddingBottom: 80 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  rowUnread: { backgroundColor: '#F0F7F7' },
  rowContent:{ flex: 1, minWidth: 0 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name:      { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.fg },
  nameBold:  { fontWeight: '800' },
  time:      { fontSize: 12, color: Colors.grey, marginLeft: 8 },
  subject:   { fontSize: 13, fontWeight: '600', color: Colors.muted, marginTop: 2 },
  preview:   { fontSize: 13, color: Colors.grey, marginTop: 2 },
  unreadDot: {
    position: 'absolute', top: 14, left: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.cyan,
  },
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brg,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
});
