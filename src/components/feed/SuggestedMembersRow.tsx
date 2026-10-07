import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { useGetUsersQuery, useGetUserFollowingQuery, useGetUserByIdQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { shuffle } from '../../utils/array';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { FONT_INTER } from '../../constants/fonts';

/**
 * "Suggested Members" — recent joiners you don't already follow.
 *
 * The filtering happens here rather than server-side: `api/users` already
 * answers newest-first, and your following list is small enough to hold in
 * memory, so a suggestion set is two cached queries and a set difference. No new
 * endpoint, and both queries are ones other screens already warm.
 *
 * Finding someone specific is the Members screen's job — "View all" goes
 * there — so the row is only suggestions.
 */

const AVATAR_SIZE = 50;
// Just wider than the avatar: at 72 each face sat in its own column of empty
// space and the row read as sparse.
const CARD_WIDTH = 60;
const CARD_GAP = 4;
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
      {/* A circle, like every other face in the app — Avatar's default. */}
      <Avatar user={member} size={AVATAR_SIZE} />
      <Text style={[styles.username, { color: colors.grey }]} numberOfLines={1}>
        @{member.username}
      </Text>
    </SummaryTouchable>
  );
}

interface Props {
  /** Opens the hide dialog for this row. Omit and no close button is drawn. */
  onRequestHide?: () => void;
}

export default function SuggestedMembersRow({ onRequestHide }: Props) {
  const navigation = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const { openUser } = useSummary();
  const myId = userInfo?.user_id ?? '';

  const { data: usersData } = useGetUsersQuery({ limit: POOL_SIZE });
  const { data: followingData } = useGetUserFollowingQuery(
    { userId: myId, limit: 100 },
    { skip: !myId },
  );

  // Whoever invited you, if anyone — the one member here you already know.
  const invitedBy = userInfo?.invited_by ?? '';
  const { data: inviter } = useGetUserByIdQuery(invitedBy, { skip: !invitedBy });

  // Shuffled, not sliced off the top: the pool is newest-first and three times
  // the size of the shelf, so without this the same ten recent joiners would be
  // the only members ever suggested. Memoised on the source data so it settles
  // once per fetch rather than reordering under a scrolling finger.
  //
  // The inviter sits in front of the shuffle, until you follow them.
  const suggestions = useMemo(() => {
    const pool = usersData?.entries ?? [];
    const followed = new Set((followingData?.entries ?? []).map((u) => u.user_id));
    const eligible = (u: { user_id?: string }) =>
      !!u.user_id && u.user_id !== myId && !followed.has(u.user_id);
    const lead = inviter && eligible(inviter) ? [inviter] : [];
    const rest = shuffle(pool.filter((u) => eligible(u) && u.user_id !== inviter?.user_id));
    return [...lead, ...rest].slice(0, MAX_SUGGESTIONS);
  }, [usersData, followingData, myId, inviter]);

  // Nothing to suggest is a normal state for someone who follows everyone —
  // render nothing rather than an empty shelf.
  if (!suggestions.length) return null;

  return (
    <SuggestionCard
      title="Suggested Members"
      action={{
        label: 'View all',
        onPress: () => navigation.navigate('MainTabs', { screen: 'FeedTab', params: { screen: 'Members' } }),
      }}
      onClose={onRequestHide}
    >
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
            onPress={(origin) => openUser(member.user_id, origin, userPreview(member))}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>

    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  scroll:    { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:      { width: CARD_WIDTH, alignItems: 'center', gap: 4 },
  username:  { fontSize: 9.5, fontFamily: FONT_INTER.semibold, maxWidth: CARD_WIDTH },
});
