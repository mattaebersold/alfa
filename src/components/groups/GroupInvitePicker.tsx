import React, { useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, type StyleProp, type ViewStyle,
} from 'react-native';
import { Text, TextInput } from '../../theme/Text';
import { Search, X, Plus } from 'lucide-react-native';
import { useSearchQuery } from '../../api/apiService';
import UserByline from '../members/UserByline';
import Avatar from '../ui/Avatar';
import { useInputSurface, INPUT_TEXT_STYLE } from '../ui/FormInput';
import { attachedList } from '../ui/attachedList';
import { useRoomAbove } from '../../keyboard/FormScrollView';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useDebounced } from '../../hooks/useDebounced';
import { useAppSelector } from '../../store/store';
import type { User } from '../../types/api';
import { PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** Below this a search matches half the club, so it doesn't run. */
const MIN_QUERY = 2;
/** The most the results take above the field before they scroll — PostTagPicker's. */
const SUGGEST_MAX_H = 220;

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
 *
 * The results float over the form, on the field's top edge, the way every
 * other search field's do (PostTagPicker, AutocompleteField) — above, because
 * below is the keyboard, and floating, so they never shove the form around.
 * A tap adds the member and clears the search for the next one.
 */
export default function GroupInvitePicker({
  selected,
  onChange,
  style,
}: {
  selected: User[];
  onChange: (next: User[]) => void;
  /** Onto the wrapper — `flex: 1` sits the search at the foot of the space it's given. */
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const surface = useInputSurface();
  const brand = useBrandColor();
  // On focus the field is brought down onto the keyboard, and the list gets
  // whatever's left above it, up to SUGGEST_MAX_H.
  const room = useRoomAbove(SUGGEST_MAX_H);
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());

  const { data: results, isFetching } = useSearchQuery(debounced, {
    skip: debounced.length < MIN_QUERY,
  });

  // You're the group's admin the moment it exists — you can't invite yourself.
  const selectedIds = new Set(selected.map((u) => u.user_id));
  // Not you, and not anyone already picked — they're in the chips.
  const users: User[] = (results?.users ?? []).filter(
    (u: User) => u.user_id !== myId && !selectedIds.has(u.user_id),
  );
  const typed = query.trim().length;
  /** The results box is up — it and the field join while it is. */
  const suggesting = typed > 0;
  /** What's on screen is for what's typed now, not a keystroke ago. */
  const settled = debounced === query.trim() && !isFetching;

  const toggle = (user: User) => {
    onChange(
      selectedIds.has(user.user_id)
        ? selected.filter((u) => u.user_id !== user.user_id)
        : [...selected, user],
    );
  };

  const add = (user: User) => {
    toggle(user);
    setQuery('');
  };

  return (
    <View style={style}>
      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((user) => (
            <UserByline
              key={user.user_id}
              user={user}
              size={22}
              gap={6}
              nameStyle={styles.chipText}
              style={[styles.chip, { backgroundColor: c.segment, borderColor: c.borderDark }]}
              onPress={() => toggle(user)}
              activeOpacity={0.8}
              accessibilityLabel={`Remove @${user.username}`}
            >
              <X size={13} color={c.grey} strokeWidth={2.6} />
            </UserByline>
          ))}
        </View>
      )}

      {/* Whatever room the caller gives, between the chips and the search. */}
      <View style={styles.grow} />

      <View ref={room.ref} collapsable={false} style={styles.searchWrap}>
        {suggesting && (
          <View style={[attachedList.listAbove, styles.suggestBox, { borderColor: c.inputBorder }]}>
            {typed < MIN_QUERY ? (
              <Text style={[styles.hint, { color: c.grey }]}>Keep typing…</Text>
            ) : users.length > 0 ? (
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: room.maxHeight }}>
                {users.map((user, i) => (
                  <TouchableOpacity
                    key={user.user_id}
                    style={[styles.suggestRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
                    onPress={() => add(user)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Invite @${user.username}`}
                  >
                    <Avatar user={user} size={30} />
                    <Text style={[styles.suggestText, { color: c.fg }]} numberOfLines={1}>@{user.username}</Text>
                    <Plus size={16} color={brand} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={[styles.hint, { color: c.grey }]}>{settled ? 'No members found' : 'Searching…'}</Text>
            )}
          </View>
        )}
        <View style={[styles.searchBar, surface, suggesting && attachedList.fieldOpenAbove]}>
          <Search size={15} color={c.grey} />
          <TextInput
            style={[styles.searchInput, INPUT_TEXT_STYLE, { color: c.fg }]}
            value={query}
            onChangeText={setQuery}
            onFocus={room.onFocus}
            onBlur={room.onBlur}
            placeholder="Search members by username…"
            placeholderTextColor={c.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={6} accessibilityLabel="Clear search">
              <X size={15} color={c.grey} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    maxWidth: '100%',
    paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  grow: { flexGrow: 1 },

  // The rest is PostTagPicker's search, so the two read as one control.
  // Raised for good, not only while the list shows — a zIndex that changes
  // re-orders the native views and the field loses focus mid-word.
  searchWrap: { zIndex: 20, elevation: 20 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, padding: 0 },
  // Sits on the field's top edge — the rest of the look is attachedList.listAbove.
  suggestBox: {
    position: 'absolute', left: 0, right: 0, bottom: '100%',
    boxShadow: '0px -6px 18px rgba(0, 0, 0, 0.45)',
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  suggestText: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  hint: { fontSize: 13, paddingVertical: 10, paddingHorizontal: 12 },
});
