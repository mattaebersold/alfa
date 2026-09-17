import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Search } from 'lucide-react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import RegionBadge from '../../components/ui/RegionBadge';
import CarSummaryModal from '../../components/cars/CarSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import FilterSummaryRow from '../../components/ui/FilterSummaryRow';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import FeaturedCarsRow from '../../components/cars/FeaturedCarsRow';
import { useGetCarsQuery, useGetUserByIdQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

function CarGridItem({ item, onPress }: {
  item: GarageCar;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const hero = firstGalleryUrl(item.gallery) ?? (item.profile_image ? `https://partstash-ghia-images.s3.us-west-2.amazonaws.com/${item.profile_image}` : null);
  const { data: owner } = useGetUserByIdQuery(item.user_id, { skip: !item.user_id });
  return (
    <SummaryTouchable style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress}>
      <View style={styles.cardImageContainer}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.cardImage}
          contentFit="cover"
        />
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
          {item.year} {item.make} {item.model}
        </Text>
        {owner && (
          <View style={styles.ownerRow}>
            <Avatar user={owner} size={20} />
            <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>@{owner.username}</Text>
            {/* Where the owner is, as a map — see RegionBadge. It belongs with
                the name it describes rather than floating over the car. */}
            <RegionBadge region={item.owner_region} size={24} />
          </View>
        )}
      </View>
    </SummaryTouchable>
  );
}

export default function CarsScreen({ navigation }: CarsScreenProps<'Cars'>) {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const brand = useBrandColor();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);

  // A car is where its owner is, so this filters on the member behind it —
  // near me by default, measured from the zip on your profile.
  const location = useLocationFilter();
  const { data, isFetching, isLoading } = useGetCarsQuery({ page, limit: 12, ...location.params });

  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);

  /**
   * Any filter change starts the list again — but only a change. Apply with
   * nothing different would empty the list and get the same cached page back,
   * which never re-runs the effect that fills it.
   */
  const applyLocation = useCallback((next: { choice: string; radius: number }) => {
    const choiceChanged = next.choice !== location.choice;
    const radiusChanged = next.radius !== location.radius;
    if (!choiceChanged && !radiusChanged) return;
    if (choiceChanged) location.choose(next.choice);
    if (radiusChanged) location.setRadius(next.radius);
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        ref={scrollRef}
        data={filteredCars}
        keyExtractor={(item) => item.internal_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabBarHeight + 32 }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Heading rides in the list so it scrolls away with the content. */}
            <ScreenHeading title="Cars" />
            <FeaturedCarsRow onCarPress={(id) => (navigation as any).navigate('CarDetail', { carId: id })} />
            <View style={styles.searchRow}>
              <TouchableOpacity style={[styles.brandsBtn, { backgroundColor: brand }]} onPress={() => navigation.navigate('Brands')}>
                <Text style={styles.brandsBtnText}>Browse by Brand →</Text>
              </TouchableOpacity>
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.searchInput, { color: colors.fg }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search cars..."
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Text style={{ color: colors.grey, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              
            </View>

            {/* One row that opens a panel, as on events and members, rather
                than the chips inline above the grid. */}
            <FilterSummaryRow
              value={{ choice: location.choice, radius: location.radius }}
              onApply={applyLocation}
              pills={[locationPill(location.choice, location.radius)]}
              style={styles.filterRow}
            >
              {(draft, setDraft) => (
                <LocationFilterRow
                  choice={draft.choice}
                  onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
                  radius={draft.radius}
                  onRadius={(radius) => setDraft((d) => ({ ...d, radius }))}
                />
              )}
            </FilterSummaryRow>
            {/* On the screen, not in the panel — it explains the grid below. */}
            {location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}
          </>
        }
        renderItem={({ item }) => (
          <CarGridItem
            item={item}
            // A summary first, as the home feed's suggestions do: a grid of
            // cars is a list of things to decide about, and the full page is
            // one button inside the panel.
            onPress={(origin) => setSummary({ carId: item.internal_id, origin })}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
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

      <CarSummaryModal
        carId={summary?.carId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  searchRow: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  // On the search row's 6 gutter, tucked under its bottom padding.
  filterRow: { marginHorizontal: 6, marginTop: 0, marginBottom: 10 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 8, marginBottom: 10 },
  brandsBtn: {
    borderRadius: COMMON_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    width: '100%',
  },
  brandsBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  list: { paddingBottom: 20 },
  row: { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  card: {
    flex: 1,
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImageContainer: { width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  cardInfo: { padding: 8 },
  carTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { fontSize: 11, flex: 1 },
});
