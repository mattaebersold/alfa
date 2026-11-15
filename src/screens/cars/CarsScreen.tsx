import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '../../theme/Text';
import { useNavigation } from '@react-navigation/native';

import { Car } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useSummary } from '../../providers/SummaryProvider';
import { carPreview } from '../../components/cars/CarSummaryModal';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import FilterSummaryRow from '../../components/ui/FilterSummaryRow';
import SearchPill from '../../components/ui/SearchPill';
import { useLocationFilter, useNearFallback } from '../../hooks/useLocationFilter';
import NoResultsNear from '../../components/ui/NoResultsNear';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import FeaturedCarsRow from '../../components/cars/FeaturedCarsRow';
import { useGetCarsQuery } from '../../api/apiService';
import { useScrollWindow, WindowGate } from '../../components/ui/ScrollWindow';
import CarGridItem from '../../components/cars/CarGridItem';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import EmptyState from '../../components/ui/EmptyState';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';
import { GUTTER, MAIN_SCREEN_TOP_GAP, FEED_CARD_GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'
import { SkeletonGrid } from '../../components/ui/Skeleton';


export default function CarsScreen(_: CarsScreenProps<'Cars'>) {
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader />
      <CarsView headerPad={headerPad} onScroll={onScroll} />
    </SafeAreaView>
  );
}

/**
 * Everything on the Cars screen below the header, for any screen that brings
 * its own — the home screen's Cars tab: `headerPad` is the space its header
 * takes, `onScroll` its header's hide-on-scroll handler.
 */
export function CarsView({ headerPad, onScroll, scrollRef: givenRef }: {
  headerPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** For a host that needs to move the scroll itself — the home screen's jump to the top. */
  scrollRef?: React.RefObject<FlatList<any> | null>;
}) {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const ownRef = useRef<FlatList<any>>(null);
  const scrollRef = givenRef ?? ownRef;
  useScrollTopOnBack(scrollRef);
  // The mosaic is one row, so the list can't drop the cars far off screen;
  // each card does that itself against this (see WindowGate).
  const { scrollWindow, onScroll: onWindowScroll } = useScrollWindow();
  const onListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(e);
    onWindowScroll(e);
  }, [onScroll, onWindowScroll]);
  const navigation = useNavigation<any>();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const { openCar } = useSummary();


  // A car is where its owner is, so this filters on the member behind it —
  // near me by default, measured from the zip on your profile.
  const location = useLocationFilter();
  const { data, isFetching, isLoading } = useGetCarsQuery({ page, limit: 12, ...location.params });

  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);
  // No cars near you: say so, then every car under "Other results".
  useNearFallback(location, {
    settled: !!data && !isFetching && !data.near_unavailable,
    empty: (data?.entries?.length ?? 0) === 0,
  });

  /**
   * Any filter change starts the list again — but only a change. Apply with
   * nothing different would empty the list and get the same cached page back,
   * which never re-runs the effect that fills it.
   */
  const applyLocation = useCallback((next: string) => {
    if (next === location.choice) return;
    location.choose(next);
    setPage(0);
    setAllCars([]);
  }, [location]);

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllCars(data.entries);
      else setAllCars((prev) => {
        const ids = new Set(prev.map((c) => c.internal_id));
        return [...prev, ...data.entries.filter((c) => !ids.has(c.internal_id))];
      });
    }
  }, [data, page]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setRefreshing(false);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allCars.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allCars.length]);

  const searchLower = search.trim().toLowerCase();
  const filteredCars = searchLower
    ? allCars.filter((c) =>
        [c.year, c.make, c.model, c.trim, c.title]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(searchLower))
      )
    : allCars;

  return (
    <>
      <View style={styles.content}>
      <FlatList
        ref={scrollRef}
        // One item, the whole mosaic: its cards take their photos' shapes
        // (6:5 or 5:6), so they sit in two columns rather than rows — the
        // brand page's grid (CarMosaic), where rows would leave gaps beside
        // the short ones. Alternating, not balanced by height: a card's shape
        // is only known once its photo loads.
        data={filteredCars.length ? ['mosaic'] : []}
        keyExtractor={(item) => item}
        // A little clear of the header, with no title to hold it off.
        contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: tabBarHeight + 32 }]}
        onScroll={onListScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* No title or Add car: the tab says where you are, and a car is
                added from your garage. The featured cars lead. */}
            <FeaturedCarsRow onCarPress={(id) => (navigation as any).navigate('CarDetail', { carId: id })} />
            {/* Everyone's cars, under the featured ones — headed the way
                the Groups page heads its browse. Browsing by make is the
                header's Brands option now. */}
            <View style={styles.allHeadingRow}>
              <Text style={[styles.allHeading, { color: colors.fg }]}>All Member Cars</Text>
            </View>
            <View style={styles.searchRow}>
              {/* Search on the left, the filter on the right — the pattern
                  events, the marketplace and groups share. */}
              <View style={styles.toolsRow}>
              <SearchPill value={search} onChangeText={setSearch} onClear={() => setSearch('')} placeholder="Search cars..." />
              <FilterSummaryRow<string>
                value={location.choice}
                onApply={applyLocation}
                pills={[locationPill(location.choice)]}
                compact
              >
                {(choice, setDraft) => (
                  <LocationFilterRow choice={choice} onChoose={setDraft} allLabel="All cars" AllIcon={Car} />
                )}
              </FilterSummaryRow>
              </View>
            </View>

            {/* On the screen, not in the panel — it explains the grid below. */}
            {location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}
            {location.others && <NoResultsNear radius={location.radius} />}
          </>
        }
        renderItem={() => (
          <View style={styles.mosaic}>
            {[0, 1].map((col) => (
              <View key={col} style={styles.column}>
                {filteredCars.filter((_, i) => i % 2 === col).map((item) => (
                  <WindowGate key={item.internal_id} window={scrollWindow}>
                    <CarGridItem
                      item={item}
                      overlay
                      // A summary first, as the home feed's suggestions do: a
                      // grid of cars is a list of things to decide about, and
                      // the full page is one button inside the panel.
                      onPress={(origin) => openCar(item.internal_id, origin, carPreview(item))}
                    />
                  </WindowGate>
                ))}
              </View>
            ))}
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonGrid count={6} ratio={0.8} style={{ paddingHorizontal: GUTTER, paddingTop: 8 }} />
          ) : (
            <EmptyState title="No cars yet" message="Be the first to add your ride." />
          )
        }
        ListFooterComponent={
          isFetching && page > 0 ? (
            <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
      />
      </View>

    </>
  );
}

const styles = StyleSheet.create({
  // "All Member Cars": the Groups page's section heading — its gutter, face and room under it.
  allHeadingRow: { paddingHorizontal: FEED_CARD_GUTTER - 6, marginBottom: 14 },
  allHeading: { fontSize: 17, fontFamily: FONT_INTER.bold },
  content: { flex: 1 },
  searchRow: {
    paddingHorizontal: 6,
    // Nothing more: the featured row above already leaves room for its glow.
    paddingTop: 0,
    paddingBottom: 10,
    gap: 8,
  },
  // The search and the filter pill, side by side.
  toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 8, marginBottom: 10 },
  list: { paddingBottom: 20 },
  // The brand page's mosaic (CarMosaic): two columns, each card its photo's shape.
  mosaic: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  column: { flex: 1 },
});
