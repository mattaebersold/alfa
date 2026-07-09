import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, Car } from 'lucide-react-native';
import { useGetCarBrandsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import { ss } from '../../styles/shared';

export default function BrandsScreen({ navigation }: CarsScreenProps<'Brands'>) {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const { data: brands = [], isLoading } = useGetCarBrandsQuery();

  const filtered = useMemo(
    () =>
      brands
        .filter((b) => b.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
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
        data={filtered}
        keyExtractor={(make) => make}
        numColumns={2}
        columnWrapperStyle={styles.rowWrap}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<EmptyState title="No brands found" />}
        renderItem={({ item: make }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('BrandDetail', { brand: make })}
            activeOpacity={0.85}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primaryAlt + '22' }]}>
              <Car size={20} color={colors.primaryAlt} />
            </View>
            <Text style={[styles.makeName, { color: colors.fg }]} numberOfLines={2}>{make}</Text>
          </TouchableOpacity>
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
  card:        {
    flex: 1, borderRadius: 14, borderWidth: 1,
    paddingVertical: 20, paddingHorizontal: 14,
    alignItems: 'center', gap: 10, marginBottom: 10,
  },
  iconWrap:    {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  makeName:    { fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
