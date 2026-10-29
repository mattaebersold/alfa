import React, { useState, useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { Text } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from '../../components/ui/AppImage';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useGetCarTasksQuery, useGetCarWithUserQuery, apiService } from '../../api/apiService';
import CarTaskList, { taskTally, type CarTaskListHandle } from '../../components/cars/CarTaskList';
import TaskProgressPie from '../../components/cars/TaskProgressPie';
import { useAppDispatch } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { carHeroUrl } from '../../utils/image';
import type { AppScreenProps } from '../../navigation/types';
import { measureOrigin } from '../../components/ui/SummaryModal';
import { ss } from '../../styles/shared';
import { COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A car's tasks, as a page: the car's photo and "Tasks" over the list, a pie
 * of how much is done, and a + that adds one to General. Each section's +
 * adds one there. The list itself — sections, rows,
 * every menu — is CarTaskList, shared with the all-cars pane.
 *
 * The header is part of the page and scrolls away with it, on the app's own
 * ground rather than a bar of its own.
 */
export default function CarTasksScreen({ route, navigation }: AppScreenProps<'CarTasks'>) {
  const { carId, carTitle } = route.params;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const listRef = useRef<CarTaskListHandle>(null);
  const addRef = useRef<View>(null);

  const { data: car } = useGetCarWithUserQuery(carId);
  const carPhoto = carHeroUrl(car);
  const { data: tasksData, refetch } = useGetCarTasksQuery(carId);
  const { done, total } = taskTally(tasksData?.entries ?? []);

  // Pull to refresh. The list is a shared to-do — a co-owner can tick things
  // off from their own phone, and nothing pushes that here.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      dispatch(apiService.util.invalidateTags([{ type: 'CarTask', id: `${carId}-archived` }]));
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, refetch, carId]);

  return (
    <View style={[ss.fill, { backgroundColor: colors.bg }]}>
      {/* Runs to the foot of the screen, under Android's buttons and the
          home indicator, and pads its end clear of them. */}
      <ScrollView
        style={ss.fill}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.pro} />}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          {/* Dedicated back control — returns to the car this list belongs to. */}
          <TouchableOpacity
            style={[styles.backCircle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back to car"
          >
            <ArrowLeft size={20} color={colors.fg} />
          </TouchableOpacity>
          {/* The car, as its photo, in place of its name under the title. */}
          {carPhoto ? (
            <Image source={{ uri: carPhoto }} style={styles.carPhoto} contentFit="cover" transition={150} accessibilityLabel={carTitle} />
          ) : null}
          <Text style={[styles.topBarTitle, { color: colors.fg }]} numberOfLines={1}>Tasks</Text>
          <View style={ss.fill} />
          {/* How much is done, as a pie, rather than "x open · y completed". */}
          {total > 0 && (
            <View accessible accessibilityLabel={`${done} of ${total} tasks done`}>
              <TaskProgressPie completed={done} total={total} size={30} color={colors.pro} solid />
            </View>
          )}
          {/* A new task, on General — the form grows out of this. */}
          <TouchableOpacity
            ref={addRef}
            style={[styles.addBtn, { backgroundColor: colors.pro }]}
            onPress={() => measureOrigin(addRef.current, (o) => listRef.current?.openNewTask('general', o))}
            hitSlop={8}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Add task"
          >
            <Plus size={20} color={COLOR_BLACK} strokeWidth={3} />
          </TouchableOpacity>
        </View>

        <CarTaskList ref={listRef} carId={carId} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 4,
  },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  carPhoto:    { width: 34, height: 34, borderRadius: 17 },
  addBtn:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { fontSize: 22, fontFamily: FONT_INTER.bold, letterSpacing: -0.3, flexShrink: 1 },
  list: { flexGrow: 1 },
});
