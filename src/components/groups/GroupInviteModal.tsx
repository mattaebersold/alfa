import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { Search, X, Check, UserPlus, Clock, Ban } from 'lucide-react-native';
import {
  useGetUsersQuery,
  useGetGroupMembersQuery,
  useInviteGroupMemberMutation,
} from '../../api/apiService';
import SharedModal from '../ui/SharedModal';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import type { User } from '../../types/api';

/** Long enough that each keystroke doesn't fire a request, short enough to feel live. */
const DEBOUNCE_MS = 300;
/** Rows per request. `api/users` pages from 0. */
const PAGE_SIZE = 20;
/**
 * Members and already-invited people are filtered out client-side, so a page
 * can arrive and add nothing. Below this many visible rows the list fetches
 * the next page itself rather than waiting for a scroll that can't happen on a
 * list too short to scroll.
 */
const MIN_VISIBLE = 8;
/**
 * How many pages that self-fetch will chase before it gives up and waits for a
 * scroll. Without it, a group holding most of the site would page through all
 * of it looking for a row it can show.
 */
const AUTO_PAGE_LIMIT = 5;

/**
 * Invite anyone on the site to a group.
 *
 * The whole membership can invite, not just admins, so this is the roster's
 * neighbour rather than something behind a settings screen: browse everyone,
 * search when you know who you're after, invite from the row.
 *
 * Only people already *in* the group are filtered out — the roster is where
 * you go to see who's in. Everyone else stays on the list wearing their state:
 *
 *   Pending   — someone already invited them, nobody needs to again
 *   Requested — they asked to join; approve them rather than invite them
 *   Declined  — they were invited and said no, and only they can lift that
 *
 * Hiding the invited ones was worse than it looked. Two admins working the
 * same list at the same time would both see an invitable row and both tap it,
 * and the second got an error for something the screen had told them to do.
 * Showing the state means the answer is on the row before the tap.
 *
 * Anyone invited during this sitting also stays put with their button turned
 * into a receipt: a row that vanishes under the finger reads as a mis-tap.
 */
