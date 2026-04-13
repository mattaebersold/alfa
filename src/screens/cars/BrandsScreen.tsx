import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useGetCarBrandsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { CarsScreenProps } from '../../navigation/types';

export default function BrandsScreen({ navigation }: CarsScreenProps<'Brands'>) {
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
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Search size={16} color={Colors.grey} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search makes..."
          placeholderTextColor={Colors.grey}
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
            <View style={styles.letterHeader}>
              <Text style={styles.letter}>{letter}</Text>
            </View>
            {makes.map((make) => (
              <TouchableOpacity
                key={make}
                style={styles.row}
                onPress={() => navigation.navigate('BrandDetail', { brand: make })}
                activeOpacity={0.7}
              >
                <Text style={styles.makeName}>{make}</Text>
                <Text style={styles.arrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.cream },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.fg },
  list:        { paddingBottom: 24 },
  letterHeader:{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: Colors.segment },
  letter:      { fontSize: 13, fontWeight: '800', color: Colors.grey, letterSpacing: 0.5 },
  row:         {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  makeName:    { fontSize: 15, fontWeight: '600', color: Colors.fg },
  arrow:       { fontSize: 20, color: Colors.grey },
});
