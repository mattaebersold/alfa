import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, BackHandler, Animated } from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { useNavigation } from '@react-navigation/native';
import { BrandsView } from './BrandsScreen';
import { BrandDetailView, type ModelPageParams } from './BrandDetailScreen';
import { ModelDetailView, modelShortTitle } from './ModelDetailScreen';

/** The breadcrumb row's height: its pills (32) and its padding (4 + 6). */
const CRUMBS_H = 42;

/** One step of the Cars tab's trail — see CarsView. */
type Crumb =
  | { kind: 'brands' }
  | { kind: 'brand'; brand: string }
  | { kind: 'model'; params: ModelPageParams };
import { Search, Car, ChevronRight, Plus, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import AppHeader, { useHeaderPad, TABS_STUCK_RISE } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import CarSummaryModal from '../../components/cars/CarSummaryModal';
import { type SummaryOrigin } from '../../components/ui/SummaryModal';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import FilterSummaryRow from '../../components/ui/FilterSummaryRow';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { useHeaderScroll, headerOffset } from '../../hooks/useHeaderScroll';
import FeaturedCarsRow from '../../components/cars/FeaturedCarsRow';
import { useGetCarsQuery, useGetCarBrandsQuery, useGetUserGarageQuery } from '../../api/apiService';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import CarGridItem from '../../components/cars/CarGridItem';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import EmptyState from '../../components/ui/EmptyState';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { COMMON_RADIUS, COLOR_BLACK, GUTTER, CAR_LIMIT_BASIC, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'


export default function CarsScreen(_: CarsScreenProps<'Cars'>) {
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
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
  const navigation = useNavigation<any>();
  /**
   * Browsing happens here, in place of the cars — the brands, a make, a
   * model — under a breadcrumb trail, rather than as pushed screens: from
   * inside a tab a push would leave the tab bar behind, and the home stack
   * has none of those screens anyway. The trail is the stack; each crumb
   * before the last takes you back to it.
   */
  const [trail, setTrail] = useState<Crumb[]>([]);
  const here = trail[trail.length - 1];
  const popTo = (depth: number) => setTrail((t) => t.slice(0, depth));
  // Android's back steps up the trail before it leaves the tab.
  useEffect(() => {
    if (trail.length === 0) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { popTo(trail.length - 1); return true; });
    return () => sub.remove();
  }, [trail.length]);
  const brand = useBrandColor();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);
  // The same list the Brands screen shows — its length is the count on the button.
  const { data: brands } = useGetCarBrandsQuery();
  const brandCount = brands?.length ?? 0;

  // Add a car — or, at a basic account's limit, the upsell, as the garage's
  // own add button does rather than opening a form the server will refuse.
  const isPro = useIsPro();
  const { data: garage } = useGetUserGarageQuery();
  const [upsell, setUpsell] = useState(false);
  const atLimit = !isPro && (garage?.entries?.length ?? 0) >= CAR_LIMIT_BASIC;
  const addCar = () =>
    atLimit ? setUpsell(true) : (navigation as any).navigate('CarCreate', {});

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

  if (here) {
    const crumbs: string[] = ['Cars', 'Brands', ...trail.slice(1).map((c) => (c.kind === 'brand' ? c.brand : c.kind === 'model' ? modelShortTitle(c.params) : ''))];
    // Cars › Brands › Porsche › 911 — every crumb but the last is a way back.
    // On the grids it floats under the header; on a model it's laid over the
    // banner and scrolls away with it.
    const crumbRow = (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.crumbsScroller, here.kind !== 'model' && { position: 'absolute', top: headerPad }]}
          // A little further down on a model, where the row sits on the
          // banner photo rather than tight under the header.
          contentContainerStyle={[styles.crumbs, here.kind === 'model' && styles.crumbsOnBanner]}
        >
          {crumbs.map((label, i) => {
            const last = i === crumbs.length - 1;
            return (
              <React.Fragment key={`${i}-${label}`}>
                {i > 0 && <Text style={[styles.crumbSlash, { color: colors.grey }]}>/</Text>}
                {/* Each a small outlined pill — the ones behind are buttons
                    back up the trail; the last is filled, and where you are. */}
                <TouchableOpacity
                  onPress={() => popTo(i)}
                  disabled={last}
                  activeOpacity={0.75}
                  style={[
                    styles.crumbBtn,
                    // A dark ground: the row floats over photos as often as not.
                    { borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(0,0,0,0.5)' },
                    last && { backgroundColor: brand, borderColor: brand },
                  ]}
                  accessibilityRole={last ? 'header' : 'button'}
                  accessibilityLabel={last ? label : `Back to ${label}`}
                >
                  <Text style={[styles.crumb, { color: last ? COLOR_BLACK : colors.fg }]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>
    );
    return (
      // Padded for the full header, and lifted as the header collapses — by
      // the same distance its tab row rises — so the trail and the filter stay
      // tucked under the small header rather than hanging below where the
      // buttons were. The box runs that much past the foot to cover the lift.
      <Animated.View
        style={[
          styles.content,
          { backgroundColor: colors.cream, paddingTop: headerPad, marginBottom: -TABS_STUCK_RISE },
          { transform: [{ translateY: headerOffset.interpolate({ inputRange: [-TABS_STUCK_RISE, 0], outputRange: [-TABS_STUCK_RISE, 0], extrapolate: 'clamp' }) }] },
        ]}
      >
        {here.kind !== 'model' && crumbRow}
        {here.kind === 'brands' && (
          <BrandsView
            headerPad={CRUMBS_H}
            onScroll={onScroll}
            onPickBrand={(b) => setTrail((t) => [...t, { kind: 'brand', brand: b }])}
          />
        )}
        {here.kind === 'brand' && (
          <BrandDetailView
            key={here.brand}
            headerPad={CRUMBS_H}
            brand={here.brand}
            onScroll={onScroll}
            onOpenModel={(p) => setTrail((t) => [...t, { kind: 'model', params: p }])}
          />
        )}
        {here.kind === 'model' && (
          <ModelDetailView
            key={`${here.params.modelHandle}-${here.params.generationHandle ?? ''}`}
            params={here.params}
            onOpenBrand={() => popTo(2)}
            onScroll={onScroll}
            bannerOverlay={crumbRow}
          />
        )}
      </Animated.View>
    );
  }

  return (
    <>
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        ref={scrollRef}
        // One item, the whole mosaic: its cards take their photos' shapes
        // (6:5 or 5:6), so they sit in two columns rather than rows — the
        // brand page's grid (CarMosaic), where rows would leave gaps beside
        // the short ones. Alternating, not balanced by height: a card's shape
        // is only known once its photo loads.
        data={filteredCars.length ? ['mosaic'] : []}
        keyExtractor={(item) => item}
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabBarHeight + 32 }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Heading rides in the list so it scrolls away with the content. */}
            <View style={styles.heading}>
              <ScreenHeading
                title="Cars"
                right={
                  <TouchableOpacity
                    style={[styles.addBtn, { borderColor: colors.border }]}
                    onPress={addCar}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Add a car"
                  >
                    <Plus size={15} color={colors.fg} strokeWidth={2.4} />
                    <Text style={[styles.addBtnText, { color: colors.fg }]}>Add car</Text>
                  </TouchableOpacity>
                }
              />
            </View>
            <View style={styles.brandsRow}>
              {/* The way into the site by make — a real button now, not a
                  strip: the car, the words, how many makes there are to browse. */}
              <TouchableOpacity
                style={[styles.brandsBtn, { backgroundColor: brand }]}
                onPress={() => setTrail([{ kind: 'brands' }])}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={brandCount ? `Browse by brand, ${brandCount} brands` : 'Browse by brand'}
              >
                <Car size={22} color={COLOR_BLACK} strokeWidth={2.2} />
                <Text style={styles.brandsBtnText}>Browse by Brand</Text>
                {brandCount > 0 && (
                  <View style={styles.brandsCount}>
                    <Text style={[styles.brandsCountText, { color: brand }]}>{brandCount}</Text>
                  </View>
                )}
                <ChevronRight size={20} color={COLOR_BLACK} strokeWidth={2.4} style={styles.brandsChevron} />
              </TouchableOpacity>
            </View>
            <FeaturedCarsRow onCarPress={(id) => (navigation as any).navigate('CarDetail', { carId: id })} />
            <View style={styles.searchRow}>
              {/* Search on the left, the filter on the right — the pattern
                  events, the marketplace and groups share. */}
              <View style={styles.toolsRow}>
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
              <FilterSummaryRow<string>
                value={location.choice}
                onApply={applyLocation}
                pills={[locationPill(location.choice)]}
                compact
              >
                {(choice, setDraft) => (
                  <LocationFilterRow choice={choice} onChoose={setDraft} />
                )}
              </FilterSummaryRow>
              </View>
            </View>

            {/* On the screen, not in the panel — it explains the grid below. */}
            {location.fellBack && (
              <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
            )}
          </>
        }
        renderItem={() => (
          <View style={styles.mosaic}>
            {[0, 1].map((col) => (
              <View key={col} style={styles.column}>
                {filteredCars.filter((_, i) => i % 2 === col).map((item) => (
                  <CarGridItem
                    key={item.internal_id}
                    item={item}
                    overlay
                    // A summary first, as the home feed's suggestions do: a
                    // grid of cars is a list of things to decide about, and
                    // the full page is one button inside the panel.
                    onPress={(origin) => setSummary({ carId: item.internal_id, origin })}
                  />
                ))}
              </View>
            ))}
          </View>
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

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title="Unlimited garage with Pro"
        message={`A basic membership holds ${CAR_LIMIT_BASIC} cars. Pro removes the limit — every car you've owned, kept in one place.`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // The trail over whatever's open: where you are, and the way back up it.
  // Over the page, under the header; the row's own height is CRUMBS_H.
  crumbsScroller: { left: 0, right: 0, zIndex: 5, flexGrow: 0, flexShrink: 0 },
  // On the app's gutter, tight to the header above.
  crumbs:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: GUTTER, paddingTop: 4, paddingBottom: 6 },
  crumbsOnBanner: { paddingTop: 9, paddingLeft: GUTTER + 6 },
  crumbSlash: { fontSize: 14, fontFamily: FONT_INTER.semibold, paddingHorizontal: 2 },
  crumbBtn:  { height: 32, paddingHorizontal: 12, borderRadius: PILL_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  crumb:     { fontSize: 13, fontFamily: FONT_INTER.bold, maxWidth: 160 },
  content: { flex: 1 },
  heading: { paddingHorizontal: GUTTER },
  // Outlined, beside the title — the Videos screen's "View channel" pill.
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  addBtnText: { fontSize: 13, fontFamily: FONT_INTER.semibold },
  // Browse by Brand, first under the heading — the same inset as the search row.
  brandsRow: { paddingHorizontal: 6, paddingBottom: 12 },
  searchRow: {
    paddingHorizontal: 6,
    // Nothing more: the featured row above already leaves room for its glow.
    paddingTop: 0,
    paddingBottom: 10,
    gap: 8,
  },
  // The search and the filter pill, side by side.
  toolsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // A pill, the filter's height, taking the rest of the row.
  searchBar: {
    flex: 1, minWidth: 0, height: 44,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 8, marginBottom: 10 },
  brandsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: COMMON_RADIUS,
    paddingVertical: 15,
    paddingHorizontal: 16,
    width: '100%',
  },
  brandsBtnText: { color: COLOR_BLACK, fontFamily: FONT_INTER.bold, fontSize: 16 },
  // Black on the brand fill, with the number in the brand colour — reads as a
  // badge on the button rather than another word on it.
  brandsCount: {
    minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6,
    backgroundColor: COLOR_BLACK,
    alignItems: 'center', justifyContent: 'center',
  },
  brandsCountText: { fontSize: 12, fontFamily: FONT_INTER.extrabold },
  brandsChevron: { marginLeft: 'auto' },
  list: { paddingBottom: 20 },
  // The brand page's mosaic (CarMosaic): two columns, each card its photo's shape.
  mosaic: { flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  column: { flex: 1 },
});
