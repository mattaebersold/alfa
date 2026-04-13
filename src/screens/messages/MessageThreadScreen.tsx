import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react-native';
import {
  useGetMessageThreadQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { Colors } from '../../constants/colors';
import type { AppScreenProps } from '../../navigation/types';
import type { Message } from '../../types/api';

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && (
        <Avatar
          filename={message.sender?.gallery?.[0]?.filename}
          name={message.sender?.firstName ?? '?'}
          size={28}
        />
      )}
      <View style={styles.bubbleBody}>
        <View style={[styles.bubbleContent, isMe ? styles.bubbleContentMe : styles.bubbleContentThem]}>
          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
            {message.body}
          </Text>
        </View>
        <Text style={[styles.bubbleTime, isMe && { textAlign: 'right' }]}>{timeAgo}</Text>
      </View>
    </View>
  );
}

export default function MessageThreadScreen({ route, navigation }: AppScreenProps<'MessageThread'>) {
  const { threadId, recipientId, subject } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const [body, setBody] = useState('');
  const listRef = useRef<FlatList>(null);

  const { data: messages = [], isLoading, refetch } = useGetMessageThreadQuery(threadId);
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkMessageReadMutation();

  // Mark unread messages as read on mount
  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read && m.sender_id !== myId) {
        markRead(m.internal_id);
      }
    });
  }, [messages, myId, markRead]);

  // Set title from first message subject or recipient name
  useEffect(() => {
    if (messages.length > 0) {
      const firstMsg = messages[0];
      const other = firstMsg.sender_id === myId ? firstMsg.recipient : firstMsg.sender;
      const title = subject ?? (other ? `${other.firstName} ${other.lastName}` : 'Message');
      navigation.setOptions({ title });
    }
  }, [messages, myId, navigation, subject]);

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || !recipientId) return;
    setBody('');
    await sendMessage({
      recipient_id: recipientId,
      subject,
      body: trimmed,
      thread_id: threadId,
    });
    refetch();
  }, [body, recipientId, sendMessage, subject, threadId, refetch]);

  if (isLoading) return <Spinner fullScreen />;

  // Show oldest first (ascending)
  const sorted = [...messages].sort((a, b) =>
    new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={sorted}
          keyExtractor={(item) => item.internal_id}
          renderItem={({ item }) => (
            <MessageBubble message={item} isMe={item.sender_id === myId} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Reply bar */}
        <View style={styles.replyBar}>
          <TextInput
            style={styles.input}
            value={body}
            onChangeText={setBody}
            placeholder="Message..."
            placeholderTextColor={Colors.grey}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Send size={18} color="#FFFFFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.cream },
  flex:    { flex: 1 },
  list:    { paddingHorizontal: 12, paddingVertical: 12 },
  bubble:  { flexDirection: 'row', marginBottom: 12, gap: 8 },
  bubbleMe:   { flexDirection: 'row-reverse' },
  bubbleThem: {},
  bubbleBody: { flex: 1 },
  bubbleContent: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%',
  },
  bubbleContentMe:   { backgroundColor: Colors.brg, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleContentThem: { backgroundColor: '#FFFFFF', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText:     { fontSize: 15, color: Colors.fg, lineHeight: 21 },
  bubbleTextMe:   { color: '#FFFFFF' },
  bubbleTime:     { fontSize: 11, color: Colors.grey, marginTop: 3, paddingHorizontal: 4 },
  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: Colors.border,
  },
  input: {
    flex: 1, maxHeight: 100,
    backgroundColor: Colors.cream, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.fg,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.brg,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
