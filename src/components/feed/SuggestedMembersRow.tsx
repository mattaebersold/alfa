import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Search, X as XIcon } from 'lucide-react-native';
import { useGetUsersQuery, useGetUserFollowingQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { shuffle } from '../../utils/array';
import UserSummaryModal from '../members/UserSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';

/**
 * "Suggested Members" — recent joiners you don't already follow.
 *
 * The filtering happens here rather than server-side: `api/users` already
 * answers newest-first, and your following list is small enough to hold in
 * memory, so a suggestion set is two cached queries and a set difference. No new
 * endpoint, and both queries are ones other screens already warm.
 */

const AVATAR_SIZE = 50;
const CARD_WIDTH = 72;
const CARD_GAP = 6;
const ROW_PAD = SUGGESTION_CARD_PAD;
/** Pulled deep enough that filtering out everyone you follow still leaves some. */
const POOL_SIZE = 30;
const MAX_SUGGESTIONS = 10;
/** Below this a search is noise — two characters match most of the directory. */
const MIN_QUERY = 2;
/** Long enough that typing a name is one request, not one per keystroke. */
const SEARCH_DEBOUNCE_MS = 300;
/** A search answers with more than the shelf suggests — you're looking for someone. */
const MAX_RESULTS = 20;

function MemberCard({ member, onPress }: {
  member: any;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  return (
    <SummaryTouchable style={styles.card} onPress={onPress}>
      <Avatar
        user={member}
        size={AVATAR_SIZE}
      />
      <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
        @{member.username}
      </Text>
    </SummaryTouchable>
  );
}

interface Props {
  /** Opens the shared hide dialog. Omit and no close button is drawn. */
  onRequestHide?: () => void;
}

export default function SuggestedMembersRow({ onRequestHide }: Props) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [summary, setSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  const myId = userInfo?.user_id ?? '';

  /**
   * The shelf doubles as a way to find someone.
   *
   * Suggestions answer "who might I follow"; a search answers "where is this
   * person", which is the question people actually arrive with. Same row, same
   * cards — only the source of the members changes.
   *
   * Debounced, and the query is only sent once it's long enough to mean
   * something. `q` goes to the same `api/users` endpoint the Members screen
   * searches with, so there's nothing new to maintain.
   */
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const searching = debounced.length >= MIN_QUERY;
  const { data: searchData, isFetching: searchFetching } = useGetUsersQuery(
    { q: debounced, limit: MAX_RESULTS },
    { skip: !searching },
  );

  const { data: usersData } = useGetUsersQuery({ limit: POOL_SIZE });
  const { data: followingData } = useGetUserFollowingQuery(
    { userId: myId, limit: 100 },
    { skip: !myId },
  );

  // Shuffled, not sliced off the top: the pool is newest-first and three times
  // the size of the shelf, so without this the same ten recent joiners would be
  // the only members ever suggested. Memoised on the source data so it settles
  // once per fetch rather than reordering under a scrolling finger.
  const suggestions = useMemo(() => {
    const pool = usersData?.entries ?? [];
    const followed = new Set((followingData?.entries ?? []).map((u) => u.user_id));
    return shuffle(
      pool.filter((u) => u.user_id && u.user_id !== myId && !followed.has(u.user_id)),
    ).slice(0, MAX_SUGGESTIONS);
  }, [usersData, followingData, myId]);

  // A search shows what it found, including people you already follow — you're
  // looking for someone specific, not for a recommendation.
  const results = searching
    ? (searchData?.entries ?? []).filter((u) => u.user_id && u.user_id !== myId)
    : suggestions;

  // Nothing to suggest is a normal state for someone who follows everyone —
  // render nothing rather than an empty shelf. Once a search is under way the
  // card stays put regardless, or the field would vanish as you typed.
  if (!suggestions.length && !query) return null;

  return (
    <SuggestionCard title="Suggested Members" onClose={onRequestHide}>
      <View style={[styles.search, { backgroundColor: colors.segment, borderColor: colors.border }]}>
        <Search size={14} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search members..."
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
            <XIcon size={14} color={colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      {searching && results.length === 0 && !searchFetching ? (
        <Text style={[styles.empty, { color: colors.grey }]}>No members match "{debounced}"</Text>
      ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {results.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            // A suggestion is an invitation to decide about someone, which is
            // what the summary is for — the profile is one button inside it.
            onPress={(origin) => setSummary({ userId: member.user_id, origin })}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
      )}

      <UserSummaryModal
        userId={summary?.userId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  // The card deliberately doesn't pad its children (the rows run to its edge),
  // so the field supplies its own inset.
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: ROW_PAD, marginBottom: 10,
    paddingHorizontal: 10, height: 36,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  empty:     { fontSize: 13, paddingHorizontal: ROW_PAD, paddingVertical: 14 },
  scroll:    { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:      { width: CARD_WIDTH, alignItems: 'center', gap: 5 },
  username:  { fontSize: 11, fontWeight: '600', maxWidth: CARD_WIDTH },
});
