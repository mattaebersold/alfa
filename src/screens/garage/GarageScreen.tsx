import React, { useCallback, useState, useRef } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetUserGarageQuery, useGetCarTasksQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import CarPosterCard from '../../components/cards/CarPosterCard';
import TasksSheet from '../../components/cars/TasksSheet';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
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
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
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
        ref={scrollRef}
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
                inline
                // A basic membership is capped, so the count says what's left
                // as well as what's there. Pro has no cap to count against.
                count={isPro ? cars.length : `${cars.length}/${CAR_LIMIT_BASIC}`}
                right={
                  <View style={styles.headingActions}>
                    {/* Nothing to sell a member who already has it. */}
                    {!isPro && <GetProButton onPress={() => setUpsell(true)} />}
                    <HeadingActionButton label="Add Car" onPress={addCar} accessibilityLabel="Add a car" />
                  </View>
                }
              />
            </View>
          </>
        }
        ListEmptyComponent={
          // Just the line. The header's own Add Car button sits directly above
          // this, so a second one here was the same control twice.
          <EmptyState title="No cars yet" />
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
  headingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
