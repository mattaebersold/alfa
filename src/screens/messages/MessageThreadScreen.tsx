import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, Platform,
} from 'react-native';
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
import SharedModal from '../../components/ui/SharedModal';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import type { AppScreenProps } from '../../navigation/types';
import type { Message, User } from '../../types/api';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

function MessageBubble({ message, isMe, otherUser, showTime }: {
  message: Message;
  isMe: boolean;
  otherUser?: User;
  /** Only the newest message from each side is stamped — see `stampedIds`. */
  showTime: boolean;
}) {
  const colors = useColors();
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  const sender = message.sender ?? otherUser;

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && (
        <Avatar
          user={sender}
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
        {showTime && timeAgo ? (
          <Text style={[styles.bubbleTime, { color: colors.grey }, isMe && { textAlign: 'right' }]}>
            {timeAgo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function MessageThreadScreen({ route, navigation }: AppScreenProps<'MessageThread'>) {
  const { threadId, recipientId: routeRecipientId, subject } = route.params;
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const [body, setBody] = useState('');
  const listRef = useRef<FlatList>(null);

  // An open thread polls so replies land without reopening the app. A push
  // arriving invalidates the cache too (see RootNavigator), which is the fast
  // path — this is the fallback for when notifications are declined or dropped.
  const appActive = useIsAppActive();
  const { data: messages = [], isLoading, refetch } = useGetMessageThreadQuery(threadId, {
    pollingInterval: appActive ? CONFIG.THREAD_POLL_INTERVAL : 0,
  });
  const refreshControl = useRefreshControl(refetch);
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [markRead] = useMarkMessageReadMutation();

  // Coming back from the background, catch up immediately rather than waiting
  // out a poll interval. The ref keeps this from firing on the initial mount,
  // where it would only duplicate the query's own first fetch.
  const wasActive = useRef(appActive);
  useEffect(() => {
    if (appActive && !wasActive.current) refetch();
    wasActive.current = appActive;
  }, [appActive, refetch]);

  // Mark unread messages as read on mount
  useEffect(() => {
    messages.forEach((m) => {
      if (!m.read && m.sender_id !== myId) {
        markRead(m.internal_id);
      }
    });
  }, [messages, myId, markRead]);

  // The keyboard shrinks the list without changing its content, so neither
  // onContentSizeChange nor a plain re-render brings the newest message back
  // into view — the offset is preserved and the last bubble ends up hidden
  // behind the reply bar. Follow the keyboard down to the bottom instead.
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      // One frame after the resize lands, or scrollToEnd targets the old height.
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);

  // Derive the other participant's ID from messages if not provided in route
  const recipientId = routeRecipientId ?? messages.find((m) => m.sender_id !== myId)?.sender_id;

  // Fetch other user's profile to get their avatar (thread messages may not populate sender.gallery)
  const populatedSender = messages.find((m) => m.sender_id !== myId)?.sender;
  const { data: fetchedOtherUser } = useGetUserByIdQuery(recipientId ?? '', {
    skip: !recipientId || !!populatedSender?.gallery?.length,
  });
  const otherUser = populatedSender ?? fetchedOtherUser;

  // Sheet owns its visibility so it can animate out before the route unmounts.
  const [visible, setVisible] = useState(true);
  const pendingNav = useRef<(() => void) | null>(null);

  const handleDismissed = () => {
    const go = pendingNav.current;
    pendingNav.current = null;
    navigation.goBack();
    go?.();
  };

  // Header shows who you're talking to — their avatar and handle — rather than
  // the thread's subject line.
  const headerContent = (
    <TouchableOpacity
      style={styles.headerTitleRow}
      activeOpacity={otherUser?.user_id ? 0.7 : 1}
      disabled={!otherUser?.user_id}
      onPress={() => {
        // Close first: pushing while the RN Modal is mounted would render the
        // profile behind it.
        pendingNav.current = () =>
          (navigation as any).navigate('UserDetail', {
            userId: otherUser!.user_id,
            username: otherUser!.username,
          });
        setVisible(false);
      }}
    >
      <Avatar
        user={otherUser}
        size={30}
      />
      {otherUser?.username ? (
        <Text style={styles.headerTitleText} numberOfLines={1}>@{otherUser.username}</Text>
      ) : null}
    </TouchableOpacity>
  );

  // Sort oldest first for display
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );

  // Only the newest message from each side carries a timestamp. Stamping every
  // bubble turns a quick back-and-forth into a column of "about 15 hours ago";
  // these two are the ones that answer when each of you last wrote.
  const stampedIds = new Set<string>();
  let haveMine = false;
  let haveTheirs = false;
  for (let i = sorted.length - 1; i >= 0 && !(haveMine && haveTheirs); i--) {
    const mine = sorted[i].sender_id === myId;
    if (mine && !haveMine) { stampedIds.add(sorted[i].internal_id); haveMine = true; }
    if (!mine && !haveTheirs) { stampedIds.add(sorted[i].internal_id); haveTheirs = true; }
  }

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

  return (
    <SharedModal
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={handleDismissed}
      titleContent={headerContent}
      fullHeight
    >
      {isLoading ? <Spinner /> : (
      <View style={ss.fill}>
      <FlatList
        refreshControl={refreshControl}
        ref={listRef}
        data={sorted}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isMe={item.sender_id === myId}
            otherUser={otherUser}
            showTime={stampedIds.has(item.internal_id)}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        // A thread opens on its newest message, and stays there as messages
        // arrive or the keyboard resizes the list out from under it.
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      />

      {/* Reply bar. Clearance for the home indicator / gesture bar is the
          sheet's own bottom padding, which collapses when the keyboard is up —
          adding the safe-area inset here too would double it. */}
      <View style={[
        styles.replyBar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
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
          // A message is prose — stated explicitly, since `spellCheck` only
          // inherits from `autoCorrect` when neither is given.
          autoCorrect
          spellCheck
          autoCapitalize="sentences"

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
      </View>
      )}
    </SharedModal>
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
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: 1,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },

  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', maxWidth: 180 },
});
