import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/ui/AppHeader';
import FeaturedCarsRow from '../../components/cars/FeaturedCarsRow';
import { useGetCarsQuery, useGetUserByIdQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import type { CarsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';

function CarGridItem({ item, onPress }: { item: GarageCar; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(item.gallery) ?? (item.profile_image ? `https://partstash-ghia-images.s3.us-west-2.amazonaws.com/${item.profile_image}` : null);
  const { data: owner } = useGetUserByIdQuery(item.user_id, { skip: !item.user_id });
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardImageContainer}>
        {hero
          ? <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
          : <View style={[styles.cardImage, { backgroundColor: colors.secondary }]} />
        }
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
          {item.year} {item.make} {item.model}
        </Text>
        {owner && (
          <View style={styles.ownerRow}>
            <Avatar filename={owner.gallery?.[0]?.filename} name={owner.username ?? '?'} size={20} />
            <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>@{owner.username}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function CarsScreen({ navigation }: CarsScreenProps<'Cars'>) {
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isFetching, isLoading } = useGetCarsQuery({ page, limit: 12 });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllCars(data.entries);
      else setAllCars((prev) => {
        const ids = new Set(prev.map((c) => c.internal_id));
        return [...prev, ...data.entries.filter((c) => !ids.has(c.internal_id))];
      });
    }
  }, [data, page]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    setRefreshing(false);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allCars.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allCars.length]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        data={allCars}
        keyExtractor={(item) => item.internal_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <FeaturedCarsRow onCarPress={(id) => (navigation as any).navigate('CarDetailModal', { carId: id })} />
            <TouchableOpacity style={styles.brandsBtn} onPress={() => navigation.navigate('Brands')}>
              <Text style={styles.brandsBtnText}>Browse by Brand →</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <CarGridItem
            item={item}
            onPress={() => (navigation as any).navigate('CarDetailModal', { carId: item.internal_id })}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 40 }} />
          ) : (
            <EmptyState title="No cars yet" message="Be the first to add your ride." />
          )
        }
        ListFooterComponent={
          isFetching && page > 0 ? (
            <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  brandsBtn: {
    marginHorizontal: 12,
    marginVertical: 10,
    backgroundColor: colors.primaryAlt,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  brandsBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 8, paddingBottom: 20 },
  row: { gap: 8, marginBottom: 8 },
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImageContainer: { width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  cardInfo: { padding: 8 },
  carTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerName: { fontSize: 11, flex: 1 },
});
