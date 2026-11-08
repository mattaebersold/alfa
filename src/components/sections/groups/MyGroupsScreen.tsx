import React, { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useGetUserGroupsQuery } from '../../../api/apiService';
import { useAppSelector } from '../../../store/store';
import { useColors } from '../../../hooks/useColors';
import GroupCard from '../../groups/GroupCard';
import EmptyState from '../../ui/EmptyState';
import { SkeletonList } from '../../ui/Skeleton';
import { GUTTER, MAIN_SCREEN_TOP_GAP } from '../../../constants/config';
import type { Group } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/** A card to a row: the shelf's solo shape — wider and shallower than the grid's. */
const BANNER_RATIO = 2;

/**
 * Groups › My Groups: every group you've joined, a card to a row.
 *
 * The landing's My Groups shelf, given a screen of its own — the same query,
 * the same filter and the same way in. A tap goes straight to the group rather
 * than its summary: you're in it, so "what is this" is already answered.
 */
export default function MyGroupsScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const { data: rawUserGroups, isLoading, refetch } = useGetUserGroupsQuery(
    userInfo?.user_id ?? '',
    { skip: !userInfo?.user_id },
  );
  // The server orders these by when you last used them, so opening one and
  // coming back should move it to the top — read again on the way back, as
  // GroupsView does.
  useFocusEffect(useCallback(() => {
    if (userInfo?.user_id) refetch();
  }, [userInfo?.user_id, refetch]));

  // Only the ones you're actually in — the endpoint also returns pending
  // requests and invitations (see GroupsView's userGroups).
  const groups: Group[] = (rawUserGroups ?? []).filter(
    (g) => (g.membership?.status ?? 'active') === 'active',
  );

  const goToGroup = useCallback((groupId: string) => {
    navigation.navigate('GroupDetail', { groupId });
  }, [navigation]);

  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.internal_id}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <GroupCard
            group={item}
            role={item.membership?.member_type === 'admin' ? 'admin' : 'member'}
            bannerRatio={BANNER_RATIO}
            onPress={() => goToGroup(item.internal_id)}
          />
        </View>
      )}
      ListEmptyComponent={
        isLoading
          ? <SkeletonList count={3} ratio={BANNER_RATIO} style={{ paddingHorizontal: GUTTER }} />
          : <EmptyState title="You haven't joined any groups yet" />
      }
      contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: bottomPad }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primaryAlt} />}
    />
  );
}

const styles = StyleSheet.create({
  list:     { flexGrow: 1 },
  // On the page gutter, as the landing's cards are. A row, so the card's own
  // `flex: 1` (made for the grid's two-up rows) fills the width.
  cardWrap: { flexDirection: 'row', paddingHorizontal: GUTTER, marginBottom: 8 },
});
