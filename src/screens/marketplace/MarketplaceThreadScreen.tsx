import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Keyboard, Platform, Animated, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { formatDistanceToNow } from 'date-fns';
import { Send, ImagePlus, X } from 'lucide-react-native';
import {
  useGetMarketplaceThreadQuery,
  useGetMarketplaceThreadsQuery,
  useGetListingQuery,
  useSendMarketplaceMessageMutation,
  useStartMarketplaceThreadMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import SharedModal from '../../components/ui/SharedModal';
import ListingSnapshot, { listingThumb } from '../../components/marketplace/ListingSnapshot';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import { useKeyboardOverlap } from '../../hooks/useKeyboardHeight';
import { toUploadableJpeg, uploadFile } from '../../utils/upload';
import type { AppScreenProps } from '../../navigation/types';
import type { MarketplaceMessage, User } from '../../types/api';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS } from '../../constants/radius';

/** How many messages a page holds, and how many more "earlier" adds. */
const PAGE_SIZE = 30;

function MessageBubble({ message, isMe, otherUser, showTime }: {
  message: MarketplaceMessage;
  isMe: boolean;
  otherUser?: User;
  /** Only the newest message from each side is stamped — see `stampedIds`. */
  showTime: boolean;
}) {
  const colors = useColors();
  const photo = listingThumb(message.gallery);
  const timeAgo = message.created_at
    ? formatDistanceToNow(new Date(message.created_at), { addSuffix: true })
    : '';

  return (
    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
      {!isMe && <Avatar user={otherUser} size={28} />}
      <View style={styles.bubbleBody}>
        {/* The photo sits above the words in its own rounded block rather than
            inside the bubble: "is this the wheel you mean?" is usually a
            picture with a line under it, and a picture boxed in a chat bubble's
            padding reads as an attachment to something. */}
        {photo && (
          <Image
            source={{ uri: photo }}
            style={[styles.photo, isMe ? styles.photoMe : styles.photoThem]}
            contentFit="cover"
          />
        )}
        {!!message.body && (
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
        )}
        {showTime && timeAgo ? (
          <Text style={[styles.bubbleTime, { color: colors.grey }, isMe && { textAlign: 'right' }]}>
            {timeAgo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * One marketplace conversation.
 *
 * Two ways in, and they share everything but their first second:
 *
 *  - with a `threadId`, from the conversation list or a listing's own row;
 *  - with a `listingId` alone, from "get in touch" on a listing — see
 *    useStartListingThread. Nothing has been created yet at that point, so the
 *    screen opens on the listing and an empty composer, and the first send is
 *    what makes the thread. The server returns the existing conversation if
 *    there already is one, so pressing the button twice can't open a second.
 *
 * The lookup below is the polish on that: a buyer who has asked before should
 * see what they said, not a blank sheet, so the screen asks for their thread on
 * this listing while they're reading the composer.
 */
export default function MarketplaceThreadScreen({ route, navigation }: AppScreenProps<'MarketplaceThread'>) {
  const params = route.params;
  const listingId = params.listingId;
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  /**
   * The conversation being read. Starts as whatever the route was given and is
   * filled in when a new one is created, so the screen doesn't have to be
   * replaced when the first message lands.
   */
  const [threadId, setThreadId] = useState<string | undefined>(params.threadId);
  const [body, setBody] = useState(params.initialBody ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const listRef = useRef<FlatList>(null);

  // Composer clearance — measured against the keyboard rather than calculated.
  // See useKeyboardOverlap for why the arithmetic can't be trusted on Android.
  const composerRef = useRef<View>(null);
  const { lift, animated: composerLift, onLayout: onComposerLayout } = useKeyboardOverlap(composerRef);

  /**
   * Is there already a conversation about this listing?
   *
   * Asked as the buyer, because that is the only side that can start one — a
   * seller reaches a conversation from their own list, with its id in hand.
   */
  const { data: existing, isLoading: lookingUp } = useGetMarketplaceThreadsQuery(
    { listing_id: listingId, role: 'as_buyer', limit: 1 },
    { skip: !!threadId || !listingId },
  );
  useEffect(() => {
    const found = existing?.entries?.[0];
    if (!threadId && found) setThreadId(found.internal_id);
  }, [existing, threadId]);

  // An open conversation polls, the way the inbox's thread does: a reply should
  // land without reopening the screen.
  const appActive = useIsAppActive();
  const { data, isLoading, refetch } = useGetMarketplaceThreadQuery(
    { threadId: threadId ?? '', limit },
    {
      skip: !threadId,
      pollingInterval: appActive ? CONFIG.THREAD_POLL_INTERVAL : 0,
    },
  );

  // The listing's own record, only while there's no thread to snapshot it from.
  const { data: listingData } = useGetListingQuery(listingId ?? '', {
    skip: !!threadId || !listingId,
  });

  const [sendMessage, { isLoading: sending }] = useSendMarketplaceMessageMutation();
  const [startThread, { isLoading: starting }] = useStartMarketplaceThreadMutation();
  const busy = sending || starting;

  const thread = data?.thread;
  const messages = data?.entries ?? [];
  const otherUser = thread?.other_user ?? undefined;

  // Coming back from the background, catch up rather than waiting out a poll.
  // The ref keeps this off the first mount, where it would duplicate the
  // query's own fetch.
  const wasActive = useRef(appActive);
  useEffect(() => {
    if (appActive && !wasActive.current && threadId) refetch();
    wasActive.current = appActive;
  }, [appActive, refetch, threadId]);

  // The keyboard shrinks the list without changing its content, so nothing
  // scrolls the newest message back into view on its own — follow it down.
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (lift > 0) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [lift]);

  // Sheet owns its visibility so it animates out before the route unmounts.
  const [visible, setVisible] = useState(true);
  const pendingNav = useRef<(() => void) | null>(null);
  const handleDismissed = () => {
    const go = pendingNav.current;
    pendingNav.current = null;
    navigation.goBack();
    go?.();
  };

  /**
   * What the conversation is about, in the header.
   *
   * Preferring the thread's snapshot over the live listing is deliberate: the
   * snapshot is what the conversation is *about*, and it still says so after
   * the listing has been taken down.
   */
  const snapshot = thread?.listing;
  const listing = listingData?.entry;
  const headerContent = (
    <View style={styles.header}>
      <ListingSnapshot
        title={snapshot?.title ?? listing?.title ?? params.listingTitle ?? 'Listing'}
        photo={snapshot?.photo ?? listing?.gallery?.[0]}
        price={snapshot?.price ?? listing?.price}
        priceMode={snapshot?.price_mode ?? listing?.price_mode}
        currency={snapshot?.currency}
        sold={snapshot?.sold ?? listing?.sold}
        deleted={snapshot?.deleted}
        size={34}
        // Back to the listing itself — the question being asked is usually
        // about a detail that's on it. Closes first, as the profile link does:
        // iOS won't present over a modal that is still up. A deleted listing
        // isn't offered, which ListingSnapshot handles on its own.
        onPress={listingId ? () => {
          pendingNav.current = () => (navigation as any).navigate('ListingDetailModal', { listingId });
          setVisible(false);
        } : undefined}
      />
      {otherUser?.username ? (
        <TouchableOpacity
          style={styles.headerPerson}
          activeOpacity={0.7}
          onPress={() => {
            // Close first: pushing while the RN Modal is up would render the
            // profile behind it.
            pendingNav.current = () => (navigation as any).navigate('UserDetail', {
              userId: otherUser.user_id,
              username: otherUser.username,
            });
            setVisible(false);
          }}
        >
          <Avatar user={otherUser} size={20} />
          <Text style={styles.headerPersonText} numberOfLines={1}>@{otherUser.username}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // Only the newest message from each side carries a timestamp — a column of
  // "about 15 hours ago" says less than these two do.
  const stampedIds = new Set<string>();
  let haveMine = false;
  let haveTheirs = false;
  for (let i = messages.length - 1; i >= 0 && !(haveMine && haveTheirs); i--) {
    const mine = messages[i].sender_id === myId;
    if (mine && !haveMine) { stampedIds.add(messages[i].internal_id); haveMine = true; }
    if (!mine && !haveTheirs) { stampedIds.add(messages[i].internal_id); haveTheirs = true; }
  }

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    // iOS hands back HEIC, which the server's image pipeline can't decode.
    setPhoto(await toUploadableJpeg(result.assets[0].uri));
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if ((!trimmed && !photo) || busy) return;
    const sentPhoto = photo;
    setBody('');
    setPhoto(null);

    try {
      if (threadId) {
        // Multipart only when there's a file: a plain reply is the normal case
        // and shouldn't pay for a form encoding.
        let data: { body: string } | FormData = { body: trimmed };
        if (sentPhoto) {
          const fd = new FormData();
          fd.append('body', trimmed);
          fd.append('gallery', uploadFile(sentPhoto));
          data = fd;
        }
        await sendMessage({ threadId, data }).unwrap();
      } else if (listingId) {
        let payload: { listing_id: string; body: string } | FormData = {
          listing_id: listingId,
          body: trimmed,
        };
        if (sentPhoto) {
          const fd = new FormData();
          fd.append('listing_id', listingId);
          fd.append('body', trimmed);
          fd.append('gallery', uploadFile(sentPhoto));
          payload = fd;
        }
        const created = await startThread(payload).unwrap();
        // From here on this is an ordinary conversation — the same screen,
        // now with a thread behind it.
        setThreadId(created.thread.internal_id);
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err: any) {
      // Give the message back rather than losing what they typed.
      setBody(trimmed);
      setPhoto(sentPhoto);
      Alert.alert('Not sent', err?.data?.error || "That message couldn't be sent.");
    }
  }, [body, photo, busy, threadId, listingId, sendMessage, startThread]);

  const canSend = (!!body.trim() || !!photo) && !busy;
  const loading = (threadId && isLoading) || (!threadId && lookingUp);

  return (
    <SharedModal
      visible={visible}
      onClose={() => setVisible(false)}
      onDismissed={handleDismissed}
      titleContent={headerContent}
      fullHeight
    >
      {loading ? <Spinner /> : (
        <View style={ss.fill}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.internal_id}
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
            // Paging is "show me more of the newest page" rather than a cursor:
            // the conversation polls, and a merged older page would fight every
            // poll for what the list is supposed to contain.
            ListHeaderComponent={
              data?.has_more ? (
                <TouchableOpacity
                  style={styles.earlier}
                  onPress={() => setLimit((n) => n + PAGE_SIZE)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.earlierText, { color: colors.primaryAlt }]}>
                    Load earlier messages
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.intro}>
                <Text style={[styles.introText, { color: colors.grey }]}>
                  {thread?.role === 'seller'
                    ? 'Nothing here yet.'
                    : 'Ask about this listing — is it still available, will they ship, can you see more photos?'}
                </Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />

          {/* The composer lifts by a margin rather than a transform, so the
              list above it shrinks and the newest message stays visible — a
              transform would slide the bar over the message being replied to. */}
          <Animated.View
            ref={composerRef}
            onLayout={onComposerLayout}
            style={[
              styles.composer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                marginBottom: composerLift,
              },
            ]}
          >
            {photo && (
              <View style={styles.attachRow}>
                <Image source={{ uri: photo }} style={styles.attachThumb} contentFit="cover" />
                <TouchableOpacity
                  style={[styles.attachRemove, { backgroundColor: colors.cream }]}
                  onPress={() => setPhoto(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                >
                  <X size={12} color={colors.fg} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.composerRow}>
              <TouchableOpacity
                style={[styles.attachBtn, { borderColor: colors.borderDark }]}
                onPress={pickPhoto}
                accessibilityRole="button"
                accessibilityLabel="Attach a photo"
              >
                <ImagePlus size={18} color={colors.grey} />
              </TouchableOpacity>
              <TextInput
                style={[ss.chatInput, {
                  backgroundColor: colors.cream, borderColor: colors.border, color: colors.fg, flex: 1,
                }]}
                value={body}
                onChangeText={setBody}
                placeholder={threadId ? 'Message...' : 'Ask about this listing...'}
                placeholderTextColor={colors.grey}
                multiline
                maxLength={2000}
                // A message is prose — stated outright, since `spellCheck` only
                // inherits from `autoCorrect` when neither is given.
                autoCorrect
                spellCheck
                autoCapitalize="sentences"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
              >
                {busy
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Send size={18} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },

  header:           { gap: 6, flex: 1 },
  headerPerson:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerPersonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', maxWidth: 180 },

  bubble:     { flexDirection: 'row', marginBottom: 12, gap: 8 },
  bubbleMe:   { flexDirection: 'row-reverse' },
  bubbleThem: {},
  bubbleBody: { flex: 1 },
  bubbleContent: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%',
  },
  bubbleContentMe: { backgroundColor: colors.primaryAlt, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleText:      { fontSize: 15, lineHeight: 21 },
  bubbleTextMe:    { color: '#FFFFFF' },
  bubbleTime:      { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
  photo:      { width: 200, height: 200, borderRadius: COMMON_RADIUS, marginBottom: 4 },
  photoMe:    { alignSelf: 'flex-end' },
  photoThem:  { alignSelf: 'flex-start' },

  earlier:     { alignItems: 'center', paddingVertical: 10 },
  earlierText: { fontSize: 13, fontWeight: '700' },
  intro:       { paddingHorizontal: 24, paddingTop: 24 },
  introText:   { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  composer: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
    borderTopWidth: 1, gap: 8,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachRow:   { width: 64 },
  attachThumb: { width: 64, height: 64, borderRadius: COMMON_RADIUS },
  attachRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS,
    backgroundColor: colors.primaryAlt,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
