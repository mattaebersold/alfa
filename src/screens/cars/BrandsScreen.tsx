import React, { useState, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import MakeTile from '../../components/cars/MakeTile';
import { useGetCarBrandSummariesQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { FONT_INTER } from '../../constants/fonts';

export default function BrandsScreen({ navigation }: CarsScreenProps<'Brands'>) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const { data: brands = [], isLoading, refetch } = useGetCarBrandSummariesQuery();
  const refreshControl = useRefreshControl(refetch);

  const filtered = useMemo(
    () =>
      brands
        .filter((b) => b.make.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.make.localeCompare(b.make)),
    [brands, query]
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Filter by make */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Filter by make..."
          placeholderTextColor={colors.grey}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color={colors.grey} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        refreshControl={refreshControl}
        // An odd count gets a blank slot at the end, so the last tile keeps
        // its column's width instead of stretching across both.
        data={filtered.length % 2 ? [...filtered, null] : filtered}
        keyExtractor={(b) => b?.make_handle ?? 'spacer'}
        numColumns={2}
        columnWrapperStyle={styles.rowWrap}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<EmptyState title="No brands found" />}
        renderItem={({ item: b }) => !b ? <View style={styles.tile} /> : (
          // A few of the make's own cars, stacked like the header's garage
          // button — a different handful each visit — its name, and how many
          // distinct models of it are on the site.
          <MakeTile
            name={b.make}
            photos={b.sample_photos}
            count={b.model_count}
            countLabel={b.model_count ? `${b.model_count} ${b.model_count === 1 ? 'model' : 'models'}` : undefined}
            style={styles.tile}
            onPress={() => navigation.navigate('BrandDetail', { brand: b.make })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  grid:        { paddingHorizontal: 8, paddingBottom: 120 },
  rowWrap:     { gap: 10, paddingHorizontal: 4 },
  // `minWidth: 0` so a long name wraps inside its column rather than widening
  // it — the two columns stay even whatever the makes are called.
  tile:        { flex: 1, minWidth: 0, marginBottom: 10 },
});
