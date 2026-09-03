import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Car } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import SteeringWheel from '../ui/SteeringWheel';
import FollowButton from '../social/FollowButton';
import { useGetCarsQuery, useGetPostsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';
import type { User } from '../../types/api';

/**
 * One member, in a list of them.
 *
 * The canonical row: pro members carry their ring and wheel, the counts say
 * what they bring to the place, and following is done from here rather than by
 * visiting the profile first. Anywhere a list of people appears, this is what a
 * line of it should look like.
 *
 * It lived inside the members screen until the dashboard's followers and
 * following lists needed it too — those were rendering a bare avatar and a
 * handle, with no way to follow anyone back from the one screen where you are
 * literally looking at people who followed you.
 */
export default function MemberRow({ user, onPress, isFollowing, showStats = true }: {
  user: User;
  onPress: () => void;
  /**
   * From a caller's single bulk lookup. `undefined` means the button should go
   * and find out for itself.
   */
  isFollowing?: boolean;
  /**
   * Car and post counts cost a request each per row. A long list that only
   * needs names can turn them off.
   */
  showStats?: boolean;
}) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s: any) => s.auth);

  const { data: carsData } = useGetCarsQuery(
    { user_id: user.user_id, limit: 1 },
    { skip: !user.user_id || !showStats },
  );
  const { data: postsData } = useGetPostsQuery(
    { user_id: user.user_id, limit: 1 },
    { skip: !user.user_id || !showStats },
  );
  const carCount = carsData?.total ?? 0;
  const postCount = postsData?.total ?? 0;

  const isPro = user.accountType === 'pro' || user.accountType === 'admin';

  return (
    <TouchableOpacity
      style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatarWrap, isPro && styles.proRing]}>
        <Avatar user={user} size={44} />
        {isPro && (
          <View style={styles.proWheelBadge}>
            <SteeringWheel size={12} color="#000000" strokeWidth={2.5} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>@{user.username}</Text>
        {showStats && (
          <View style={styles.statsRow}>
            {carCount > 0 && (
              <View style={styles.statChip}>
                <Car size={12} color={colors.grey} />
                <Text style={[styles.statText, { color: colors.grey }]}>
                  {carCount} {carCount === 1 ? 'car' : 'cars'}
                </Text>
              </View>
            )}
            {postCount > 0 && (
              <Text style={[styles.statText, { color: colors.grey }]}>
                {postCount} {postCount === 1 ? 'post' : 'posts'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* No follow button against your own row. */}
      {user.username && user.user_id !== userInfo?.user_id && (
        <FollowButton username={user.username} isFollowing={isFollowing} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  info:      { flex: 1 },
  name:      { fontSize: 15, fontWeight: '700' },
  statsRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  statChip:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText:  { fontSize: 12 },
  avatarWrap:{ position: 'relative' },
  proRing:   { borderWidth: 2.5, borderColor: '#CDA96F', borderRadius: 26, padding: 2 },
  proWheelBadge: {
    position: 'absolute', bottom: -1, right: -1,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#CDA96F',
    alignItems: 'center', justifyContent: 'center',
  },
});
