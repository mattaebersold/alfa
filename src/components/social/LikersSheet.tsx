import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import SummaryUserRow from '../members/SummaryUserRow';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useGetLikeUsersQuery, useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

/**
 * One liker. Handle only — see SummaryUserRow. The like list is ids, so each
 * row looks its person up; RTK Query shares those lookups with every other
 * place that shows the same people.
 */
function LikerRow({ userId, onOpen }: {
  userId: string;
  onOpen: (userId: string, origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const { data: user } = useGetUserByIdQuery(userId, { skip: !userId });
  if (!user) return null;

  return (
    <SummaryUserRow
      userId={userId}
      user={user}
      onOpen={onOpen}
      avatarSize={40}
      style={[styles.row, { borderBottomColor: colors.border }]}
    />
  );
}

/**
 * Who liked this.
 *
 * Built on SummaryModal, like every other "tell me more about this without
 * leaving where I am" panel — it used to be a slide-up sheet of its own, which
 * meant the same question got a different answer depending on whether you
 * asked it from a feed card or from the post.
 *
 * A row opens that person's summary over this one (see useStackedUserSummary),
 * rather than jumping straight to their profile: the list is a set of people
 * to look through, and leaving it for each one meant finding your way back.
 * The profile is the stacked summary's own button, which closes both panels
 * before it goes.
 */
export default function LikersSheet({
  entryId,
  visible,
  onClose,
  origin,
  title = 'Liked by',
  emptyText = 'No likes yet. Be the first!',
}: {
  entryId: string;
  visible: boolean;
  onClose: () => void;
  /** The row this grew out of — see SummaryTouchable. */
  origin?: SummaryOrigin | null;
  /**
   * What the panel calls the list. A route's votes live in the same Like
   * collection as a post's hearts, so the same panel answers both questions —
   * it just shouldn't call an upvote a like.
   */
  title?: string;
  emptyText?: string;
}) {
  const colors = useColors();
  const { data, isLoading } = useGetLikeUsersQuery(entryId, { skip: !visible || !entryId });
  const userIds = data?.users ?? [];
  const { openUser, stacked } = useStackedUserSummary(visible);

  return (
    <SummaryModal visible={visible} onClose={onClose} origin={origin} stacked={stacked}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.fg }]}>
          {title}{data?.total ? ` · ${data.total}` : ''}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primaryAlt} style={styles.loader} />
        ) : userIds.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>{emptyText}</Text>
        ) : (
          // Mapped, not listed: SummaryModal brings its own scroller, and the
          // like count on a post never runs to the length where virtualising
          // would earn its keep.
          userIds.map((id) => <LikerRow key={id} userId={id} onOpen={openUser} />)
        )}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body:   { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  title:  { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  loader: { marginTop: 30 },
  empty:  { fontSize: 14, paddingVertical: 24, textAlign: 'center' },

  row:    { gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
});
