import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Search, X, Check, UserPlus } from 'lucide-react-native';
import { useSearchQuery } from '../../api/apiService';
import Avatar from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useDebounced } from '../../hooks/useDebounced';
import { useAppSelector } from '../../store/store';
import type { User } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/** Below this a search matches half the club, so it doesn't run. */
const MIN_QUERY = 2;

/**
 * Pick people to invite to a group that doesn't exist yet.
 *
 * GroupInviteSearch's sibling, and deliberately built the same way — the same
 * search, the same rows — but it can't *be* that one: that invites on the tap,
 * against a group id, and here there's no group to invite anyone to until the
 * form is submitted. So a tap only adds someone to the list, and the list goes
 * up with the create call, where the server invites them once the group is
 * saved (see horacio's groupController.createEntry).
 *
 * The picked set sits above the search as chips, so it survives the search
 * text changing under it: you can look for three people in turn and still see
 * all three.
 */
export default function GroupInvitePicker({
  selected,
  onChange,
}: {
  selected: User[];
  onChange: (next: User[]) => void;
}) {
  const c = useColors();
  const brand = useBrandColor();
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());

  const { data: results, isFetching } = useSearchQuery(debounced, {
    skip: debounced.length < MIN_QUERY,
  });

  // You're the group's admin the moment it exists — you can't invite yourself.
  const users: User[] = (results?.users ?? []).filter((u: User) => u.user_id !== myId);
  const selectedIds = new Set(selected.map((u) => u.user_id));

  const toggle = (user: User) => {
    onChange(
      selectedIds.has(user.user_id)
        ? selected.filter((u) => u.user_id !== user.user_id)
        : [...selected, user],
    );
  };

  return (
    <View>
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((user) => (
            <TouchableOpacity
              key={user.user_id}
              style={[styles.chip, { backgroundColor: c.segment, borderColor: c.borderDark }]}
              onPress={() => toggle(user)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Remove @${user.username}`}
            >
              <Avatar user={user} size={22} />
              <Text style={[styles.chipText, { color: c.fg }]} numberOfLines={1}>@{user.username}</Text>
              <X size={13} color={c.grey} strokeWidth={2.6} />
            </TouchableOpacity>
          ))}
        </View>
      )}

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
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
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
        // Mapped rather than virtualised, as in GroupInviteSearch: the search
        // caps short, and this sits inside the form's own scroller.
        users.map((user) => {
          const on = selectedIds.has(user.user_id);
          const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
          return (
            <View key={user.user_id} style={[styles.row, { borderBottomColor: c.borderDark }]}>
              <Avatar user={user} size={36} />
              <View style={styles.rowText}>
                <Text style={[styles.username, { color: c.fg }]} numberOfLines={1}>@{user.username}</Text>
                {fullName ? (
                  <Text style={[styles.fullName, { color: c.grey }]} numberOfLines={1}>{fullName}</Text>
                ) : null}
              </View>
              {/* Stays a button once added — a second tap takes them back off,
                  the same as the chip above. */}
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  on ? { backgroundColor: c.segment } : { backgroundColor: brand },
                ]}
                onPress={() => toggle(user)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={on ? `Don't invite @${user.username}` : `Invite @${user.username}`}
              >
                {on ? (
                  <>
                    <Check size={13} color={c.grey} strokeWidth={3} />
                    <Text style={[styles.addText, { color: c.grey }]}>Added</Text>
                  </>
                ) : (
                  <>
                    <UserPlus size={13} color="#000000" strokeWidth={2.6} />
                    <Text style={[styles.addText, styles.onBrand]}>Invite</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  hint:   { fontSize: 13, marginTop: 16, textAlign: 'center' },
  loader: { marginTop: 24 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText:  { flex: 1, minWidth: 0 },
  username: { fontSize: 15, fontWeight: '800' },
  fullName: { fontSize: 12, marginTop: 1 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    minWidth: 84, paddingHorizontal: 11, paddingVertical: 7, borderRadius: COMMON_RADIUS,
  },
  addText: { fontSize: 13, fontWeight: '800' },
  onBrand: { color: '#000000' },
});
