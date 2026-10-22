import React, { useRef, useState } from 'react';
import { COLOR_GRAY_26 } from '../../constants/config';
import SubTabs from '../../components/ui/SubTabs';
import PageBanner, { PAGE_BANNER_OVERLAP } from '../../components/cars/PageBanner';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { View, StyleSheet, ScrollView, Dimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '@ors/kit';
import { Car } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CarMosaic from '../../components/cars/CarMosaic';
import ModelTile from '../../components/cars/ModelTile';
import MakeTile from '../../components/cars/MakeTile';
import GarageMatchBadge from '../../components/cars/GarageMatchBadge';
import { useGarageMatch } from '../../hooks/useGarageMatch';
import CarGroupsRow from '../../components/cars/CarGroupsRow';
import { useGetCarsQuery, useGetCarModelsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import { modelShortTitle } from './ModelDetailScreen';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts'

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;


/**
 * The make page's ground — a step lighter than the app's black, so the sub
 * tabs' dark tracks have an edge against it, as on the marketplace.
 */
const MAKE_GROUND = COLOR_GRAY_26;

/** The "All" sub tab's key — no filter. */
const ALL = '__all';

/** A pill under "All BMW cars" — a model, or one generation of it. */
type Filter = { key: string; label: string; qty: number; model: string; generation?: string };

/**
 * One make: its models as tiles to browse into, then every car of it.
 *
 * A model with generations is shown by its generations alone — E30, E36 —
 * not also as "3 Series", which would only be all of them again. The same
 * set, as pills, narrows the grid below without leaving the page.
 */
/** What opens a model page — a model, or one of its generations. */
export type ModelPageParams = {
  brand: string; model: string; modelHandle: string;
  generation?: string; generationHandle?: string; standalone?: boolean;
};

export default function BrandDetailScreen({ route, navigation }: CarsScreenProps<'BrandDetail'>) {
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: MAKE_GROUND }]} edges={[]}>
      <BrandDetailView brand={route.params.brand} onOpenModel={(p) => navigation.navigate('ModelDetail', p)} />
    </SafeAreaView>
  );
}

/**
 * A make's page, for any host — the Brands stack, or the home screen's Cars
 * tab, which shows it in place under a breadcrumb trail. Opening a model is
 * the host's: a push, or one more step on the trail.
 */
