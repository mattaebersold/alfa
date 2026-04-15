import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCarsQuery } from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { GarageCar } from '../../types/api';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function CarRow({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.85}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, { backgroundColor: colors.secondary }]} />
      }
      <View style={styles.info}>
        <Text style={[styles.carName, { color: colors.fg }]} numberOfLines={1}>
          {car.year} {car.make} {car.model}
        </Text>
        {car.user && (
          <View style={styles.ownerRow}>
            <Avatar filename={car.user.gallery?.[0]?.filename} name={car.user.firstName ?? '?'} size={18} />
            <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>
              {car.user.firstName} {car.user.lastName}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupCarsScreen({ route }: GroupsScreenProps<'GroupCars'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);

  // Note: Horacio's garage endpoint supports group_id filtering
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

  const handleRefresh = useCallback(() => { setPage(0); setAllCars([]); }, []);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allCars.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allCars.length]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={allCars}
        keyExtractor={(c) => c.internal_id}
        renderItem={({ item }) => (
          <CarRow
            car={item}
            onPress={() => navigation.navigate('CarDetailModal', { carId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No cars in this group yet" />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.brg} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  list:             { flexGrow: 1, paddingBottom: 24 },
  row:              {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  thumb:            { width: 72, height: 54, borderRadius: 8 },
  info:             { flex: 1 },
  carName:          { fontSize: 14, fontWeight: '700' },
  ownerRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  ownerName:        { fontSize: 12, flex: 1 },
});
