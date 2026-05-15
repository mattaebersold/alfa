import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
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
        .filter((b) => b.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    [brands, query]
  );

  // Group by first letter
  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    filtered.forEach((b) => {
      const letter = b[0]?.toUpperCase() ?? '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(b);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search makes..."
          placeholderTextColor={colors.grey}
          autoCapitalize="words"
        />
      </View>

      <FlatList
        data={grouped}
        keyExtractor={([letter]) => letter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState title="No brands found" />}
        renderItem={({ item: [letter, makes] }) => (
          <View>
            <View style={[styles.letterHeader, { backgroundColor: colors.segment }]}>
              <Text style={[styles.letter, { color: colors.grey }]}>{letter}</Text>
            </View>
            {makes.map((make) => (
              <TouchableOpacity
                key={make}
                style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
                onPress={() => navigation.navigate('BrandDetail', { brand: make })}
                activeOpacity={0.7}
              >
                <Text style={[styles.makeName, { color: colors.fg }]}>{make}</Text>
                <Text style={[styles.arrow, { color: colors.grey }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  list:        { paddingBottom: 24 },
  letterHeader:{ paddingHorizontal: 16, paddingVertical: 6 },
  letter:      { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  row:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  makeName:    { fontSize: 15, fontWeight: '600' },
  arrow:       { fontSize: 20 },
});
