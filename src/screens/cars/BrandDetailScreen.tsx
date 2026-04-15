import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetCarsQuery, useGetCarModelsQuery } from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';

export default function BrandDetailScreen({ route, navigation }: CarsScreenProps<'BrandDetail'>) {
  const { brand } = route.params;
  const colors = useColors();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);

  const { data: models = [] } = useGetCarModelsQuery(brand);
  const { data, isFetching, isLoading } = useGetCarsQuery({
    page,
    limit: 12,
    make: brand.toLowerCase(),
    model: selectedModel?.toLowerCase() ?? undefined,
  });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllCars(data.entries);
      else setAllCars((prev) => {
        const ids = new Set(prev.map((c) => c.internal_id));
        return [...prev, ...data.entries.filter((c) => !ids.has(c.internal_id))];
      });
    }
  }, [data, page]);

  const handleModelChange = (model: string | null) => {
    setSelectedModel(model);
    setPage(0);
    setAllCars([]);
  };

  const handleRefresh = useCallback(() => {
    setPage(0);
    setAllCars([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allCars.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allCars.length]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={[]}>
      {/* Model filter chips */}
      {models.length > 0 && (
        <View>
          <FlatList
            data={[{ key: null, label: 'All' }, ...models.map((m) => ({ key: m, label: m }))]}
            keyExtractor={(item) => item.label}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modelChips}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.card },
                  selectedModel === item.key && styles.chipActive,
                ]}
                onPress={() => handleModelChange(item.key)}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.fg },
                  selectedModel === item.key && styles.chipTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Cars grid */}
      <FlatList
        data={allCars}
        keyExtractor={(item) => item.internal_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.brg} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => {
          const hero =
            firstGalleryUrl(item.gallery) ??
            (item.profile_image ? imageUrl(item.profile_image) : null);
          return (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => navigation.navigate('CarDetail', { carId: item.internal_id })}
              activeOpacity={0.9}
            >
              <View style={styles.cardImageContainer}>
                {hero ? (
                  <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
                ) : (
                  <View style={[styles.cardImage, { backgroundColor: colors.secondary }]} />
                )}
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
                  {item.year} {item.make} {item.model}
                </Text>
                {item.user && (
                  <View style={styles.ownerRow}>
                    <Avatar
                      filename={item.user.gallery?.[0]?.filename}
                      name={item.user.firstName ?? '?'}
                      size={18}
                    />
                    <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>
                      {item.user.firstName} {item.user.lastName}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={Colors.brg} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState title={`No ${brand}s yet`} message="Be the first to add one." />
          )
        }
        ListFooterComponent={
          isFetching && page > 0 ? (
            <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  modelChips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: Colors.brg, borderColor: Colors.brg },
  chipText:   { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  list:  { paddingHorizontal: 8, paddingBottom: 24 },
  row:   { gap: 8, marginBottom: 8 },
  card:  {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  cardImageContainer: { width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  cardInfo:  { padding: 8 },
  carTitle:  { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  ownerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { fontSize: 11, flex: 1 },
});
