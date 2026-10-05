import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import CarGridItem from './CarGridItem';
import CarSummaryModal from './CarSummaryModal';
import EmptyState from '../ui/EmptyState';
import type { SummaryOrigin } from '../ui/SummaryModal';
import { useGetCarsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { GarageCar } from '../../types/api';

/** How near the bottom, in points, the next page is asked for. */
const LOAD_MORE_PX = 600;
const PAGE_SIZE = 12;

/**
 * Every car of a make — or of one model of it — as a scrolling mosaic, with
 * whatever the host puts above it scrolling away with it.
 *
 * Each card is its photo's shape (6:5 or 5:6), so they're laid in two columns
 * rather than rows, which would leave gaps beside the short ones. Alternating,
 * not balanced by height: a card's shape is only known once its photo loads,
 * and re-balancing then would move cards that are already on screen.
 *
 * A tap opens the car's summary over the page, as on the Cars screen.
 */
export default function CarMosaic({ make, model, generation, header, emptyTitle, onScroll }: {
  /** A make's display value or handle — the listing matches either. */
  make: string;
  /** One model's handle, to narrow to it. */
  model?: string;
  /** One generation's handle, with `model` — the 993 of the 911. */
  generation?: string;
  /** Scrolls with the grid, above it. */
  header?: React.ReactNode;
  emptyTitle: string;
  /** A host's own scroll handler — the header's hide-on-scroll, where the grid is a page's body. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [cars, setCars] = useState<GarageCar[]>([]);
  const [summary, setSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);

  // `currentData` rather than `data`: when the filter changes, the old
  // filter's cars mustn't be taken for the new one's first page.
  const { currentData: data, isFetching, refetch } = useGetCarsQuery({
    page,
    limit: PAGE_SIZE,
    make: make.toLowerCase(),
    model,
    generation,
  });

  // A different make, model or generation starts the list over.
  useEffect(() => {
    setPage(0);
    setCars([]);
  }, [make, model, generation]);

  useEffect(() => {
    if (!data?.entries) return;
    if (page === 0) setCars(data.entries);
    else setCars((prev) => {
      const ids = new Set(prev.map((c) => c.internal_id));
      return [...prev, ...data.entries.filter((c) => !ids.has(c.internal_id))];
    });
  }, [data, page]);

  const refresh = useCallback(() => {
    if (page === 0) refetch();
    else setPage(0);
  }, [page, refetch]);

  const loadMore = useCallback(() => {
    if (!isFetching && data && cars.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, cars.length]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.primaryAlt} />}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - LOAD_MORE_PX) loadMore();
          onScroll?.(e);
        }}
        // Every frame while a host is listening — the header's slide needs
        // it — otherwise the coarse tick that load-more is happy with.
        scrollEventThrottle={onScroll ? 16 : 200}
      >
        {header}
        {cars.length === 0 ? (
          isFetching
            ? <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
            : <EmptyState title={emptyTitle} message="Be the first to add one." />
        ) : (
          <View style={styles.mosaic}>
            {[0, 1].map((col) => (
              <View key={col} style={styles.column}>
                {cars.filter((_, i) => i % 2 === col).map((item) => (
                  <CarGridItem
                    key={item.internal_id}
                    item={item}
                    overlay
                    onPress={(origin) => setSummary({ carId: item.internal_id, origin })}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
        {isFetching && page > 0 ? <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} /> : null}
      </ScrollView>

      <CarSummaryModal
        carId={summary?.carId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list:   { paddingBottom: 120 },
  mosaic: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  column: { flex: 1 },
});
