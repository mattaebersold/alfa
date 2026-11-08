import React from 'react';
import { useGetFollowedCarsQuery } from '../../../api/apiService';
import CarColumns from './CarColumns';
import type { SectionScreenProps } from '../types';

/**
 * Cars › Following: the cars you follow — the dashboard's Followed Cars, as a
 * screen. The endpoint returns up to fifty, whole (see getFollowedCars).
 */
export default function FollowedCarsScreen(props: SectionScreenProps) {
  const { data, isLoading, refetch } = useGetFollowedCarsQuery();
  return (
    <CarColumns
      {...props}
      cars={data?.entries ?? []}
      isLoading={isLoading}
      emptyTitle="You're not following any cars yet"
      onRefresh={refetch}
    />
  );
}
