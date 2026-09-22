import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import SummaryUserRow from '../members/SummaryUserRow';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useColors } from '../../hooks/useColors';
import type { PollOptionSummary } from '../../types/api';

/**
 * Who picked one option of a poll.
 *
 * The same panel the likers get — see LikersSheet — so "who chose this" is
 * answered the way "who liked this" is, from a card or from the post. Unlike
 * the likers it needs no lookups: the summary carries each voter inline, which
 * is what lets the avatar stack on the card draw faces without a request.
 *
 * A row opens that person's summary over this one (see useStackedUserSummary)
 * rather than leaving for their profile, since the list is people to look
 * through, not a list to leave from.
 */
export default function PollVotersSheet({
  option,
  visible,
  origin,
  onClose,
}: {
  /** The option whose voters are listed. Null while nothing is open. */
  option: PollOptionSummary | null;
  visible: boolean;
  /** The avatar stack this grew out of — see SummaryTouchable. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const { openUser, stacked } = useStackedUserSummary(visible);
  const voters = option?.voters ?? [];
  const total = option?.voter_total ?? voters.length;
  // The summary sends a page of voters, not all of them, and there is no
  // endpoint for the rest yet. Say so rather than let a list of twelve read
  // as the whole hundred.
  const unlisted = Math.max(0, total - voters.length);

  return (
    <SummaryModal visible={visible} onClose={onClose} origin={origin} stacked={stacked}>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: colors.grey }]}>Voted for</Text>
        <Text style={[styles.title, { color: colors.fg }]}>
          {option?.label ?? ''}{total ? ` · ${total}` : ''}
        </Text>

        {voters.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>No votes for this one yet.</Text>
        ) : (
          // Mapped, not listed: SummaryModal brings its own scroller and the
          // page is capped at a dozen.
          voters.map((v) => (
            <SummaryUserRow
              key={v.user_id}
              userId={v.user_id}
              user={v}
              onOpen={openUser}
              avatarSize={40}
              style={[styles.row, { borderBottomColor: colors.border }]}
            />
          ))
        )}

        {unlisted > 0 && (
          <Text style={[styles.more, { color: colors.grey }]}>
            and {unlisted} more
          </Text>
        )}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body:   { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  title:  { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  empty:  { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  row:    { gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  more:   { fontSize: 13, paddingTop: 12, textAlign: 'center' },
});
