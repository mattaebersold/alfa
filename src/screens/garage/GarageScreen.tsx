import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import AppHeader from '../../components/ui/AppHeader';
import CarCard from '../../components/cards/CarCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { CarsStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<CarsStackParamList>;

// Fetches open task count per car without blocking list render
function CarCardWithTasks({
  car,
  onTasksPress,
  onEditPress,
}: {
  car: any;
  onTasksPress: () => void;
  onEditPress: () => void;
}) {
  const { data: tasksData } = useGetCarTasksQuery(car.internal_id);
  const tasks = tasksData?.entries ?? [];
  return (
    <CarCard
      car={car}
      onTasksPress={onTasksPress}
      onEditPress={onEditPress}
      taskCount={tasks.filter((t) => !t.completed).length}
    />
  );
}

export default function GarageScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { data, isLoading, refetch } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

  const goToTasks = useCallback(
    (carId: string, carTitle: string) =>
      (navigation as any).navigate('CarTasks', { carId, carTitle }),
    [navigation]
  );

  const goToEditCar = useCallback(
    (carId: string) => (navigation as any).navigate('CarCreate', { carId }),
    [navigation]
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <FlatList
        style={{ backgroundColor: colors.cream }}
        data={cars}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <CarCardWithTasks
            car={item}
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
          <View style={styles.header}>
            <Text style={[styles.count, { color: colors.grey }]}>
              {cars.length} {cars.length === 1 ? 'car' : 'cars'}
            </Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => (navigation as any).navigate('CarCreate', {})}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Car</Text>
            </TouchableOpacity>
          </View>
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
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  count: { fontSize: 14, fontWeight: '600' },
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
});
