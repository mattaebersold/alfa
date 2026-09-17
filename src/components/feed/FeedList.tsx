import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, View, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useGetPostsQuery, useGetBatchLikesMutation, useGetFollowingGarageQuery,
  useGetRoutesQuery, useGetFollowedCarActivityQuery, useGetGroupActivityQuery,
} from '../../api/apiService';
import FeedItemCard from '../cards/FeedItemCard';
import CarPosterCard from '../cards/CarPosterCard';
import CarActivityCard from './CarActivityCard';
import GroupActivityCard from './GroupActivityCard';
import GroupItemDetailModal from '../groups/GroupItemDetailModal';
import RouteCard from '../cards/RouteCard';
import CommentsSheet from '../social/CommentsSheet';
import { useNavigation } from '@react-navigation/native';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { Post, GarageCar, DrivingRoute, CarActivityItem, GroupActivityItem } from '../../types/api';

interface FeedListProps {
  filter?: string;
  userId?: string;
  carId?: string;
  type?: string;
  excludeTypes?: string[];
  /**
   * Mix in cars that people you follow have added to their garages, interleaved
   * with the posts by date. Home feed only — scoped lists stay posts-only.
   */
  includeGarageAdditions?: boolean;
  onPostPress?: (post: Post) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Extra top padding, so the list can scroll under a floating header. */
  paddingTop?: number;
  /** Scroll handler, e.g. the auto-hiding header's. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The underlying FlatList, for a screen that needs to scroll it (e.g. back-to-top). */
  listRef?: React.Ref<FlatList<any>>;
}

const PAGE_SIZE = 12;
/** How far back the garage additions reach — they interleave, so a chunk is plenty. */
const GARAGE_ADDITIONS_LIMIT = 20;
/** Same idea for mods/galleries on cars you follow. */
const CAR_ACTIVITY_LIMIT = 20;
/** Same order as the car activity above — enough to interleave, not to flood. */
const GROUP_ACTIVITY_LIMIT = 20;

/**
 * Which group screen each kind of post lives on.
 *
 * The item's own id opens nothing — these screens take a group and show its
 * section — so "view more" lands you in the right list rather than on the
 * item itself. Mirrors the same mapping in utils/notificationTarget, which
 * routes a group notification to the same place.
 */
const GROUP_SECTION_SCREEN: Record<GroupActivityItem['kind'], string> = {
  discussion: 'GroupDiscussion',
  news:       'GroupNews',
  resource:   'GroupResources',
};

type FeedRow =
  | { kind: 'post'; post: Post; time: number }
  | { kind: 'car'; car: GarageCar; time: number }
  | { kind: 'carActivity'; item: CarActivityItem; time: number }
  | { kind: 'groupActivity'; item: GroupActivityItem; time: number }
  | { kind: 'route'; route: DrivingRoute; time: number };

const timeOf = (iso?: string) => (iso ? new Date(iso).getTime() : 0);

/**
 * How much of a post has to be on screen to count as being watched.
 *
 * 60% rather than a token sliver: a video half off the top of the screen is
 * something you've scrolled past, not something you're watching. `minimumView
 * Time` keeps a fast flick through the feed from starting and stopping players
 * on every row it passes.
 */
const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 150 };

