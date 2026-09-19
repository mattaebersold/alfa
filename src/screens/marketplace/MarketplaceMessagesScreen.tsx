import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical } from 'lucide-react-native';
import {
  useGetMarketplaceThreadsQuery,
  useLeaveMarketplaceThreadMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ListingSnapshot from '../../components/marketplace/ListingSnapshot';
import { CONFIG } from '../../constants/config';
import { useColors } from '../../hooks/useColors';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import type { AppScreenProps, AppStackParamList } from '../../navigation/types';
import type { MarketplaceRoleFilter, MarketplaceThread } from '../../types/api';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/** 'all' isn't a server value — it's the absence of the `role` param. */
type Filter = 'all' | MarketplaceRoleFilter;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'as_seller', label: 'Selling' },
  { key: 'as_buyer',  label: 'Buying' },
];

/**
 * One conversation.
 *
 * Built around the *listing* rather than around the person, which is the whole
 * difference between this list and the inbox: the same two members can have
 * three conversations going about three different parts, and each one is its
 * own row here. The other person is named underneath the thing being discussed,
 * not the other way round.
 */
function ThreadRow({
  thread,
  myUserId,
  onPress,
  onLeave,
}: {
  thread: MarketplaceThread;
  myUserId: string;
  onPress: () => void;
  onLeave: () => void;
}) {
  const colors = useColors();
  const other = thread.other_user ?? undefined;
  const name = other?.username || 'Member';
  const unread = thread.unread_count > 0;
  const lastIsMine = thread.last_message_sender_id === myUserId;

  const timeAgo = thread.last_message_at
    ? formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })
    : '';

  // Two steps, as the inbox does it: the menu names what you're acting on, and
  // the confirm covers the fact that leaving hides the whole conversation.
  const openMenu = () => {
    Alert.alert(thread.listing.title || 'Conversation', `with @${name}`, [
      {
        text: 'Leave conversation',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Leave this conversation?',
          'It disappears from your list. They keep their copy, and a new message brings it back.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Leave', style: 'destructive', onPress: onLeave },
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
      {/* Full-height stripe rather than a dot beside the text: it reads down a
          list of cards without having to know how tall each one grew. */}
      {unread && <View style={[styles.unreadBar, { backgroundColor: colors.primaryAlt }]} />}

      <ListingSnapshot
        title={thread.listing.title}
        photo={thread.listing.photo}
        price={thread.listing.price}
        priceMode={thread.listing.price_mode}
        currency={thread.listing.currency}
        sold={thread.listing.sold}
        deleted={thread.listing.deleted}
        size={52}
        style={styles.snapshot}
      />

      <View style={styles.personRow}>
        <Avatar user={other} size={22} />
        <Text style={[styles.person, { color: colors.grey }]} numberOfLines={1}>
          @{name}
          {/* Which side you're on, said once. A seller with eight buyers needs
              no reminder, but a mixed list is unreadable without it. */}
          <Text style={styles.role}>
            {thread.role === 'seller' ? '  ·  selling' : '  ·  buying'}
          </Text>
        </Text>
        <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
        <TouchableOpacity
          onPress={openMenu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Options for the conversation with ${name}`}
        >
          <MoreVertical size={16} color={colors.grey} />
        </TouchableOpacity>
      </View>

      <View style={styles.previewRow}>
        <Text
          style={[
            styles.preview,
            { color: unread && !lastIsMine ? colors.fg : colors.grey },
            unread && !lastIsMine && styles.previewBold,
          ]}
          numberOfLines={1}
        >
          {lastIsMine ? `You: ${thread.last_message_preview}` : thread.last_message_preview}
        </Text>
        {unread && (
          <View style={[styles.unreadPill, { backgroundColor: colors.red }]}>
            <Text style={styles.unreadPillText}>{thread.unread_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Marketplace conversations.
 *
 * Its own screen, reachable from the marketplace and the dashboard only. A
 * message about a listing is never in Messages and never on that badge — see
 * the note on the endpoints in apiService, and horacio's MarketplaceThread.
 *
 * Two filters, because a marketplace has two halves and they answer different
 * questions: `role` splits "things I'm selling" from "things I'm buying", and
 * `listingId` (set when the screen is opened from a listing's own row) narrows
 * it to "who's interested in this one".
 */
export default function MarketplaceMessagesScreen({ route }: AppScreenProps<'MarketplaceMessages'>) {
  const { listingId, listingTitle, role: initialRole } = route.params ?? {};
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const myId = userInfo?.user_id ?? '';

  const [filter, setFilter] = useState<Filter>(initialRole ?? 'all');

  // Refreshes on its own so a new enquiry appears without reopening the app —
  // the inbox's interval rather than a thread's, since this only has to be
  // roughly current.
  const appActive = useIsAppActive();
  const { data, isLoading, refetch } = useGetMarketplaceThreadsQuery(
    {
      role: filter === 'all' ? undefined : filter,
      listing_id: listingId,
      limit: 50,
    },
    { pollingInterval: appActive ? CONFIG.MESSAGE_POLL_INTERVAL : 0 },
  );
  const [leaveThread] = useLeaveMarketplaceThreadMutation();

  // Coming back from a conversation, the read state and the order have both
  // changed — the thread screen's own read receipt invalidates this, and this
  // catches the case where it didn't have to.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const threads = data?.entries ?? [];

  const openThread = useCallback((thread: MarketplaceThread) => {
    navigation.navigate('MarketplaceThread', {
      threadId: thread.internal_id,
      listingId: thread.listing_id,
      listingTitle: thread.listing.title,
    });
  }, [navigation]);

  const handleLeave = useCallback(async (thread: MarketplaceThread) => {
    try {
      await leaveThread(thread.internal_id).unwrap();
    } catch {
      Alert.alert('Error', "That conversation couldn't be left. Please try again.");
    }
  }, [leaveThread]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* When the screen was opened from one listing, say so — otherwise a
          short list looks like an empty marketplace rather than a filter. */}
      {listingId && (
        <View style={[styles.scopeBar, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
          <Text style={[styles.scopeLabel, { color: colors.grey }]}>Interested in</Text>
          <Text style={[styles.scopeTitle, { color: colors.fg }]} numberOfLines={1}>
            {listingTitle || 'this listing'}
          </Text>
        </View>
      )}

      {/* The role filter is pointless inside one listing: every conversation
          about your own listing is one you're selling. */}
      {!listingId && (
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filter,
                  { borderColor: colors.borderDark },
                  active && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
                ]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, { color: active ? '#FFFFFF' : colors.grey }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <FlatList
        data={threads}
        keyExtractor={(t) => t.internal_id}
        renderItem={({ item }) => (
          <ThreadRow
            thread={item}
            myUserId={myId}
            onPress={() => openThread(item)}
            onLeave={() => handleLeave(item)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title={
              filter === 'as_seller' ? 'No one has asked yet'
                : filter === 'as_buyer' ? "You haven't asked about anything"
                  : 'No marketplace conversations'
            }
          />
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
  list: { flexGrow: 1, paddingTop: 12, paddingBottom: 40 },

  filters: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, paddingTop: 12,
  },
  filter: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '700' },

  scopeBar: {
    marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  scopeLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  scopeTitle: { fontSize: 15, fontWeight: '700', marginTop: 2 },

  // Each conversation is its own card, the way the inbox draws its rows: a
  // hairline divider disappears on this palette.
  row: {
    paddingHorizontal: 14, paddingVertical: 12,
    marginHorizontal: 12, marginBottom: 10,
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  snapshot:   { marginBottom: 8 },
  personRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  person:     { flex: 1, fontSize: 12, fontWeight: '600' },
  role:       { fontWeight: '400' },
  time:       { fontSize: 10, marginLeft: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  preview:    { flex: 1, fontSize: 13 },
  previewBold: { fontWeight: '700' },
  unreadPill: {
    minWidth: 18, height: 18, borderRadius: PILL_RADIUS,
    paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { fontSize: 10.5, fontWeight: '800', color: '#FFFFFF' },
  unreadBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
});
