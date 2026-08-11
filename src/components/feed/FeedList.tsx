import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, View, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useGetPostsQuery, useGetBatchLikesMutation, useGetFollowingGarageQuery, useGetFollowingEventsQuery, useGetRoutesQuery } from '../../api/apiService';
import FeedItemCard from '../cards/FeedItemCard';
import GarageAdditionCard from './GarageAdditionCard';
import NewEventCard from './NewEventCard';
import RouteCard from '../cards/RouteCard';
import CommentsSheet from '../social/CommentsSheet';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { Post, GarageCar, SocietyEvent, DrivingRoute } from '../../types/api';

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
}

const PAGE_SIZE = 12;
/** How far back the garage additions reach — they interleave, so a chunk is plenty. */
const GARAGE_ADDITIONS_LIMIT = 20;

type FeedRow =
  | { kind: 'post'; post: Post; time: number }
  | { kind: 'car'; car: GarageCar; time: number }
  | { kind: 'event'; event: SocietyEvent; time: number }
  | { kind: 'route'; route: DrivingRoute; time: number };

const timeOf = (iso?: string) => (iso ? new Date(iso).getTime() : 0);

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
}: FeedListProps) {
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const contentFilterEnabled = useAppSelector((s) => (s as any).moderation?.contentFilterEnabled ?? false);
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
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

  // New events from people you follow ride the same feed.
  const { data: followingEvents } = useGetFollowingEventsQuery(
    { limit: 20 },
    { skip: !includeGarageAdditions },
  );
  const newEvents = useMemo(() => followingEvents?.entries ?? [], [followingEvents]);

  // Routes ride the same feed. Unlike garage additions and events — which are
  // scoped to people you follow — these are the newest public routes, because
  // routes are a discovery feature: the point is finding roads you haven't
  // driven, not seeing what your friends did.
  const { data: routeData } = useGetRoutesQuery(
    { sort: 'recent', limit: 20 },
    { skip: !includeGarageAdditions },
  );
  const newRoutes = useMemo(() => routeData?.entries ?? [], [routeData]);

  const { data, isFetching, isLoading, refetch } = useGetPostsQuery({
    page,
    limit: PAGE_SIZE,
    filter: activeFilter,
    user_id: userId,
    car_id: carId,
    type,
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
  const rows = useMemo<FeedRow[]>(() => {
    const postRows: FeedRow[] = allPosts.map((post) => ({ kind: 'post', post, time: timeOf(post.created_at) }));
    if (!includeGarageAdditions
      || (garageCars.length === 0 && newEvents.length === 0 && newRoutes.length === 0)) return postRows;

    const oldestPost = postRows.length ? Math.min(...postRows.map((r) => r.time)) : 0;
    const inWindow = (created?: string) => !hasMorePosts || timeOf(created) >= oldestPost;

    const carRows: FeedRow[] = garageCars
      .filter((car) => inWindow(car.created_at))
      .map((car) => ({ kind: 'car', car, time: timeOf(car.created_at) }));

    const eventRows: FeedRow[] = newEvents
      .filter((event) => inWindow(event.created_at))
      .map((event) => ({ kind: 'event', event, time: timeOf(event.created_at) }));

    const routeRows: FeedRow[] = newRoutes
      .filter((route) => inWindow(route.created_at))
      .map((route) => ({ kind: 'route', route, time: timeOf(route.created_at) }));

    return [...postRows, ...carRows, ...eventRows, ...routeRows].sort((a, b) => b.time - a.time);
  }, [allPosts, garageCars, newEvents, newRoutes, includeGarageAdditions, hasMorePosts]);

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
        data={rows}
        keyExtractor={(row) =>
          row.kind === 'post' ? `post-${row.post.internal_id}`
            : row.kind === 'car' ? `car-${row.car.internal_id}`
            : row.kind === 'route' ? `route-${row.route.internal_id}`
            : `event-${row.event.internal_id}`
        }
        renderItem={({ item: row }) => (
          row.kind === 'car' ? (
            <GarageAdditionCard car={row.car} />
          ) : row.kind === 'event' ? (
            <NewEventCard event={row.event} />
          ) : row.kind === 'route' ? (
            <RouteCard route={row.route} />
          ) : (
            <FeedItemCard
              post={row.post}
              isLiked={row.post.isLiked ?? likedMap[row.post.internal_id]}
              onPress={() => onPostPress?.(row.post)}
              onCommentPress={() => setCommentPost(row.post)}
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
      {commentPost && (
        <CommentsSheet
          postId={commentPost.internal_id}
          entryType={commentPost.entry_type ?? commentPost.type ?? 'post'}
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
