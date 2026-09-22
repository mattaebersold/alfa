import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Keyboard, Platform, Alert,
} from 'react-native';
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
import ListingSnapshot from '../../components/marketplace/ListingSnapshot';
import ThreadBubble from '../../components/messages/ThreadBubble';
import Composer from '../../components/social/Composer';
import { useComposerPhotos, appendPhotosTo } from '../../hooks/useComposerPhotos';
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import type { AppScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

/** How many messages a page holds, and how many more "earlier" adds. */
const PAGE_SIZE = 30;

/**
 * One photo, because the reply route is `upload.single('gallery')` — a second
 * file would come back as an unexpected field, not a second picture.
 */
const MAX_PHOTOS = 1;

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
  const photos = useComposerPhotos(MAX_PHOTOS);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const listRef = useRef<FlatList>(null);

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

  // The keyboard (raised by the composer's panel, over this sheet) shrinks the
  // list without changing its content, so nothing scrolls the newest message
  // back into view on its own — follow it down, so the thread is on its newest
  // message when the panel folds away.
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
    return () => sub.remove();
  }, []);

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

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    const sentPhotos = photos.photos;
    if ((!trimmed && sentPhotos.length === 0) || busy) return false;
    setBody('');
    photos.clear();

    try {
      if (threadId) {
        // Multipart only when there's a file: a plain reply is the normal case
        // and shouldn't pay for a form encoding.
        let data: { body: string } | FormData = { body: trimmed };
        if (sentPhotos.length > 0) {
          const fd = new FormData();
          fd.append('body', trimmed);
          appendPhotosTo(fd, sentPhotos);
          data = fd;
        }
        await sendMessage({ threadId, data }).unwrap();
      } else if (listingId) {
        let payload: { listing_id: string; body: string } | FormData = {
          listing_id: listingId,
          body: trimmed,
        };
        if (sentPhotos.length > 0) {
          const fd = new FormData();
          fd.append('listing_id', listingId);
          fd.append('body', trimmed);
          appendPhotosTo(fd, sentPhotos);
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
      photos.restore(sentPhotos);
      Alert.alert('Not sent', err?.data?.error || "That message couldn't be sent.");
      return false;
    }
  }, [body, photos, busy, threadId, listingId, sendMessage, startThread]);

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
              <ThreadBubble
                body={item.body}
                gallery={item.gallery}
                createdAt={item.created_at}
                isMe={item.sender_id === myId}
                sender={otherUser}
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

          {/* Tapped, the composer opens over the sheet on the keyboard — see
              Composer — so nothing here has to be lifted clear of it. */}
          <Composer
            value={body}
            onChangeText={setBody}
            placeholder={threadId ? 'Message...' : 'Ask about this listing...'}
            title={otherUser?.username ? `Message @${otherUser.username}` : 'About this listing'}
            photos={photos}
            onSend={handleSend}
            sending={busy}
            sendLabel="Send"
            sendIcon
            maxLength={2000}
            tone={{ surface: colors.card, field: colors.cream, border: colors.border, text: colors.fg, accent: colors.primaryAlt }}
            barStyle={[styles.composer, { borderTopColor: colors.border }]}
          />
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

  earlier:     { alignItems: 'center', paddingVertical: 10 },
  earlierText: { fontSize: 13, fontWeight: '700' },
  intro:       { paddingHorizontal: 24, paddingTop: 24 },
  introText:   { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  composer: { borderTopWidth: 1 },
});
