import React, { useLayoutEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, ChevronRight } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CarMosaic from '../../components/cars/CarMosaic';
import ModelBookmarkButton from '../../components/cars/ModelBookmarkButton';
import ModelPostsSection from '../../components/cars/ModelPostsSection';
import CarGroupsRow from '../../components/cars/CarGroupsRow';
import {
  useGetCarsQuery, useGetModelDiscussionQuery, useGetModelResourcesQuery, useGetModelProfileQuery,
} from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_26, COLOR_WHITE, GUTTER, PILL_RADIUS } from '../../constants/config';

type Tab = 'cars' | 'discussion' | 'resources';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** The banner photo's height — behind the status bar and the header's buttons too. */
const BANNER_H = Math.round(SCREEN_WIDTH * 0.72);
/** The description's lines before "more". */
const DESCRIPTION_LINES = 3;
/** An unlit tab — as the app header's tabs. */
const TAB_IDLE = 'rgba(255,255,255,0.6)';

/**
 * What a model page is called: "Porsche 911", or for a generation "Porsche
 * 993" when that reads on its own and "Volkswagen Jetta Mk2" when it doesn't.
 */
export function modelPageTitle(p: { brand: string; model: string; generation?: string; standalone?: boolean }) {
  if (!p.generation) return `${p.brand} ${p.model}`;
  return p.standalone ? `${p.brand} ${p.generation}` : `${p.brand} ${p.model} ${p.generation}`;
}

/**
 * A car model's page — a profile of the model, not just a list of its cars.
 *
 * A banner from one of its members' cars, under a see-through title bar
 * that keeps only the back button and the bookmark. Then the way back up
 * (the make, and the model for a generation), the name and how many cars,
 * a short factual paragraph and stat tiles from Wikipedia (horacio's
 * seed-model-profiles — absent until one's written), the groups about it,
 * and three sections switched by tabs styled as the app header's: every car
 * of the model, its discussion, and its resources. Everything above the tabs
 * scrolls away with whichever section is showing.
 */