export default function FeedList({
  filter,
  userId,
  carId,
  type,
  excludeTypes,
  includeGarageAdditions = false,
  onPostPress,
  ListHeaderComponent,
  paddingTop = 0,
  onScroll,
  listRef,
}: FeedListProps) {
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const contentFilterEnabled = useAppSelector((s) => (s as any).moderation?.contentFilterEnabled ?? false);
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  /** Which group post is open in its summary, if any. */
  const [groupItem, setGroupItem] = useState<GroupActivityItem | null>(null);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const refreshingRef = useRef(false);
  const [getBatchLikes] = useGetBatchLikesMutation();

  const activeFilter = filter ?? (contentFilterEnabled ? 'safe' : undefined);

  const { data: garageAdditions } = useGetFollowingGarageQuery(
    { limit: GARAGE_ADDITIONS_LIMIT },
    { skip: !includeGarageAdditions },
  );
  // Memoized so the merged row list below keeps a stable identity between renders.
  const garageCars = useMemo(() => garageAdditions?.entries ?? [], [garageAdditions]);

  // Routes ride the same feed. Unlike garage additions — which are scoped to
  // people you follow — these are the newest public routes, because routes are
  // a discovery feature: the point is finding roads you haven't driven, not
  // seeing what your friends did.
  const { data: routeData } = useGetRoutesQuery(
    { sort: 'recent', limit: 20 },
    { skip: !includeGarageAdditions },
  );
  const newRoutes = useMemo(() => routeData?.entries ?? [], [routeData]);

  // Mods and photos added to cars you follow. Scoped like the garage additions
  // — this is your list of cars, not a discovery feed.
  const { data: carActivityData } = useGetFollowedCarActivityQuery(
    { limit: CAR_ACTIVITY_LIMIT },
    { skip: !includeGarageAdditions },
  );
  const carActivity = useMemo(() => carActivityData?.entries ?? [], [carActivityData]);

  // Discussions, news and resources from the groups you're in. Same scoping
  // argument as the two above: your groups, not a discovery feed.
  const { data: groupActivityData } = useGetGroupActivityQuery(
    { limit: GROUP_ACTIVITY_LIMIT },
    { skip: !includeGarageAdditions },
  );
  const groupActivity = useMemo(() => groupActivityData?.entries ?? [], [groupActivityData]);

  const { data, isFetching, isLoading, refetch } = useGetPostsQuery({
    page,
    limit: PAGE_SIZE,
    filter: activeFilter,
    user_id: userId,
    car_id: carId,
    type,
    // Listings and want ads shared only to your groups belong in your home
    // feed too — otherwise they're only seen by whoever opens the group. The
    // card's context row already names the group they came from.
    ...(includeGarageAdditions ? { include_groups: true } : {}),
  });

  useEffect(() => {
    if (data?.entries) {
      const entries = excludeTypes?.length
        ? data.entries.filter((p) => !excludeTypes.includes(p.type ?? ''))
        : data.entries;
      if (page === 0) {
        setAllPosts(entries);
        if (refreshingRef.current) {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      } else {
        setAllPosts((prev) => {
          const ids = new Set(prev.map((p) => p.internal_id));
          const newOnes = entries.filter((p) => !ids.has(p.internal_id));
          return [...prev, ...newOnes];
        });
      }
      // Fetch liked state for any posts that don't have isLiked already
      const unknownIds = data.entries
        .filter((p) => p.isLiked === undefined || p.isLiked === null)
        .map((p) => p.internal_id);
      if (unknownIds.length > 0) {
        getBatchLikes(unknownIds).then((res) => {
          if ('data' in res && res.data) {
            setLikedMap((prev) => {
              const next = { ...prev };
              Object.entries(res.data!).forEach(([id, info]) => {
                next[id] = info.hasLiked ?? false;
              });
              return next;
            });
          }
        });
      }
    }
  }, [data, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setPage(0);
    // If page is already 0, RTK Query won't re-fetch automatically — force it
    if (page === 0) {
      await refetch();
      refreshingRef.current = false;
      setRefreshing(false);
    }
    // Otherwise, setting page=0 triggers a new query; the useEffect clears refreshing
  }, [page, refetch]);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allPosts.length < data.total) {
      setPage((p) => p + 1);
    }
  }, [isFetching, data, allPosts.length]);

  const hasMorePosts = !!data && allPosts.length < data.total;

  // Merge garage additions into the post stream by date. Cars older than the
  // oldest loaded post are held back until the posts around them arrive —
  // otherwise they'd sit at the bottom and jump on the next page.
  /**
   * Which posts are on screen, so a video that scrolls away stops playing.
   *
   * Playback is tap-to-play, so this only ever pauses something the viewer
   * started — but a video that keeps going after it leaves the screen is
   * audible from nowhere, and holds a decoder open while you scroll.
   *
   * The handler is held in a ref because RN treats `onViewableItemsChanged` as
   * fixed for the life of the list and throws if its identity changes.
   */
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleIds(
      viewableItems
        .map((v) => (v.item as FeedRow))
        .filter((row): row is Extract<FeedRow, { kind: 'post' }> => row?.kind === 'post')
        .map((row) => row.post.internal_id),
    );
  });

  const rows = useMemo<FeedRow[]>(() => {
    const postRows: FeedRow[] = allPosts.map((post) => ({ kind: 'post', post, time: timeOf(post.created_at) }));
    if (!includeGarageAdditions
      || (garageCars.length === 0 && newRoutes.length === 0
          && carActivity.length === 0 && groupActivity.length === 0)) return postRows;

    const oldestPost = postRows.length ? Math.min(...postRows.map((r) => r.time)) : 0;
    const inWindow = (created?: string) => !hasMorePosts || timeOf(created) >= oldestPost;

    const carRows: FeedRow[] = garageCars
      .filter((car) => inWindow(car.created_at))
      .map((car) => ({ kind: 'car', car, time: timeOf(car.created_at) }));

    const routeRows: FeedRow[] = newRoutes
      .filter((route) => inWindow(route.created_at))
      .map((route) => ({ kind: 'route', route, time: timeOf(route.created_at) }));

    const activityRows: FeedRow[] = carActivity
      .filter((item) => inWindow(item.created_at))
      .map((item) => ({ kind: 'carActivity', item, time: timeOf(item.created_at) }));

    const groupRows: FeedRow[] = groupActivity
      .filter((item) => inWindow(item.created_at))
      .map((item) => ({ kind: 'groupActivity', item, time: timeOf(item.created_at) }));

    return [...postRows, ...carRows, ...routeRows, ...activityRows, ...groupRows]
      .sort((a, b) => b.time - a.time);
  }, [allPosts, garageCars, newRoutes, carActivity, groupActivity, includeGarageAdditions, hasMorePosts]);

  if (isLoading && page === 0) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={colors.primaryAlt} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        ref={listRef}
        data={rows}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged.current}
        keyExtractor={(row) =>
          row.kind === 'post' ? `post-${row.post.internal_id}`
            : row.kind === 'car' ? `car-${row.car.internal_id}`
            : row.kind === 'carActivity' ? `${row.item.kind}-${row.item.internal_id}`
            : row.kind === 'groupActivity' ? `group-${row.item.kind}-${row.item.internal_id}`
            : `route-${row.route.internal_id}`
        }
        renderItem={({ item: row }) => (
          row.kind === 'car' ? (
            <CarPosterCard car={row.car} attribution />
          ) : row.kind === 'carActivity' ? (
            <CarActivityCard item={row.item} />
          ) : row.kind === 'groupActivity' ? (
            <GroupActivityCard item={row.item} onPress={() => setGroupItem(row.item)} />
          ) : row.kind === 'route' ? (
            <RouteCard route={row.route} />
          ) : (
            <FeedItemCard
              post={row.post}
              isLiked={row.post.isLiked ?? likedMap[row.post.internal_id]}
              onPress={() => onPostPress?.(row.post)}
              onCommentPress={() => setCommentPost(row.post)}
              visible={visibleIds.includes(row.post.internal_id)}
            />
          )
        )}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={
          <EmptyState title="No posts yet" message="Be the first to share something!" />
        }
        ListFooterComponent={
          isFetching && page > 0 ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.grey} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryAlt}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.list, { paddingTop, paddingBottom: tabBarHeight }]}
      />
      {/* A group post opens as a summary, not a screen: it's a detour from the
          feed, and most of them are answered by reading the first paragraph.
          "View in group" is there for the ones that aren't. */}
      <GroupItemDetailModal
        item={groupItem}
        kind={groupItem?.kind ?? null}
        visible={!!groupItem}
        onClose={() => setGroupItem(null)}
        onViewMore={groupItem ? () => {
          const screen = GROUP_SECTION_SCREEN[groupItem.kind];
          if (screen && groupItem.group_id) {
            navigation.navigate(screen as never, { groupId: groupItem.group_id } as never);
          }
        } : undefined}
      />

      {commentPost && (
        <CommentsSheet
          postId={commentPost.internal_id}
          entryType={commentPost.entry_type ?? 'post'}
          visible={!!commentPost}
          onClose={() => setCommentPost(null)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list:          { paddingTop: 0, paddingBottom: 8, flexGrow: 1 },
  footer:        { padding: 20, alignItems: 'center' },
});
