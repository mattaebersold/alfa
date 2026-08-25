import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import FeedItemCard from '../cards/FeedItemCard';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { useGetCarTaggedPostsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { Post } from '../../types/api';

const PAGE_SIZE = 12;

/**
 * The full run of posts that tagged this car, newest first.
 *
 * Paged by a button rather than by scroll position: this lives inside the
 * section pane's own scroller, and a nested list that loads on reaching the
 * end would be fighting it for the gesture.
 */
export default function TaggedPostsPane({
  carId,
  onPostPress,
}: {
  carId: string;
  onPostPress: (post: Post) => void;
}) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [all, setAll] = useState<Post[]>([]);

  const { data, isFetching, isLoading } = useGetCarTaggedPostsQuery({ carId, page, limit: PAGE_SIZE });

  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setAll(data.entries);
    // Guarded on id: a post tagged twice, or a page boundary that shifts
    // because someone posted mid-scroll, would otherwise repeat a card.
    else setAll((prev) => {
      const seen = new Set(prev.map((p) => p.internal_id));
      return [...prev, ...data.entries.filter((p) => !seen.has(p.internal_id))];
    });
  }, [data, page]);

  const total = data?.total ?? 0;
  const hasMore = all.length < total;
  const loadMore = useCallback(() => {
    if (!isFetching && hasMore) setPage((p) => p + 1);
  }, [isFetching, hasMore]);

  if (isLoading && all.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState title="No posts tag this car yet" />;

  return (
    <View style={styles.wrap}>
      {all.map((post) => (
        <FeedItemCard key={post.internal_id} post={post} onPress={() => onPostPress(post)} />
      ))}

      {hasMore && (
        <TouchableOpacity
          style={[styles.more, { borderColor: colors.borderDark }]}
          onPress={loadMore}
          disabled={isFetching}
          activeOpacity={0.8}
        >
          {isFetching
            ? <ActivityIndicator size="small" color={colors.primaryAlt} />
            : <Text style={[styles.moreText, { color: colors.primaryAlt }]}>
                Load more ({total - all.length})
              </Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, gap: 10 },
  more: {
    alignSelf: 'center', minWidth: 180,
    paddingVertical: 11, paddingHorizontal: 24,
    borderRadius: 999, borderWidth: 1,
    alignItems: 'center', marginTop: 6,
  },
  moreText: { fontSize: 14, fontWeight: '800' },
});
