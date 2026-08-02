import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import CarCard from '../../components/cards/CarCard';
import TasksSheet from '../../components/cars/TasksSheet';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import type { CarsStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<CarsStackParamList>;

const CAR_LIMIT_BASIC = 3;

function CarCardWithTasks({
  car,
  isPro,
  onTasksPress,
  onEditPress,
}: {
  car: any;
  isPro: boolean;
  onTasksPress: () => void;
  onEditPress: () => void;
}) {
  const { data: tasksData } = useGetCarTasksQuery(car.internal_id, { skip: !isPro });
  const tasks = tasksData?.entries ?? [];
  return (
    <CarCard
      car={car}
      onTasksPress={isPro ? onTasksPress : undefined}
      onEditPress={onEditPress}
      taskCount={isPro ? tasks.filter((t) => !t.completed).length : 0}
    />
  );
}

export default function GarageScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const isPro = useIsPro();
  const headerPad = useHeaderPad();
  const tabBarHeight = useBottomTabBarHeight();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, refetch } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

  const carLimitReached = !isPro && cars.length >= CAR_LIMIT_BASIC;

  const goToTasks = useCallback(
    (carId: string, carTitle: string) => (navigation as any).navigate('CarTasks', { carId, carTitle }),
    [navigation]
  );

  const goToEditCar = useCallback(
    (carId: string) => (navigation as any).navigate('CarCreate', { carId }),
    [navigation]
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <FlatList
        style={{ backgroundColor: colors.cream }}
        data={cars}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <CarCardWithTasks
            car={item}
            isPro={isPro}
            onTasksPress={() =>
              goToTasks(
                item.internal_id,
                [item.year, item.make, item.model].filter(Boolean).join(' ')
              )
            }
            onEditPress={() => goToEditCar(item.internal_id)}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Heading rides in the list so it scrolls away with the content. */}
            <ScreenHeading
              title="Garage"
              count={cars.length}
              right={
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => (navigation as any).navigate('CarCreate', {})}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add Car</Text>
                </TouchableOpacity>
              }
            />
            {/* Upsell only shows once the free tier is full. */}
            {carLimitReached && (
              <View style={styles.header}>
                <TouchableOpacity style={styles.proCtaBtn} onPress={() => {}} activeOpacity={0.8}>
                  <Text style={styles.proCtaText}>Add more — become Pro (coming soon)</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No cars yet"
            message="Add your first car to get started."
            actionLabel="Add New Car"
            onAction={() => (navigation as any).navigate('CarCreate', {})}
          />
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={colors.primaryAlt} />
        }
        contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabBarHeight + 24 }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  proCtaBtn: {
    backgroundColor: colors.pro,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 240,
  },
  // Black on the gold fill, matching the rest of the brand-colored buttons.
  proCtaText: { color: '#000000', fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
