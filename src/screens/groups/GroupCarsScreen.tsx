import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../../components/ui/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetCarsQuery } from '../../api/apiService';
import { carHeroUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import UserByline from '../../components/members/UserByline';
import CarSummaryModal from '../../components/cars/CarSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { GroupsScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';
import { ss } from '../../styles/shared';
import { FONT_INTER } from '../../constants/fonts';

function CarRow({ car, onPress }: { car: GarageCar; onPress: (origin: SummaryOrigin | null) => void }) {
  const colors = useColors();
  const hero = carHeroUrl(car);
  return (
    <SummaryTouchable style={[ss.listRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress}>
      <Image
        source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
        style={styles.thumb}
        contentFit="cover"
      />
      <View style={styles.info}>
        <Text style={[styles.carName, { color: colors.fg }]} numberOfLines={1}>
          {car.year} {car.make} {car.model}
        </Text>
        {car.user && (
          <UserByline
            user={car.user}
            size={18}
            gap={5}
            color={colors.grey}
            nameStyle={styles.ownerName}
            style={styles.ownerRow}
          />
        )}
      </View>
    </SummaryTouchable>
  );
}

export default function GroupCarsScreen({ route }: GroupsScreenProps<'GroupCars'>) {
  const { groupId } = route.params;
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [allCars, setAllCars] = useState<GarageCar[]>([]);
  // Tapping a car summarises it here rather than pushing the car's page — see
  // CarSummaryModal. The full page is one button away inside it.
  const [summary, setSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);

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
    <SafeAreaView style={ss.fill} edges={['bottom']}>
      <FlatList
        data={allCars}
        keyExtractor={(c) => c.internal_id}
        renderItem={({ item }) => (
          <CarRow
            car={item}
            onPress={(origin) => setSummary({ carId: item.internal_id, origin })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No cars in this group yet" />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />

      <CarSummaryModal
        carId={summary?.carId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:             { flexGrow: 1, paddingBottom: 24 },
  thumb:            { width: 72, height: 54, borderRadius: 8 },
  info:             { flex: 1 },
  carName:          { fontSize: 14, fontFamily: FONT_INTER.bold },
  ownerRow:         { marginTop: 4 },
  ownerName:        { fontSize: 12, fontFamily: FONT_INTER.regular },
});
