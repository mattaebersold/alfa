import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../theme/Text';
import SummaryModal, { type SummaryOrigin } from './SummaryModal';
import Avatar from './Avatar';
import { Spinner } from './Spinner';
import { useColors } from '../theme/useColors';
import { useOrsSelector } from '../store/createStore';
import { useGetPublicUserQuery } from '../api/orsApi';
import type { User } from '../types/ors';
import { FONT_INTER } from '../theme/fonts'

export interface UserSummaryModalProps {
  /** The member to summarise. `null` closes the panel. */
  userId: string | null;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
  /** The bottom button. Runs once the panel (and whatever it's stacked on) has closed. No button without it. */
  onViewProfile?: (user: User) => void;
  /** A row of counts under the name — each app's own numbers (galleries, cars, spots…). */
  renderStats?: (user: User) => React.ReactNode;
  /** Follow, message — each app's own. Not asked for when the member is you. */
  renderActions?: (user: User) => React.ReactNode;
}

/**
 * Enough of a member to decide whether you want their profile — who they are,
 * where they are, what they say about themselves — in a panel over whatever
 * you were reading, so a name in a byline or a roster doesn't cost a screen.
 *
 * What every app has in common is drawn here from the shared public record.
 * What differs — the counts that matter in this app, and its follow button —
 * the host hands in through `renderStats` and `renderActions`. Ported from
 * alfa's components/members/UserSummaryModal, minus alfa's garage and posts.
 *
 * A SummaryModal: to open it over another summary, render it through that
 * panel's `stacked` prop — see SummaryModal's "Stacking".
 */
export default function UserSummaryModal({
  userId, origin, onClose, onViewProfile, renderStats, renderActions,
}: UserSummaryModalProps) {
  const colors = useColors();
  const me = useOrsSelector((s) => s.auth.userInfo);
  const { data: user, isLoading } = useGetPublicUserQuery(userId ?? '', { skip: !userId });

  const isMe = !!user && user.user_id === me?.user_id;
  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';

  return (
    <SummaryModal
      visible={!!userId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Profile"
      onAction={user && onViewProfile ? () => onViewProfile(user) : undefined}
    >
      {isLoading || !user ? (
        // Reserved height rather than a bare spinner: the panel takes its size
        // from its content, so an unsized loading state opens as a sliver.
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View style={styles.body}>
          <View style={styles.head}>
            <Avatar user={user} size={72} />
            <View style={styles.headText}>
              {/* The member number leads: the one fact that doesn't change and
                  isn't a count — a quiet line above the name. */}
              {user.memberNumber ? (
                <View style={styles.memberBadge}>
                  <Text style={styles.memberBadgeText}>#{user.memberNumber}</Text>
                </View>
              ) : null}
              <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
                @{user.username}
              </Text>
              {fullName ? (
                <Text style={[styles.detail, { color: colors.grey }]} numberOfLines={1}>{fullName}</Text>
              ) : null}
              {user.cityState ? (
                <Text style={[styles.detail, { color: colors.grey }]} numberOfLines={1}>{user.cityState}</Text>
              ) : null}
            </View>
          </View>

          {renderStats?.(user)}

          {user.bio ? (
            <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={6}>{user.bio}</Text>
          ) : null}

          {/* Nothing to follow or send when it's you. */}
          {!isMe && renderActions ? <View style={styles.actions}>{renderActions(user)}</View> : null}
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 18, paddingBottom: 22, gap: 14 },

  head:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1, alignItems: 'flex-start', gap: 3 },
  username: { fontSize: 19, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  detail:   { fontSize: 13, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  // Neutral rather than brand-filled: a member number is a fact about the
  // account, not a status.
  memberBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: '#8A8A8A' },
  memberBadgeText: { fontSize: 11, fontFamily: FONT_INTER.medium, color: '#000000' },

  bio:     { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
