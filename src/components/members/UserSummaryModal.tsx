import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Users, UserPlus, Mail } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import FollowButton from '../social/FollowButton';
import {
  useGetPublicUserByIdQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { stripHtml } from '../../utils/text';

/**
 * Enough of a member to decide whether you want their profile.
 *
 * A group's roster is a list of people you mostly don't know yet, and the
 * questions it raises — who is this, are they worth following, can I message
 * them — all used to cost a screen push or a menu. This answers them in place.
 *
 * The panel, its animation and its "view more" button are SummaryModal's; this
 * only supplies what a member's summary is.
 */
export default function UserSummaryModal({
  userId,
  origin,
  onClose,
}: {
  /** The member to summarise. `null` closes the panel. */
  userId: string | null;
  /** The row that was tapped — the panel grows out of it. */
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: user, isLoading } = useGetPublicUserByIdQuery(userId ?? '', { skip: !userId });
  // Limit 1: only the totals are shown, and the lists themselves belong to the
  // profile page.
  const { data: followers } = useGetUserFollowersQuery({ userId: userId ?? '', limit: 1 }, { skip: !userId });
  const { data: following } = useGetUserFollowingQuery({ userId: userId ?? '', limit: 1 }, { skip: !userId });

  const isMe = !!user && user.user_id === userInfo?.user_id;
  const fullName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
  const bio = user?.bio ? stripHtml(user.bio) : '';

  /** Close first: iOS won't present a screen over a modal that's still going. */
  const go = (run: () => void) => {
    onClose();
    requestAnimationFrame(run);
  };

  return (
    <SummaryModal
      visible={!!userId}
      onClose={onClose}
      origin={origin}
      actionLabel="View Profile"
      onAction={userId ? () => nav.navigate('UserDetail', { userId, username: user?.username }) : undefined}
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
              <View style={styles.nameRow}>
                <Text style={[styles.username, { color: colors.fg }]} numberOfLines={1}>
                  @{user.username}
                </Text>
                {user.memberNumber ? (
                  <View style={[styles.memberBadge, { backgroundColor: colors.primaryAlt }]}>
                    <Text style={styles.memberBadgeText}>#{user.memberNumber}</Text>
                  </View>
                ) : null}
              </View>
              {fullName ? (
                <Text style={[styles.fullName, { color: colors.muted }]} numberOfLines={1}>{fullName}</Text>
              ) : null}

              {/* Counts, not sentences — the icons say what is being counted. */}
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <Users size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>{followers?.total ?? 0}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors.segment }]}>
                  <UserPlus size={10} color={colors.grey} />
                  <Text style={[styles.badgeText, { color: colors.grey }]}>{following?.total ?? 0}</Text>
                </View>
              </View>
            </View>
          </View>

          {bio ? (
            <Text style={[styles.bio, { color: colors.muted }]} numberOfLines={6}>{bio}</Text>
          ) : null}

          {/* Nothing to follow or send when it's you. */}
          {!isMe && (
            <View style={styles.actions}>
              {user.username ? <FollowButton username={user.username} /> : null}
              <TouchableOpacity
                style={[styles.messageBtn, { backgroundColor: colors.segment, borderColor: colors.border }]}
                onPress={() => go(() => nav.navigate('ComposeMessage', {
                  userId: user.user_id, username: user.username,
                }))}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                <Mail size={14} color={colors.fg} />
                <Text style={[styles.messageText, { color: colors.fg }]}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  body:    { padding: 18, paddingBottom: 22, gap: 14 },

  head:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  headText: { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontSize: 19, fontWeight: '800', flexShrink: 1 },
  memberBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  memberBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  fullName: { fontSize: 13, marginTop: 2 },

  badges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },

  bio: { fontSize: 13, lineHeight: 19 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  messageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1,
  },
  messageText: { fontSize: 13, fontWeight: '800' },
});
