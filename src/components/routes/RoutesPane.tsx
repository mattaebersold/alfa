import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import RouteCard from '../cards/RouteCard';
import EmptyState from '../ui/EmptyState';
import Spinner from '../ui/Spinner';
import { useGetRoutesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { DrivingRoute, RouteListParams } from '../../types/api';

const PAGE_SIZE = 12;

/**
 * The full run of routes behind a shelf's "View all", newest first.
 *
 * Paged by a button rather than by scroll position: this lives inside its
 * host's own scroller, and a nested list that loads on reaching the end would
 * be fighting it for the gesture. Same reasoning — and same shape — as
 * TaggedPostsPane.
 *
 * The filter is the host's to choose (`user_id`, `car_id`, `scope`); the
 * server decides what any of them is allowed to return, so nothing here
 * re-checks visibility.
 */
export default function RoutesPane({
  params,
  emptyTitle,
  onRoutePress,
}: {
  /** Everything but paging — merged with this pane's own page and limit. */
  params: RouteListParams;
  emptyTitle: string;
  onRoutePress?: (route: DrivingRoute) => void;
}) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [all, setAll] = useState<DrivingRoute[]>([]);

  const { data, isFetching, isLoading } = useGetRoutesQuery({ ...params, page, limit: PAGE_SIZE });

  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setAll(data.entries);
    // Guarded on id: a route whose page boundary shifted because someone saved
    // a drive mid-scroll would otherwise repeat a card.
    else setAll((prev) => {
      const seen = new Set(prev.map((r) => r.internal_id));
      return [...prev, ...data.entries.filter((r) => !seen.has(r.internal_id))];
    });
  }, [data, page]);

  const total = data?.total ?? 0;
  const hasMore = all.length < total;
  const loadMore = useCallback(() => {
    if (!isFetching && hasMore) setPage((p) => p + 1);
  }, [isFetching, hasMore]);

  if (isLoading && all.length === 0) return <Spinner />;
  if (all.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <View style={styles.wrap}>
      {all.map((route) => (
        <RouteCard
          key={route.internal_id}
          route={route}
          onPress={onRoutePress ? () => onRoutePress(route) : undefined}
        />
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
