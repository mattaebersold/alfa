import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import CarGridItem from '../../cars/CarGridItem';
import { carPreview } from '../../cars/CarSummaryModal';
import EmptyState from '../../ui/EmptyState';
import { SkeletonGrid } from '../../ui/Skeleton';
import { useSummary } from '../../../providers/SummaryProvider';
import { useColors } from '../../../hooks/useColors';
import { GUTTER, MAIN_SCREEN_TOP_GAP } from '../../../constants/config';
import type { GarageCar } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/**
 * A short list of cars as a sub-screen: the Cars landing's mosaic — two
 * columns of overlay cards, each its photo's shape — with a tap opening the
 * car's summary, as it does there.
 *
 * Unpaged: the lists that feed it (followed, bookmarked) come back whole, so
 * a plain ScrollView does, without the landing's FlatList-of-one and windowing.
 */
export default function CarColumns({ cars, isLoading, emptyTitle, onRefresh, headerPad, onScroll, bottomPad }: Omit<SectionScreenProps, 'active'> & {
  cars: GarageCar[];
  isLoading: boolean;
  emptyTitle: string;
  onRefresh: () => void;
}) {
  const colors = useColors();
  const { openCar } = useSummary();
  return (
    <ScrollView
      contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: bottomPad }]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={colors.primaryAlt} />}
    >
      {cars.length ? (
        // Alternating rather than balanced by height — a card's shape is only
        // known once its photo loads (see CarsView).
        <View style={styles.mosaic}>
          {[0, 1].map((col) => (
            <View key={col} style={styles.column}>
              {cars.filter((_, i) => i % 2 === col).map((item) => (
                <CarGridItem
                  key={item.internal_id}
                  item={item}
                  overlay
                  onPress={(origin) => openCar(item.internal_id, origin, carPreview(item))}
                />
              ))}
            </View>
          ))}
        </View>
      ) : isLoading ? (
        <SkeletonGrid count={6} ratio={0.8} style={{ paddingHorizontal: GUTTER, paddingTop: 8 }} />
      ) : (
        <EmptyState title={emptyTitle} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list:   { flexGrow: 1 },
  // The landing's mosaic: two columns, each card its photo's shape.
  mosaic: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  column: { flex: 1 },
});
