import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Car, Search, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CarMosaic from '../../components/cars/CarMosaic';
import ModelTile from '../../components/cars/ModelTile';
import MakeTile from '../../components/cars/MakeTile';
import CarGroupsRow from '../../components/cars/CarGroupsRow';
import { useGetCarsQuery, useGetCarModelsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

/**
 * Whether a tile's name answers what's typed: every word, in any order, so
 * "E46 M3" finds the M3's E46 tile and "m3" all of the M3's.
 */
const matches = (query: string, text: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = text.toLowerCase();
  return words.every((w) => hay.includes(w));
};

/** A pill under "All BMW cars" — a model, or one generation of it. */
type Filter = { key: string; label: string; qty: number; model: string; generation?: string };

/**
 * One make: its models as tiles to browse into, then every car of it.
 *
 * A model with generations is shown by its generations alone — E30, E36 —
 * not also as "3 Series", which would only be all of them again. The same
 * set, as pills, narrows the grid below without leaving the page.
 */
export default function BrandDetailScreen({ route, navigation }: CarsScreenProps<'BrandDetail'>) {
  const { brand } = route.params;
  const colors = useColors();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');
  const { data: models = [] } = useGetCarModelsQuery(brand);
  // The make's total, for the bubble beside its name.
  const { data: totalData } = useGetCarsQuery({ page: 0, limit: 1, make: brand.toLowerCase() });
  const total = totalData?.total;

  // Most-owned first: the models people actually have lead the row.
  const sortedModels = [...models].sort((a, b) => b.qty - a.qty || a.model.localeCompare(b.model));

  const tileCount = sortedModels.reduce((n, m) => n + (m.generations?.length
    ? m.generations.filter((g) => matches(query, `${g.generation} ${m.model}`)).length
    : matches(query, m.model) ? 1 : 0), 0);

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

      {sortedModels.length > 0 && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Search size={16} color={colors.grey} />
          <TextInput
            style={[styles.searchInput, { color: colors.fg }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Filter models — E46 M3, 911…"
            placeholderTextColor={colors.grey}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear">
              <X size={16} color={colors.grey} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {sortedModels.length > 0 && tileCount === 0 && (
        <Text style={[styles.noMatch, { color: colors.grey }]}>No {brand} models match “{query.trim()}”</Text>
      )}

      {tileCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.models}
        >
          {sortedModels.flatMap((m) => [
            m.generations?.length || !matches(query, m.model) ? null : <ModelTile
              key={m.model_handle}
              brand={brand}
              modelHandle={m.model_handle}
              name={m.model}
              photos={m.sample_photos}
              count={m.qty}
              countLabel={`${m.qty} ${m.qty === 1 ? 'car' : 'cars'}`}
              fitName
              onPress={() => navigation.navigate('ModelDetail', {
                brand,
                model: m.model,
                modelHandle: m.model_handle,
              })}
            />,
            // Then the model's generations that have cars — "993" after "911",
            // each its own page.
            ...(m.generations ?? []).filter((g) => matches(query, `${g.generation} ${m.model}`)).map((g) => (
              <MakeTile
                key={`${m.model_handle}-${g.generation_handle}`}
                name={g.generation}
                subtitle={m.model}
                photos={g.sample_photos}
                count={g.qty}
                countLabel={`${g.qty} ${g.qty === 1 ? 'car' : 'cars'}`}
                fitName
                onPress={() => navigation.navigate('ModelDetail', {
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

      <Text style={[styles.section, { color: colors.fg }]}>All {brand} cars</Text>

      {filters.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {[null, ...filters].map((f) => {
            const active = (filter?.key ?? null) === (f?.key ?? null);
            return (
              <TouchableOpacity
                key={f?.key ?? 'all'}
                style={[
                  styles.pill,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  active && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
                ]}
                onPress={() => setFilter(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.pillText, { color: active ? '#FFFFFF' : colors.fg }]}>
                  {f ? f.label : 'All'}
                  {f?.qty ? <Text style={styles.pillCount}> {f.qty}</Text> : null}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <CarMosaic
        make={brand}
        model={filter?.model}
        generation={filter?.generation}
        header={header}
        emptyTitle={filter ? `No ${brand} ${filter.label}s yet` : `No ${brand}s yet`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2,
  },
  brandTitle:  { fontSize: 26, fontWeight: '800', flexShrink: 1 },
  brandCount:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
  },
  brandCountText: { fontSize: 14, fontWeight: '800' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  noMatch:   { fontSize: 14, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  // Stretched to the tallest tile; each centers its name in the extra height.
  models:    { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 6, gap: 10, alignItems: 'stretch' },
  section:   { fontSize: 17, fontWeight: '800', paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  pills:     { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  pill:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5 },
  pillText:  { fontSize: 13, fontWeight: '700' },
  pillCount: { fontSize: 12, fontWeight: '500', opacity: 0.7 },
});