export default function ModelDetailScreen({ route, navigation }: CarsScreenProps<'ModelDetail'>) {
  const { brand, model, modelHandle, generationHandle } = route.params;
  const title = modelPageTitle(route.params);
  const colors = useColors();
  const brandColor = useBrandColor();
  const [tab, setTab] = useState<Tab>('cars');
  const { data: firstCar } = useGetCarsQuery({ page: 0, limit: 1, make: brand.toLowerCase(), model: modelHandle, generation: generationHandle });
  const total = firstCar?.total;
  // For the counts on the tabs; the sections read the same cached lists.
  const { data: discussion } = useGetModelDiscussionQuery({ make: brand, model });
  const { data: resources } = useGetModelResourcesQuery({ make: brand, model });
  const { data: profile } = useGetModelProfileQuery({ make: brand, model: modelHandle, generation: generationHandle });

  // The banner: a member's car of this model — its main photo, else its first.
  const car = firstCar?.entries?.[0];
  const banner = car ? (imageUrl(car.profile_image) ?? firstGalleryUrl(car.gallery)) : null;

  // The description, 3 lines until "more" — measured off an invisible copy,
  // so "more" only shows when there's more to show.
  const [expanded, setExpanded] = useState(false);
  const [clamps, setClamps] = useState(false);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'cars', label: 'Cars', count: total },
    { key: 'discussion', label: 'Discussion', count: discussion?.entries?.length },
    { key: 'resources', label: 'Resources', count: resources?.entries?.length },
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      // See-through, over the banner: just the back button and the bookmark.
      // The name is on the page, under the photo.
      headerTransparent: true,
      headerStyle: { backgroundColor: 'transparent' },
      headerTitle: '',
      // Saved to the header's Bookmarks › Cars — see BookmarksPanel.
      headerRight: () => (
        <ModelBookmarkButton
          make={brand}
          model={model}
          modelHandle={modelHandle}
          generation={route.params.generation}
          generationHandle={generationHandle}
          standalone={route.params.standalone}
        />
      ),
    });
  }, [navigation, brand, model, modelHandle, generationHandle, route.params.generation, route.params.standalone]);

  const crumbs: { label: string; onPress: () => void }[] = [
    { label: brand, onPress: () => navigation.navigate('BrandDetail', { brand }) },
    // A generation's page goes up to its model's.
    ...(route.params.generation ? [{
      label: model,
      onPress: () => navigation.push('ModelDetail', { brand, model, modelHandle }),
    }] : []),
  ];

  const header = (
    <>
      {/* ── The banner ── */}
      <View style={styles.banner}>
        {banner ? (
          <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.bannerBlank]}>
            <Car size={44} color={colors.grey} />
          </View>
        )}
        {/* Dark at the top, for the back button and the status bar… */}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          style={styles.bannerTop}
          pointerEvents="none"
        />
        {/* …and into the page's own ground at the foot. */}
        <LinearGradient
          colors={['rgba(10,10,10,0)', colors.cream]}
          style={styles.bannerFoot}
          pointerEvents="none"
        />
      </View>

      <View style={styles.intro}>
        {/* ── The way back up ── */}
        <View style={styles.crumbs}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.label}>
              {i > 0 && <ChevronRight size={13} color={colors.grey} />}
              <TouchableOpacity
                style={[styles.crumb, { borderColor: colors.border }]}
                onPress={c.onPress}
                activeOpacity={0.75}
                accessibilityRole="link"
                accessibilityLabel={`Back to ${c.label}`}
              >
                <Text style={[styles.crumbText, { color: colors.fg }]} numberOfLines={1}>{c.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* ── The name, and how many ── */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{title}</Text>
          {total != null && (
            <View style={styles.count} accessibilityLabel={`${total} ${total === 1 ? 'car' : 'cars'}`}>
              <Car size={13} color={COLOR_WHITE} strokeWidth={2.2} />
              <Text style={styles.countText}>{total}</Text>
            </View>
          )}
        </View>

        {/* ── About it ── */}
        {profile?.description ? (
          <View>
            <Text
              style={[styles.description, { color: colors.fg }]}
              numberOfLines={expanded ? undefined : DESCRIPTION_LINES}
            >
              {profile.description}
            </Text>
            {/* The same text, unclamped and invisible, to count its lines. */}
            <Text
              style={[styles.description, styles.measure]}
              onTextLayout={(e) => setClamps(e.nativeEvent.lines.length > DESCRIPTION_LINES)}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {profile.description}
            </Text>
            {clamps && (
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={8} style={styles.moreBtn}>
                <Text style={[styles.more, { color: colors.fg }]}>{expanded ? 'less' : 'more'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      {profile?.stats?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stats}>
          {profile.stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statLabel, { color: colors.grey }]}>{s.label}</Text>
              <Text style={[styles.statValue, { color: colors.fg }]} numberOfLines={2}>{s.value}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {/* Wikipedia's text is CC BY-SA — it says where it's from. */}
      {profile?.source_url ? (
        <TouchableOpacity onPress={() => Linking.openURL(profile.source_url!)} style={styles.source} hitSlop={6}>
          <Text style={[styles.sourceText, { color: colors.grey }]}>Source: Wikipedia</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.groups}>
        <CarGroupsRow make={brand} model={model} />
      </View>

      {/* ── The sections, as the app header's tabs ── */}
      <View style={styles.tabs}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabel, active ? { color: brandColor } : styles.tabLabelIdle]}>{t.label}</Text>
                {t.count ? (
                  <Text style={[styles.tabCount, { color: active ? brandColor : TAB_IDLE }]}>{t.count}</Text>
                ) : null}
              </View>
              {/* Under the lit tab only, in its colour, the width of its word. */}
              <View style={[styles.tabUnderline, { backgroundColor: active ? brandColor : 'transparent' }]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {tab === 'cars' ? (
        <CarMosaic make={brand} model={modelHandle} generation={generationHandle} header={header} emptyTitle={`No ${title}s yet`} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {header}
          <ModelPostsSection kind={tab === 'discussion' ? 'discussion' : 'resource'} make={brand} model={model} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: { width: '100%', height: BANNER_H, backgroundColor: COLOR_GRAY_26 },
  bannerBlank: { alignItems: 'center', justifyContent: 'center' },
  bannerTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 130 },
  // A point past the foot, so no hairline of photo shows under it.
  bannerFoot: { position: 'absolute', left: 0, right: 0, bottom: -1, height: '45%' },

  // Pulled up over the banner's faded foot.
  intro: { paddingHorizontal: GUTTER + 8, marginTop: -44, gap: 10 },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  // Small outlined pills, as the other outline buttons (Add car, View channel).
  crumb: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: PILL_RADIUS, borderWidth: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
  },
  crumbText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flexShrink: 1, fontSize: 28, fontFamily: FONT_INTER.bold, letterSpacing: -0.5 },
  count: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  countText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },

  description: { fontSize: 14, lineHeight: 20 },
  // Same box as the real one, invisible and out of flow.
  measure: { position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 },
  moreBtn: { alignSelf: 'flex-start', marginTop: 2 },
  more: { fontSize: 14, lineHeight: 20, fontFamily: FONT_INTER.bold, textDecorationLine: 'underline' },

  // Tiles in a row that scrolls — a stat each, the label over the value.
  stats: { gap: 8, paddingHorizontal: GUTTER + 8, paddingTop: 14 },
  stat: {
    minWidth: 112, maxWidth: 180,
    paddingHorizontal: 12, paddingVertical: 10, gap: 3,
    borderRadius: 14, backgroundColor: COLOR_GRAY_26,
  },
  statLabel: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
  statValue: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.bold },
  source: { alignSelf: 'flex-start', paddingHorizontal: GUTTER + 8, paddingTop: 8 },
  sourceText: { fontSize: 11.5, textDecorationLine: 'underline' },

  groups: { marginTop: 20 },

  // The app header's tabs: a row of words, the lit one in the brand colour
  // with a rounded bar the width of its word beneath it.
  tabs: {
    flexDirection: 'row', alignItems: 'center', gap: 22,
    paddingHorizontal: GUTTER + 8, marginTop: 18, marginBottom: 12,
  },
  tab: { alignItems: 'stretch' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  tabLabel: { fontSize: 17, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  tabLabelIdle: { color: TAB_IDLE, fontFamily: FONT_INTER.medium },
  tabCount: { fontSize: 12, fontFamily: FONT_INTER.bold },
  tabUnderline: { height: 3, borderRadius: 1.5, marginTop: 4 },

  scroll: { paddingBottom: 120 },
});
