import React, { useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Car } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CarMosaic from '../../components/cars/CarMosaic';
import ModelBookmarkButton from '../../components/cars/ModelBookmarkButton';
import ModelPostsSection from '../../components/cars/ModelPostsSection';
import CarGroupsRow from '../../components/cars/CarGroupsRow';
import { useGetCarsQuery, useGetModelDiscussionQuery, useGetModelResourcesQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

type Tab = 'cars' | 'discussion' | 'resources';

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
 * The title bar carries the name, how many cars, and the bookmark. Below it,
 * the groups about it, then three sections: every car of the model, its
 * discussion, and its resources. Discussion and resources are a group's, open
 * to anyone here — no group to join first (see ModelPostsSection). Everything
 * above the section switch scrolls away with whichever section is showing.
 */
export default function ModelDetailScreen({ route, navigation }: CarsScreenProps<'ModelDetail'>) {
  const { brand, model, modelHandle, generationHandle } = route.params;
  const title = modelPageTitle(route.params);
  const colors = useColors();
  const brandColor = useBrandColor();
  const [tab, setTab] = useState<Tab>('cars');
  const { data: totalData } = useGetCarsQuery({ page: 0, limit: 1, make: brand.toLowerCase(), model: modelHandle, generation: generationHandle });
  const total = totalData?.total;
  // For the counts on the tabs; the sections read the same cached lists.
  const { data: discussion } = useGetModelDiscussionQuery({ make: brand, model });
  const { data: resources } = useGetModelResourcesQuery({ make: brand, model });

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'cars', label: 'Cars', count: total },
    { key: 'discussion', label: 'Discussion', count: discussion?.entries?.length },
    { key: 'resources', label: 'Resources', count: resources?.entries?.length },
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText} numberOfLines={1}>{title}</Text>
          {total != null && (
            <View style={styles.count} accessibilityLabel={`${total} ${total === 1 ? 'car' : 'cars'}`}>
              <Car size={13} color="#FFFFFF" strokeWidth={2.2} />
              <Text style={styles.countText}>{total}</Text>
            </View>
          )}
        </View>
      ),
      // Saved to the menu's row — see BookmarkedModelsRow.
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
  }, [navigation, title, total, brand, model, modelHandle, generationHandle, route.params.generation, route.params.standalone]);

  const header = (
    <>
      <CarGroupsRow make={brand} model={model} />

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && { borderBottomColor: brandColor }]}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabText, { color: active ? colors.fg : colors.grey }]}>{t.label}</Text>
              {t.count ? (
                <View style={styles.tabCount}>
                  <Text style={styles.tabCountText}>{t.count}</Text>
                </View>
              ) : null}
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
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 240 },
  headerTitleText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flexShrink: 1 },
  count: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  countText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  // A switch between the page's three sections, under the groups.
  tabs: {
    flexDirection: 'row', marginTop: 16, marginBottom: 12, marginHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '800' },
  tabCount: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: '#2E2E2E', alignItems: 'center', justifyContent: 'center',
  },
  tabCountText: { fontSize: 11, fontWeight: '800', color: '#D0D0D0' },
  scroll: { paddingBottom: 120 },
});
