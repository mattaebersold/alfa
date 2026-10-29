import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import CarPosterCard from '../cards/CarPosterCard';
import { useGetCarTasksQuery } from '../../api/apiService';
import { useIsPro } from '../../hooks/useBrandColor';
import { taskTally } from './CarTaskList';
import type { GarageCar } from '../../types/api';

/**
 * A car as a garage shows it — the header's garage pane and a profile's
 * garage alike: CarPosterCard's plain look, its counts down the right, and,
 * on your own cars, the add and manage buttons and how many tasks are open.
 *
 * One component so the two garages can't drift apart. Pass the owner's
 * handlers (`onTasksPress`, `onEditPress`) only for your own cars; someone
 * else's is the card alone.
 */
export default function GarageCarCard({ car, onPress, onTasksPress, onEditPress, ratio, featured, summaryOnPress, style }: {
  car: GarageCar;
  /** Where a tap goes. Left out, the card opens the car itself. */
  onPress?: () => void;
  /** Your car's task list — a Pro member's. */
  onTasksPress?: () => void;
  onEditPress?: () => void;
  ratio?: number;
  featured?: boolean;
  /** A tap opens the car's summary panel first rather than the car's page — see CarPosterCard. */
  summaryOnPress?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isPro = useIsPro();
  const own = !!(onTasksPress || onEditPress);
  // Tasks are a Pro member's, on their own cars — nothing to ask otherwise.
  const { data: tasksData } = useGetCarTasksQuery(car.internal_id, { skip: !isPro || !own });
  const { open: openTasks, done: doneTasks, total: allTasks } = taskTally(tasksData?.entries ?? []);

  return (
    <CarPosterCard
      car={car}
      plain
      featured={featured}
      ratio={ratio}
      style={style}
      onPress={onPress}
      summaryOnPress={summaryOnPress}
      onTasksPress={isPro ? onTasksPress : undefined}
      onEditPress={onEditPress}
      taskCount={isPro && own ? openTasks : 0}
      taskDone={doneTasks}
      taskTotal={allTasks}
    />
  );
}
