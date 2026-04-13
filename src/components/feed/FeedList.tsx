import React, { useState, useCallback } from 'react';
import { FlatList, RefreshControl, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useGetPostsQuery } from '../../api/apiService';
import FeedItemCard from '../cards/FeedItemCard';
import EmptyState from '../ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Post } from '../../types/api';

interface FeedListProps {
  filter?: string;
  userId?: string;
  carId?: string;
  type?: string;
  onPostPress?: (post: Post) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
}

const PAGE_SIZE = 12;

export default function FeedList({
  filter,
  userId,
  carId,
  type,
  onPostPress,
  ListHeaderComponent,
}: FeedListProps) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isFetching, isLoading } = useGetPostsQuery({
    page,
    limit: PAGE_SIZE,
    filter,
    user_id: userId,
    car_id: carId,
    type,
  });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) {
        setAllPosts(data.entries);
      } else {
        setAllPosts((prev) => {
          const ids = new Set(prev.map((p) => p.internal_id));
          const newOnes = data.entries.filter((p) => !ids.has(p.internal_id));
          return [...prev, ...newOnes];
        });
      }
    }
  }, [data, page]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(0);
    setRefreshing(false);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allPosts.length < data.total) {
      setPage((p) => p + 1);
    }
  }, [isFetching, data, allPosts.length]);

  if (isLoading && page === 0) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={Colors.brg} />
      </View>
    );
  }

  return (
    <FlatList
      data={allPosts}
      keyExtractor={(item) => item.internal_id}
      renderItem={({ item }) => (
        <FeedItemCard post={item} onPress={() => onPostPress?.(item)} />
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
          tintColor={Colors.brg}
        />
      }
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  list:          { paddingVertical: 8, flexGrow: 1 },
  footer:        { padding: 20, alignItems: 'center' },
});
