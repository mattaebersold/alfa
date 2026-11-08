import React, { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import {
  useGetUserFollowingQuery, useGetUserFollowersQuery, useGetFollowStatusesQuery,
} from '../../../api/apiService';
import { useAppSelector } from '../../../store/store';
import { useSummary } from '../../../providers/SummaryProvider';
import { useColors } from '../../../hooks/useColors';
import MemberRow from '../../members/MemberRow';
import { userPreview } from '../../members/UserSummaryModal';
import EmptyState from '../../ui/EmptyState';
import { SkeletonPeople } from '../../ui/Skeleton';
import { GUTTER, MAIN_SCREEN_TOP_GAP } from '../../../constants/config';
import type { User } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/** As many as the dashboard's lists ask for — the endpoint pages by index, but these are read whole. */
const LIMIT = 100;

/**
 * Members › Following and Members › Followers: who you follow, and who
 * follows you — the dashboard's two lists, as screens, in the Members
 * landing's rows.
 *
 * Both are the same list of people, so one component, told which. Follow
 * state comes from one bulk lookup, as on the landing — on Following too,
 * where everyone starts followed, so a row you unfollow says so at once.
 */
function MemberFollowsScreen({ which, headerPad, onScroll, bottomPad }: SectionScreenProps & {
  which: 'following' | 'followers';
}) {
  const colors = useColors();
  const { openUser } = useSummary();
  const { userInfo } = useAppSelector((s) => s.auth);
  const args = { userId: userInfo?.user_id ?? '', limit: LIMIT };
  // Both hooks, one skipped — hooks can't be chosen between.
  const following = useGetUserFollowingQuery(args, { skip: !userInfo?.user_id || which !== 'following' });
  const followers = useGetUserFollowersQuery(args, { skip: !userInfo?.user_id || which !== 'followers' });
  const { data, isLoading, refetch } = which === 'following' ? following : followers;
  const users: User[] = data?.entries ?? [];

  const usernames = useMemo(
    () => users.map((u) => u.username).filter(Boolean) as string[],
    [users],
  );
  const { data: followData } = useGetFollowStatusesQuery(usernames, { skip: usernames.length === 0 });

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.user_id}
      renderItem={({ item }) => (
        <MemberRow
          user={item}
          plain
          isFollowing={item.username ? followData?.statuses?.[item.username] : undefined}
          // A summary first, as everywhere else people are listed.
          onPress={(origin) => openUser(item.user_id, origin ?? null, userPreview(item))}
        />
      )}
      ListEmptyComponent={
        isLoading ? <SkeletonPeople count={8} style={{ paddingHorizontal: GUTTER }} /> : (
          <EmptyState title={which === 'following' ? "You're not following anyone yet" : 'No followers yet'} />
        )
      }
      contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: bottomPad }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => { if (userInfo?.user_id) refetch(); }}
          tintColor={colors.primaryAlt}
        />
      }
    />
  );
}

export function FollowingMembersScreen(props: SectionScreenProps) {
  return <MemberFollowsScreen {...props} which="following" />;
}

export function FollowerMembersScreen(props: SectionScreenProps) {
  return <MemberFollowsScreen {...props} which="followers" />;
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
});
