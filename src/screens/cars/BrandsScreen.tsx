import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Car } from 'lucide-react-native';
import GarageThumbs from '../../components/cars/GarageThumbs';
import { useGetCarBrandSummariesQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { COMMON_RADIUS } from '../../constants/radius';

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
        data={filtered}
        keyExtractor={(b) => b.make_handle}
        numColumns={2}
        columnWrapperStyle={styles.rowWrap}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<EmptyState title="No brands found" />}
        renderItem={({ item: b }) => {
          const photos = b.sample_photos ?? [];
          const models = b.model_count ?? 0;
          return (
            <TouchableOpacity
              style={[styles.card, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('BrandDetail', { brand: b.make })}
              activeOpacity={0.85}
              accessibilityLabel={`${b.make}${models ? `, ${models} ${models === 1 ? 'model' : 'models'}` : ''}`}
            >
              {/* A few of the make's own cars, stacked like the header's garage
                  button — a different handful each visit. The car glyph only
                  when nothing of this make has a public photo yet. */}
              {photos.length > 0 ? (
                <GarageThumbs
                  cars={photos.map((filename) => ({ internal_id: filename, profile_image: filename }) as any)}
                  max={3}
                  size={44}
                />
              ) : (
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryAlt + '22' }]}>
                  <Car size={20} color={colors.primaryAlt} />
                </View>
              )}
              <Text style={[styles.makeName, { color: colors.fg }]} numberOfLines={2}>{b.make}</Text>
              {/* How many distinct models of it are on the site. */}
              {models > 0 && (
                <View style={[styles.countBubble, { backgroundColor: colors.primaryAlt }]}>
                  <Text style={styles.countText}>{models}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
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
  // A shade under the card colour, like the rest of the car screens' cards.
  card:        {
    flex: 1, borderRadius: COMMON_RADIUS, borderWidth: 1,
    backgroundColor: '#171717',
    paddingVertical: 20, paddingHorizontal: 14,
    alignItems: 'center', gap: 10, marginBottom: 10,
  },
  iconWrap:    {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  makeName:    { fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  countBubble: {
    position: 'absolute', top: 8, right: 8,
    minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:   { fontSize: 12, fontWeight: '800', color: '#000000' },
});
