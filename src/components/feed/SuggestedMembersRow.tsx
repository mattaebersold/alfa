import React, { useMemo, useState } from 'react';
import {
  Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
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

function MemberCard({ member, onPress }: {
  member: any;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  return (
    <SummaryTouchable style={styles.card} onPress={onPress}>
      <Avatar
        filename={member.gallery?.[0]?.filename ?? member.profilePicture}
        name={member.username ?? '?'}
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
  const { userInfo } = useAppSelector((s) => s.auth);
  const [summary, setSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  const myId = userInfo?.user_id ?? '';

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

  // Nothing to suggest is a normal state for someone who follows everyone —
  // render nothing rather than an empty shelf.
  if (!suggestions.length) return null;

  return (
    <SuggestionCard title="Suggested Members" onClose={onRequestHide}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {suggestions.map((member) => (
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

      <UserSummaryModal
        userId={summary?.userId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  scroll:    { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:      { width: CARD_WIDTH, alignItems: 'center', gap: 5 },
  username:  { fontSize: 11, fontWeight: '600', maxWidth: CARD_WIDTH },
});
