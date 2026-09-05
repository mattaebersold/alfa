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
import CarPosterCard from '../../components/cards/CarPosterCard';
import TasksSheet from '../../components/cars/TasksSheet';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useIsPro, useBrandColor } from '../../hooks/useBrandColor';
import { GetProButton, ProUpsellModal } from '../../components/pro/ProUpsell';
import { CAR_LIMIT_BASIC } from '../../constants/limits';
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
    <CarPosterCard
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

  // The limit still exists; it just isn't a chip under the title any more. It
  // surfaces in the one place it can actually bite — the add button, which now
  // opens the upsell instead of a form the server will refuse.
  const [upsell, setUpsell] = useState(false);
  const atLimit = !isPro && cars.length >= CAR_LIMIT_BASIC;
  const addCar = () =>
    atLimit ? setUpsell(true) : (navigation as any).navigate('CarCreate', {});

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
            {/* Heading rides in the list so it scrolls away with the content.
                ScreenHeading itself sits at zero — it's shared with eight other
                screens that supply their own gutter — so the padding is here,
                on the same 12 as the cards below it. */}
            <View style={styles.headingWrap}>
              <ScreenHeading
                title="Garage"
                count={cars.length}
                // Nothing to sell a member who already has it.
                right={!isPro ? <GetProButton onPress={() => setUpsell(true)} /> : undefined}
              />
            </View>
            {/* Full width, because adding a car is the only thing this screen
                asks you to do — as a pill tucked beside the title it read as a
                secondary control on a screen with no primary one. */}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: brand }]}
              onPress={addCar}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Add a car"
            >
              <Plus size={17} color="#000000" strokeWidth={2.6} />
              <Text style={styles.addBtnText}>Add Car</Text>
            </TouchableOpacity>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No cars yet"
            message="Add your first car to get started."
            actionLabel="Add New Car"
            onAction={addCar}
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

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title="Unlimited garage with Pro"
        message={`A basic membership holds ${CAR_LIMIT_BASIC} cars. Pro removes the limit — every car you've owned, kept in one place.`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  headingWrap: { paddingHorizontal: 12 },
  // Squared off to match "Add Content" on a car's own page — the two are the
  // same kind of button and were reading as different ones.
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 10,
  },
  // Black on the brand fill, gold or blue — both are light enough that white
  // would be the unreadable choice.
  addBtnText: { color: '#000000', fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