export default function GroupInviteModal({
  groupId, groupTitle, visible, onClose,
}: {
  groupId: string;
  groupTitle?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  /** Who's been invited in this sitting, so their row can say so. */
  const [invited, setInvited] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  const [inviteMember] = useInviteGroupMemberMutation();
  const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !visible });
  // The same endpoint the Members screen browses and searches with — `q` is
  // just a narrower page, so typing and scrolling are one code path.
  const { data, isFetching } = useGetUsersQuery(
    { page, limit: PAGE_SIZE, q: debounced || undefined },
    { skip: !visible },
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // A new search is a new list, not more of the old one.
  useEffect(() => { setPage(0); setUsers([]); }, [debounced]);

  // Reset on opening rather than on closing — clearing while the sheet is
  // still animating away is visible.
  useEffect(() => {
    if (visible) {
      setQuery(''); setDebounced(''); setPage(0); setUsers([]); setInvited([]);
    }
  }, [visible]);

  useEffect(() => {
    if (!data?.entries) return;
    setUsers((prev) => {
      if (page === 0) return data.entries;
      const seen = new Set(prev.map((u) => u.user_id));
      return [...prev, ...data.entries.filter((u) => !seen.has(u.user_id))];
    });
  }, [data, page]);

  /** user_id → what the group already thinks of them. */
  const existing = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => { if (m.user_id) map.set(m.user_id, m.status ?? 'active'); });
    return map;
  }, [members]);

  const rows = useMemo(() => users.filter((u) => {
    if (u.user_id === userInfo?.user_id) return false;
    if (invited.includes(u.user_id)) return true;
    // Members are the only people with nothing to say here.
    return existing.get(u.user_id) !== 'active';
  }), [users, existing, invited, userInfo?.user_id]);

  const total = data?.total ?? 0;
  const hasMore = users.length < total;

  const loadMore = () => { if (!isFetching && hasMore) setPage((p) => p + 1); };

  // See MIN_VISIBLE — a page of nothing but existing members would otherwise
  // leave the list stuck on an empty screen with more users behind it.
  useEffect(() => {
    if (!isFetching && hasMore && page < AUTO_PAGE_LIMIT && rows.length < MIN_VISIBLE) {
      setPage((p) => p + 1);
    }
  }, [isFetching, hasMore, page, rows.length]);

  const invite = async (user: User) => {
    if (pending) return;
    setPending(user.user_id);
    try {
      await inviteMember({ groupId, userId: user.user_id }).unwrap();
      setInvited((prev) => [...prev, user.user_id]);
    } catch (err: any) {
      Alert.alert(
        "Couldn't invite",
        err?.data?.error ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setPending(null);
    }
  };

  const renderRow = ({ item: user }: { item: User }) => {
    const status = existing.get(user.user_id);
    // Invited in this sitting, or invited by someone else before it — the row
    // reads the same either way, because the answer is the same.
    const done = invited.includes(user.user_id) || status === 'invited';
    // Someone who asked to join is answered by approving the request, not by
    // inviting them to something they're already at the door of.
    const requested = status === 'pending';
    const declined = status === 'declined';
    const busy = pending === user.user_id;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

    const state = done
      ? { label: 'Pending', Icon: Clock }
      : requested
        ? { label: 'Requested', Icon: Check }
        : declined
          ? { label: 'Declined', Icon: Ban }
          : null;

    return (
      <View style={[styles.row, { borderBottomColor: c.borderDark }]}>
        <Avatar user={user} size={38} />
        <View style={styles.rowText}>
          <Text style={[styles.username, { color: c.fg }]} numberOfLines={1}>
            @{user.username}
          </Text>
          {!!name && (
            <Text style={[styles.fullName, { color: c.grey }]} numberOfLines={1}>{name}</Text>
          )}
        </View>

        {state ? (
          <View style={[styles.statusPill, { backgroundColor: c.segment }]}>
            <state.Icon size={12} color={c.grey} strokeWidth={2.6} />
            <Text style={[styles.statusText, { color: c.grey }]}>{state.label}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: c.primaryAlt }, busy && styles.inviteBtnBusy]}
            onPress={() => invite(user)}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Invite @${user.username}`}
          >
            {busy
              ? <ActivityIndicator size="small" color="#000000" />
              : (
                <>
                  <UserPlus size={14} color="#000000" strokeWidth={2.6} />
                  <Text style={styles.inviteText}>Invite</Text>
                </>
              )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      title={groupTitle ? `Invite to ${groupTitle}` : 'Invite Members'}
      heightRatio={0.9}
    >
      {/* Outside the list, so it stays put while the names scroll under it. */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.borderDark }]}>
          <Search size={16} color={c.grey} />
          <TextInput
            style={[styles.searchInput, { color: c.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search users…"
            placeholderTextColor={c.grey}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={c.grey} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(u) => u.user_id}
        renderItem={renderRow}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          isFetching ? null : (
            <EmptyState
              title={debounced ? 'No users found' : 'Nobody left to invite'}
              message={debounced
                ? 'Try a different name or username.'
                : 'Everyone on the site is already in this group or has been invited.'}
            />
          )
        }
        ListFooterComponent={
          isFetching ? <ActivityIndicator color={c.primaryAlt} style={styles.loader} /> : null
        }
      />
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  list:        { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  loader:      { marginTop: 20, marginBottom: 12 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText:  { flex: 1, minWidth: 0 },
  username: { fontSize: 15, fontWeight: '800' },
  fullName: { fontSize: 12, marginTop: 1 },

  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minWidth: 92, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999,
  },
  inviteBtnBusy: { opacity: 0.7 },
  inviteText: { fontSize: 13, fontWeight: '800', color: '#000000' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
});
