import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, View, StyleSheet } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useGetPostsQuery, useGetBatchLikesMutation } from '../../api/apiService';
import FeedItemCard from '../cards/FeedItemCard';
import CommentsSheet from '../social/CommentsSheet';
import EmptyState from '../ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useAppSelector } from '../../store/store';
import type { Post } from '../../types/api';

interface FeedListProps {
  filter?: string;
  userId?: string;
  carId?: string;
  type?: string;
  excludeTypes?: string[];
  onPostPress?: (post: Post) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  /** Extra top padding, so the list can scroll under a floating header. */
  paddingTop?: number;
  /** Scroll handler, e.g. the auto-hiding header's. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const PAGE_SIZE = 12;

export default function FeedList({
  filter,
  userId,
  carId,
  type,
  excludeTypes,
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
        data={allPosts}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <FeedItemCard
            post={item}
            isLiked={item.isLiked ?? likedMap[item.internal_id]}
            onPress={() => onPostPress?.(item)}
            onCommentPress={() => setCommentPost(item)}
          />
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
