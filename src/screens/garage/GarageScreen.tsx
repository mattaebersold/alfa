import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import CarCard from '../../components/cards/CarCard';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

// Fetches open task count per car without blocking list render
function CarCardWithTasks({
  car,
  onPress,
  onTasksPress,
}: {
  car: any;
  onPress: () => void;
  onTasksPress: () => void;
}) {
  const { data: tasksData } = useGetCarTasksQuery(car.internal_id);
  const tasks = tasksData?.entries ?? [];
  return (
    <CarCard
      car={car}
      onPress={onPress}
      onTasksPress={onTasksPress}
      taskCount={tasks.filter((t) => !t.completed).length}
    />
  );
}

export default function GarageScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { data, isLoading, refetch } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

  const goToCar = useCallback(
    (carId: string) => navigation.navigate('CarDetailModal', { carId }),
    [navigation]
  );

  const goToTasks = useCallback(
    (carId: string, carTitle: string) =>
      navigation.navigate('CarTasks', { carId, carTitle }),
    [navigation]
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={cars}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <CarCardWithTasks
            car={item}
            onPress={() => goToCar(item.internal_id)}
            onTasksPress={() =>
              goToTasks(
                item.internal_id,
                [item.year, item.make, item.model].filter(Boolean).join(' ')
              )
            }
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.count, { color: colors.grey }]}>
              {cars.length} {cars.length === 1 ? 'car' : 'cars'}
            </Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('CarCreate', {})}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Car</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="No cars yet" message="Add your first car to get started." />
        }
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.brg} />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
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
    backgroundColor: Colors.brg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
