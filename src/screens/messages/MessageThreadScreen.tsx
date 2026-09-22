import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Keyboard, Platform,
} from 'react-native';
import {
  useGetMessageThreadQuery,
  useSendMessageMutation,
  useMarkMessageReadMutation,
  useGetUserByIdQuery,
  type SendMessageArgs,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import SharedModal from '../../components/ui/SharedModal';
import ThreadBubble from '../../components/messages/ThreadBubble';
import Composer from '../../components/social/Composer';
import { useComposerPhotos, appendPhotosTo } from '../../hooks/useComposerPhotos';
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

/** The server's ceiling for photos on one message — see uploadMessageGallery. */
const MAX_PHOTOS = 4;

export default function MessageThreadScreen({ route, navigation }: AppScreenProps<'MessageThread'>) {
  const { threadId, recipientId: routeRecipientId, subject } = route.params;
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const [body, setBody] = useState('');
  const photos = useComposerPhotos(MAX_PHOTOS);
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

  // The keyboard (raised by the composer's panel, over this sheet) shrinks the
  // sheet without changing the list's content, so neither onContentSizeChange
  // nor a plain re-render brings the newest message back into view — the
  // offset is preserved and the last bubble ends up hidden. Follow the
  // keyboard down to the bottom instead, so the thread is on its newest
  // message when the panel folds away.
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
    const sentPhotos = photos.photos;
    if ((!trimmed && sentPhotos.length === 0) || !recipientId) return false;
    setBody('');
    photos.clear();
    try {
      const fields: SendMessageArgs = {
        recipient_id: recipientId,
        // The route param is optional — a thread reached from anywhere but the
        // inbox list arrives without it — so fall back to the thread's own
        // first message, which is where the subject lives. The server derives
        // it from the parent too; this just stops us sending nothing.
        subject: subject ?? sorted[0]?.subject ?? '',
        body: trimmed,
        parent_message_id: parentMessageId,
      };
      // Multipart only when there's a file — see sendMessage.
      let payload: SendMessageArgs | FormData = fields;
      if (sentPhotos.length > 0) {
        const fd = new FormData();
        (Object.keys(fields) as (keyof SendMessageArgs)[]).forEach((key) => {
          const v = fields[key];
          if (v != null) fd.append(key, v);
        });
        appendPhotosTo(fd, sentPhotos);
        payload = fd;
      }
      await sendMessage(payload).unwrap();
      refetch();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    } catch {
      // Give the message back rather than losing what they typed.
      setBody(trimmed);
      photos.restore(sentPhotos);
      return false;
    }
  }, [body, photos, recipientId, sendMessage, subject, sorted, parentMessageId, refetch]);

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
          <ThreadBubble
            body={item.body}
            gallery={item.gallery}
            createdAt={item.created_at}
            isMe={item.sender_id === myId}
            sender={item.sender ?? otherUser}
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
          sheet's own bottom padding, so none is added here. Tapped, it opens
          over the sheet on the keyboard — see Composer — so nothing here has
          to be lifted clear of it any more. */}
      <Composer
        value={body}
        onChangeText={setBody}
        placeholder="Message..."
        title={otherUser?.username ? `Message @${otherUser.username}` : 'Message'}
        photos={photos}
        onSend={handleSend}
        sending={sending}
        sendLabel="Send"
        sendIcon
        maxLength={2000}
        tone={{ surface: colors.card, field: colors.cream, border: colors.border, text: colors.fg, accent: colors.primaryAlt }}
        barStyle={[styles.replyBar, { borderTopColor: colors.border }]}
      />
      </View>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  list:     { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  replyBar: { borderTopWidth: 1 },

  headerTitleRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', maxWidth: 180 },
});
