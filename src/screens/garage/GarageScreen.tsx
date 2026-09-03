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
import { useIsPro, useBrandColor } from '../../hooks/useBrandColor';
import GarageLimitBadge from '../../components/garage/GarageLimitBadge';
import type { CarsStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<CarsStackParamList>;


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
  const brand = useBrandColor();
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const isPro = useIsPro();
  const headerPad = useHeaderPad();
  const tabBarHeight = useBottomTabBarHeight();
  const onScroll = useHeaderScroll(headerPad);
  const { data, isLoading, refetch } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

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
                  style={[styles.addBtn, { backgroundColor: brand }]}
                  onPress={() => (navigation as any).navigate('CarCreate', {})}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={styles.addBtnText}>Add Car</Text>
                </TouchableOpacity>
              }
            />
            {/* The count and the limit, stated before it's reached rather than
                announced by a button that stops working. Replaces a CTA that
                only appeared once the garage was already full — and whose
                onPress did nothing. */}
            <View style={styles.limitRow}>
              <GarageLimitBadge count={cars.length} isPro={isPro} />
            </View>
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  limitRow: { paddingHorizontal: 16, paddingBottom: 10, marginTop: -2 },
});
