import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Search, X, Check, UserPlus } from 'lucide-react-native';
import {
  useSearchQuery,
  useGetGroupMembersQuery,
  useInviteGroupMemberMutation,
} from '../../api/apiService';
import SharedModal from '../ui/SharedModal';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import type { User } from '../../types/api';

/** Long enough that each keystroke doesn't fire a search, short enough to feel live. */
const DEBOUNCE_MS = 300;
/** Below this a search matches half the club, so it doesn't run. */
const MIN_QUERY = 2;

/**
 * "Invite someone" for a group — type a name, pick from the matches, done.
 *
 * Invitations existed on the server and had no way in from the app: an admin
 * could approve people who asked, but couldn't ask anyone. The invited member
 * answers from their notifications, where it reads exactly like the join
 * request an admin answers — same row, same two buttons, same settled state.
 *
 * People already in the group are shown as such rather than hidden, so an admin
 * looking for someone they think they invited gets an answer instead of an
 * empty list.
 */
export default function GroupInviteSheet({
  groupId,
  groupTitle,
  visible,
  onClose,
}: {
  groupId: string;
  groupTitle?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  /** Who's been invited in this sitting, so their row can say so. */
  const [invited, setInvited] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  const [inviteMember] = useInviteGroupMemberMutation();
  const { data: members = [] } = useGetGroupMembersQuery(groupId, { skip: !visible });
  const { data: results, isFetching } = useSearchQuery(debounced, {
    skip: !visible || debounced.length < MIN_QUERY,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Cleared on open rather than on close — resetting while it animates out is
  // visible.
  useEffect(() => {
    if (visible) { setQuery(''); setDebounced(''); setInvited([]); }
  }, [visible]);

  /** user_id → what the group already thinks of them. */
  const existing = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => { if (m.user_id) map.set(m.user_id, m.status ?? 'active'); });
    return map;
  }, [members]);

  const users: User[] = results?.users ?? [];

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

  const statusFor = (user: User): string | null => {
    if (invited.includes(user.user_id)) return 'Invited';
    const status = existing.get(user.user_id);
    if (status === 'active') return 'Member';
    if (status === 'invited') return 'Invited';
    if (status === 'pending') return 'Requested';
    return null;
  };

  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      title={groupTitle ? `Invite to ${groupTitle}` : 'Invite Members'}
      heightRatio={0.85}
    >
      <View style={styles.body}>
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.borderDark }]}>
          <Search size={16} color={c.grey} />
          <TextInput
            style={[styles.searchInput, { color: c.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search members by username…"
            placeholderTextColor={c.grey}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={c.grey} />
            </TouchableOpacity>
          )}
        </View>

        {debounced.length < MIN_QUERY ? (
          <Text style={[styles.hint, { color: c.grey }]}>
            Type at least {MIN_QUERY} characters to find someone.
          </Text>
        ) : isFetching ? (
          <ActivityIndicator color={c.primaryAlt} style={styles.loader} />
        ) : users.length === 0 ? (
          <EmptyState title="No members found" message="Try a different username." />
        ) : (
          // A short list, mapped rather than virtualised: the search caps well
          // below the point where a FlatList would earn its keep, and this sits
          // inside a sheet that scrolls itself.
          users.map((user) => {
            const status = statusFor(user);
            const busy = pending === user.user_id;
            return (
              <View key={user.user_id} style={[styles.row, { borderBottomColor: c.borderDark }]}>
                <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={38} />
                <View style={styles.rowText}>
                  <Text style={[styles.username, { color: c.fg }]} numberOfLines={1}>
                    @{user.username}
                  </Text>
                  {[user.firstName, user.lastName].filter(Boolean).length > 0 && (
                    <Text style={[styles.fullName, { color: c.grey }]} numberOfLines={1}>
                      {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                    </Text>
                  )}
                </View>

                {status ? (
                  <View style={[styles.statusPill, { backgroundColor: c.segment }]}>
                    <Check size={12} color={c.grey} strokeWidth={3} />
                    <Text style={[styles.statusText, { color: c.grey }]}>{status}</Text>
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
                      ? <ActivityIndicator size="small" color="#FFFFFF" />
                      : (
                        <>
                          <UserPlus size={14} color="#FFFFFF" strokeWidth={2.6} />
                          <Text style={styles.inviteText}>Invite</Text>
                        </>
                      )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body:      { padding: 16, paddingBottom: 40 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  hint:   { fontSize: 13, marginTop: 16, textAlign: 'center' },
  loader: { marginTop: 24 },

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
  inviteText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
});