export function BrandDetailView({ brand, onOpenModel, headerPad = 0, bannerOverlay, onScroll, scrollClearance = 0 }: {
  brand: string;
  onOpenModel: (params: ModelPageParams) => void;
  /**
   * Room at the top for a host whose header floats over the content. The
   * banner runs up under it either way — only the page's start moves.
   */
  headerPad?: number;
  /** Laid over the banner's top — the Cars tab's breadcrumb trail. */
  bannerOverlay?: React.ReactNode;
  /**
   * How much of the screen's top a host's floating header still covers once
   * scrolled — where picking a sub tab stops the cars heading, below it.
   */
  scrollClearance?: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}) {
  const colors = useColors();
  const [filter, setFilter] = useState<Filter | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /**
   * Where the sub tabs sit in the page: their block's top, plus the row's
   * own offset in it. Picking one rests the row just under the header.
   */
  const carsY = useRef(0);
  const tabsInBlock = useRef(0);
  const [tabsY, setTabsY] = useState(0);
  const noteTabsY = () => setTabsY(carsY.current + tabsInBlock.current);
  const { data: models = [] } = useGetCarModelsQuery(brand);
  // The make's total, for the bubble beside its name — and its first car,
  // whose photo is the banner.
  const { data: totalData } = useGetCarsQuery({ page: 0, limit: 1, make: brand.toLowerCase() });
  const total = totalData?.total;
  const bannerCar = totalData?.entries?.[0];
  const bannerPhoto = bannerCar ? (imageUrl(bannerCar.profile_image) ?? firstGalleryUrl(bannerCar.gallery)) : null;

  const { ownsModel, ownsGeneration } = useGarageMatch();
  const ownsGen = (m: { model_handle: string }, g: { generation_handle: string }) =>
    ownsGeneration(brand, m.model_handle, g.generation_handle);

  // Yours first — a model in your garage, or one of its generations — then
  // most-owned: the models people actually have lead the row. Within a model,
  // your generations lead too.
  const sortedModels = [...models]
    .map((m) => (m.generations?.length
      ? { ...m, generations: [...m.generations].sort((a, b) => Number(ownsGen(m, b)) - Number(ownsGen(m, a))) }
      : m))
    .sort((a, b) => Number(ownsModel(brand, b.model_handle)) - Number(ownsModel(brand, a.model_handle))
      || b.qty - a.qty || a.model.localeCompare(b.model));

  const tileCount = sortedModels.reduce((n, m) => n + (m.generations?.length || 1), 0);

  const filters: Filter[] = sortedModels.flatMap((m) => m.generations?.length
    ? m.generations.map((g) => ({
      key: `${m.model_handle}-${g.generation_handle}`,
      // "E30" reads on its own; "Mk2" needs its model.
      label: g.standalone ? g.generation : `${m.model} ${g.generation}`,
      qty: g.qty,
      model: m.model_handle,
      generation: g.generation_handle,
    }))
    : [{ key: m.model_handle, label: m.model, qty: m.qty, model: m.model_handle }]);

  const header = (
    <>
      {/* One of its cars as a shaded backdrop, the page floating over it — the
          model page's banner. */}
      <PageBanner photo={bannerPhoto} overlay={bannerOverlay} ground={MAKE_GROUND} />
      <View style={styles.overBanner}>
      {/* The name, and how many of it there are as a bubble beside it. */}
      <View style={styles.brandHeader}>
        <Text style={[styles.brandTitle, { color: colors.fg }]} numberOfLines={1}>{brand}</Text>
        {total != null && (
          <View
            style={[styles.brandCount, { backgroundColor: colors.segment }]}
            accessibilityLabel={`${total} ${total === 1 ? 'car' : 'cars'}`}
          >
            <Car size={15} color={colors.fg} strokeWidth={2.2} />
            <Text style={[styles.brandCountText, { color: colors.fg }]}>{total}</Text>
          </View>
        )}
      </View>

      </View>

      {tileCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.models}
        >
          {sortedModels.flatMap((m) => [
            m.generations?.length ? null : <ModelTile
              key={m.model_handle}
              brand={brand}
              modelHandle={m.model_handle}
              name={m.model}
              photos={m.sample_photos}
              count={m.qty}
              countLabel={`${m.qty} ${m.qty === 1 ? 'car' : 'cars'}`}
              style={styles.modelTile}
              compact
              badgeLeft={ownsModel(brand, m.model_handle) ? <GarageMatchBadge /> : undefined}
              onPress={() => onOpenModel({
                brand,
                model: m.model,
                modelHandle: m.model_handle,
              })}
            />,
            // Then the model's generations that have cars — "993" after "911",
            // each its own page.
            ...(m.generations ?? []).map((g) => (
              <MakeTile
                key={`${m.model_handle}-${g.generation_handle}`}
                // "Atlas 1st Gen", not "1st Gen" — see modelShortTitle.
                name={modelShortTitle({ model: m.model, generation: g.generation, standalone: g.standalone })}
                photos={g.sample_photos}
                count={g.qty}
                countLabel={`${g.qty} ${g.qty === 1 ? 'car' : 'cars'}`}
                style={styles.modelTile}
                compact
                badgeLeft={ownsGen(m, g) ? <GarageMatchBadge /> : undefined}
                onPress={() => onOpenModel({
                  brand,
                  model: m.model,
                  modelHandle: m.model_handle,
                  generation: g.generation,
                  generationHandle: g.generation_handle,
                  standalone: g.standalone,
                })}
              />
            )),
          ])}
        </ScrollView>
      )}

      {/* Every group of this make — model groups and make-wide ones alike. */}
      <CarGroupsRow make={brand} />

      {/* The heading and its sub tabs, measured so picking one can bring
          them to the top of the screen, the grid it narrows right under. */}
      <View onLayout={(e) => { carsY.current = e.nativeEvent.layout.y; noteTabsY(); }}>
        <Text style={[styles.section, { color: colors.fg }]}>All {brand} cars</Text>

        {filters.length > 1 && (
          <View style={styles.pills} onLayout={(e) => { tabsInBlock.current = e.nativeEvent.layout.y; noteTabsY(); }}>
            <SubTabs
              options={[
                { key: ALL, label: 'All' },
                ...filters.map((f) => ({ key: f.key, label: f.label })),
              ]}
              value={filter?.key ?? ALL}
              onChange={(key) => {
                setFilter(filters.find((f) => f.key === key) ?? null);
                scrollRef.current?.scrollTo({ y: Math.max(0, tabsY - scrollClearance), animated: true });
              }}
            />
          </View>
        )}
      </View>
    </>
  );

  return (
    <View style={[ss.fill, { paddingTop: headerPad, backgroundColor: MAKE_GROUND }]}>
      <CarMosaic
        make={brand}
        model={filter?.model}
        generation={filter?.generation}
        header={header}
        emptyTitle={filter ? `No ${brand} ${filter.label}s yet` : `No ${brand}s yet`}
        onScroll={onScroll}
        scrollRef={scrollRef}
        // Always room to bring the tabs to the top: a model with only a car
        // or two would otherwise run out of page before they got there.
        minContentHeight={tabsY ? tabsY - scrollClearance + SCREEN_HEIGHT : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The name and the filter, pulled up over the banner's faded foot — the
  // model page's intro does the same.
  overBanner: { marginTop: -PAGE_BANNER_OVERLAP },
  brandHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2,
  },
  brandTitle:  { fontSize: 26, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  brandCount:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
  },
  brandCountText: { fontSize: 14, fontFamily: FONT_INTER.extrabold },
  // Stretched to the tallest tile; each centers its name in the extra height.
  models:    { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, gap: 10, alignItems: 'stretch' },
  section:   { fontSize: 17, fontFamily: FONT_INTER.bold, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  // 38% of the screen — two and a half, so more of the make's models show
  // at once. Two or three cars show as MakeTile's angled, shadowed slices;
  // one fills the photo. Compact: small name, count on the photo.
  modelTile: { width: SCREEN_WIDTH * 0.38 },
  // SubTabs brings its own side margin.
  pills:     { paddingBottom: 12 },
  // The count in its own small circle, centred on the label, set off from it.
});
