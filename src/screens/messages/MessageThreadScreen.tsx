import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react-native';
import {
  useGetMessageThreadQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useGetUserByIdQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppScreenProps } from '../../navigation/types';
import type { Message, User } from '../../types/api';
import { ss } from '../../styles/shared';

function MessageBubble({ message, isMe, otherUser }: { message: Message; isMe: boolean; otherUser?: User }) {
  const colors = useColors();
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  const sender = message.sender ?? otherUser;

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && (
        <Avatar
          filename={sender?.gallery?.[0]?.filename}
          name={sender?.username ?? '?'}
          size={28}
        />
      )}
      <View style={styles.bubbleBody}>
        <View style={[
          styles.bubbleContent,
          isMe
            ? styles.bubbleContentMe
            : { backgroundColor: colors.card, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
        ]}>
          <Text style={[styles.bubbleText, { color: colors.fg }, isMe && styles.bubbleTextMe]}>
            {message.body}
          </Text>
        </View>
        <Text style={[styles.bubbleTime, { color: colors.grey }, isMe && { textAlign: 'right' }]}>
          {timeAgo}
        </Text>
      </View>
    </View>
  );
}

export default function MessageThreadScreen({ route, navigation }: AppScreenProps<'MessageThread'>) {
  const { threadId, recipientId: routeRecipientId, subject } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
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

  // Derive the other participant's ID from messages if not provided in route
  const recipientId = routeRecipientId ?? messages.find((m) => m.sender_id !== myId)?.sender_id;

  // Fetch other user's profile to get their avatar (thread messages may not populate sender.gallery)
  const populatedSender = messages.find((m) => m.sender_id !== myId)?.sender;
  const { data: fetchedOtherUser } = useGetUserByIdQuery(recipientId ?? '', {
    skip: !recipientId || !!populatedSender?.gallery?.length,
  });
  const otherUser = populatedSender ?? fetchedOtherUser;

  // Set title from first message subject or sender name
  useEffect(() => {
    if (messages.length > 0) {
      const firstMsg = messages[0];
      const other = firstMsg.sender_id === myId ? firstMsg.recipient : firstMsg.sender;
      const title = subject ?? (other ? `@${other.username}` : 'Message');
      navigation.setOptions({ title });
    }
  }, [messages, myId, navigation, subject]);

  // Sort oldest first for display
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );

  // The first message's internal_id is used as parent_message_id to link replies to the thread
  const parentMessageId = sorted[0]?.internal_id ?? threadId;

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || !recipientId) return;
    setBody('');
    try {
      await sendMessage({
        recipient_id: recipientId,
        subject,
        body: trimmed,
        parent_message_id: parentMessageId,
      }).unwrap();
      refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    } catch {
      setBody(trimmed); // restore on failure
    }
  }, [body, recipientId, sendMessage, subject, parentMessageId, refetch]);

  if (isLoading) return <Spinner fullScreen />;

  // keyboardVerticalOffset = nav header (44) + status bar (insets.top)
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + 44 : 0;

  return (
    <KeyboardAvoidingView
      style={[ss.fill, { backgroundColor: colors.cream }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <MessageBubble message={item} isMe={item.sender_id === myId} otherUser={otherUser} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Reply bar */}
      <View style={[
        styles.replyBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}>
        <TextInput
          style={[ss.chatInput, { backgroundColor: colors.cream, borderColor: colors.border, color: colors.fg, flex: 1 }]}
          value={body}
          onChangeText={setBody}
          placeholder="Message..."
          placeholderTextColor={colors.grey}
          multiline
          maxLength={2000}
          onSubmitEditing={handleSend}
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
  );
}

const styles = StyleSheet.create({
  list:    { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  bubble:  { flexDirection: 'row', marginBottom: 12, gap: 8 },
  bubbleMe:   { flexDirection: 'row-reverse' },
  bubbleThem: {},
  bubbleBody: { flex: 1 },
  bubbleContent: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%',
  },
  bubbleContentMe:  { backgroundColor: colors.primaryAlt, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText:       { fontSize: 15, lineHeight: 21 },
  bubbleTextMe:     { color: '#FFFFFF' },
  bubbleTime:       { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
  replyBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
