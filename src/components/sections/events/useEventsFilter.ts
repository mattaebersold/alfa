import { useEffect, useState } from 'react';
import { useGetUpcomingEventsQuery, useGetEventRegionsQuery } from '../../../api/apiService';
import { useLocationFilter, useWidenWhenEmpty } from '../../../hooks/useLocationFilter';
import { categoryFor } from '../../../constants/eventTypes';

/** The landing's window — what the filter's type list is drawn from. */
export const UPCOMING_DAYS = 30;

/**
 * The Events landing's filter state (EventsView), for a sub-screen that shows
 * the same filters: location, type, the regions to offer, and which types
 * have anything coming up. Each sub-screen holds its own — they're separate
 * panes, and EventsView's state isn't lifted anywhere to share.
 *
 * Near me falls back and widens exactly as the landing does.
 */
export function useEventsFilter() {
  const location = useLocationFilter();
  const [category, setCategory] = useState<string | null>(null);
  const { data: regionsData } = useGetEventRegionsQuery();
  const regions = regionsData?.regions ?? [];
  const upcoming = useGetUpcomingEventsQuery({ limit: 100, days: UPCOMING_DAYS, ...location.params });
  const { data, isFetching } = upcoming;

  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);
  useWidenWhenEmpty(location, {
    settled: !!data && !isFetching && !data.near_unavailable,
    empty: (data?.entries?.length ?? 0) === 0,
  });

  const all = data?.entries ?? [];
  // Only types with something coming up — EventFilters keeps the selected one.
  const presentCategories = new Set(all.map((e) => categoryFor(e.category).key));

  return { location, category, setCategory, regions, presentCategories, all, upcoming };
}
