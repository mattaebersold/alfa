import React, { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { useGetUsersQuery, useGetUserFollowingQuery, useGetUserByIdQuery, useGetEngagementSuggestionsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_LEAD, SUGGESTION_CARD_PAD } from './SuggestionCard';
import { shuffle } from '../../utils/array';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../members/UserSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_WHITE } from '../../constants/config';

/**
 * "Suggested Members" — people whose posts and cars you like and comment on,
 * then recent joiners, all of them people you don't already follow.
 *
 * The engagement picks come from the server (GET api/users/suggestions), which
 * ranks whose things you engage with most, then who owns the models you engage
 * with. They lead, in that order; recent joiners fill the rest of the shelf.
 *
 * The filtering happens here rather than server-side: `api/users` already
 * answers newest-first, and your following list is small enough to hold in
 * memory, so a suggestion set is two cached queries and a set difference. No new
 * endpoint, and both queries are ones other screens already warm.
 *
 * Finding someone specific is the Members screen's job, so the row is only
 * suggestions.
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
  return (
    <SummaryTouchable style={styles.card} onPress={onPress}>
      {/* A plain circle — no gradient edge. */}
      <Avatar user={member} size={AVATAR_SIZE} edge={false} />
      <Text style={styles.username} numberOfLines={1}>
        {member.username}
      </Text>
    </SummaryTouchable>
  );
}

interface Props {
  /** Opens the hide dialog for this row. Omit and no close button is drawn. */
  onRequestHide?: () => void;
}

export default function SuggestedMembersRow({ onRequestHide }: Props) {
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
  const { data: engagement } = useGetEngagementSuggestionsQuery(undefined, { skip: !myId });

  // Shuffled, not sliced off the top: the pool is newest-first and three times
  // the size of the shelf, so without this the same ten recent joiners would be
  // the only members ever suggested. Memoised on the source data so it settles
  // once per fetch rather than reordering under a scrolling finger.
  //
  // The inviter sits in front, until you follow them; then the people you
  // engage with, in the server's order; then the shuffled joiners.
  const suggestions = useMemo(() => {
    const pool = usersData?.entries ?? [];
    const followed = new Set((followingData?.entries ?? []).map((u) => u.user_id));
    const seen = new Set<string>();
    const eligible = (u: { user_id?: string }) =>
      !!u.user_id && u.user_id !== myId && !followed.has(u.user_id) && !seen.has(u.user_id);
    const take = (list: any[]) => list.filter((u) => {
      if (!eligible(u)) return false;
      seen.add(u.user_id);
      return true;
    });
    const lead = take(inviter ? [inviter] : []);
    const engaged = take(engagement?.members ?? []);
    const rest = take(shuffle(pool));
    return [...lead, ...engaged, ...rest].slice(0, MAX_SUGGESTIONS);
  }, [usersData, followingData, myId, inviter, engagement]);

  // Nothing to suggest is a normal state for someone who follows everyone —
  // render nothing rather than an empty shelf.
  if (!suggestions.length) return null;

  return (
    <SuggestionCard
      title="Suggested Members"
      // The first card under the header: no gap above it.
      style={styles.first}
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
  first:     { marginTop: 0 },
  scroll:    { gap: CARD_GAP, paddingLeft: SUGGESTION_CARD_LEAD },
  card:      { width: CARD_WIDTH, alignItems: 'center', gap: 4 },
  username:  { fontSize: 9.5, fontFamily: FONT_INTER.semibold, maxWidth: CARD_WIDTH, color: COLOR_WHITE },
});
