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
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';

export default function BrandDetailScreen({ route, navigation }: CarsScreenProps<'BrandDetail'>) {
  const { brand } = route.params;
  const colors = useColors();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);

  const { data: models = [] } = useGetCarModelsQuery(brand);
  const selectedModelHandle = selectedModel?.toLowerCase().replace(/ /g, '-') ?? undefined;
  const { data, isFetching, isLoading } = useGetCarsQuery({
    page,
    limit: 12,
    make: brand.toLowerCase(),
    model: selectedModelHandle,
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
    setSelectedModel(model === selectedModel ? null : model);
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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Brand title */}
      <View style={styles.brandHeader}>
        <Text style={[styles.brandTitle, { color: colors.fg }]}>{brand}</Text>
        {data?.total != null && (
          <Text style={[styles.brandCount, { color: colors.grey }]}>
            {data.total} {data.total === 1 ? 'car' : 'cars'}
          </Text>
        )}
      </View>

      {/* Model filter chips */}
      {models.length > 0 && (
        <View>
          <FlatList
            data={[{ model: 'All', model_handle: null as any, qty: data?.total ?? 0 }, ...models]}
            keyExtractor={(item) => item.model}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modelChips}
            renderItem={({ item }) => {
              const isAll = item.model_handle === null;
              const active = isAll ? selectedModel === null : selectedModel === item.model;
              return (
                <TouchableOpacity
                  style={[
                    styles.chip,
                    { borderColor: colors.border, backgroundColor: colors.card },
                    active && styles.chipActive,
                  ]}
                  onPress={() => handleModelChange(isAll ? null : item.model)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: colors.fg },
                    active && styles.chipTextActive,
                  ]}>
                    {item.model}
                    {item.qty > 0 && (
                      <Text style={[styles.chipCount, active && styles.chipTextActive]}>
                        {' '}({item.qty})
                      </Text>
                    )}
                  </Text>
                </TouchableOpacity>
              );
            }}
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
          <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />
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
              onPress={() => (navigation as any).navigate('CarDetail', { carId: item.internal_id })}
              activeOpacity={0.9}
            >
              <View style={styles.cardImageContainer}>
                <Image
                  source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
                  style={styles.cardImage}
                  contentFit="cover"
                />
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
                  {item.year} {item.make} {item.model}
                </Text>
                {item.user && (
                  <View style={styles.ownerRow}>
                    <Avatar
                      filename={item.user.gallery?.[0]?.filename}
                      name={item.user.username ?? '?'}
                      size={18}
                    />
                    <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>
                      @{item.user.username}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
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
  brandHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },
  brandTitle:  { fontSize: 26, fontWeight: '800' },
  brandCount:  { fontSize: 13, fontWeight: '600', marginTop: 2 },
  modelChips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1.5,
  },
  chipActive: { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
  chipText:      { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  chipCount:     { fontSize: 12, fontWeight: '400', opacity: 0.75 },
  list:  { paddingHorizontal: 8, paddingBottom: 120 },
  row:   { gap: 8, marginBottom: 8 },
  card:  {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImageContainer: { width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  cardInfo:  { padding: 8 },
  carTitle:  { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  ownerRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { fontSize: 11, flex: 1 },
});
