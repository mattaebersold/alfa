import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { skipToken } from '@reduxjs/toolkit/query';
import { EventsMapView, mappableEvents } from '../../society/EventsMap';
import EventFilters from '../../society/EventFilters';
import EventSearchField from '../../society/EventSearchField';
import SubTabs from '../../ui/SubTabs';
import EmptyState from '../../ui/EmptyState';
import { useEventsFilter, UPCOMING_DAYS } from './useEventsFilter';
import { useGetUpcomingEventsQuery } from '../../../api/apiService';
import { useEventSheet } from '../../../providers/EventSheetProvider';
import { categoryFor } from '../../../constants/eventTypes';
import { GUTTER } from '../../../constants/config';
import { ss } from '../../../styles/shared';
import type { SectionScreenProps } from '../types';

/** The map's date windows, in days — EventsView's map sheet's. */
const MAP_WINDOWS = [7, 30, 90, 180] as const;
type MapWindow = typeof MAP_WINDOWS[number];
const MAP_WINDOW_OPTIONS = MAP_WINDOWS.map((d) => ({
  key: String(d) as `${MapWindow}`,
  label: d === 180 ? 'Next 6 months' : `Next ${d} days`,
}));

/**
 * Events › Map: the landing's map sheet as the whole pane — the map runs the
 * full height, under the floating header, with the search, filter and date
 * window just below the header and a tapped pin's cards just above the tab
 * bar. Nothing scrolls, so `onScroll` goes unused and the header stays put.
 */
export default function EventsMapScreen({ headerPad, bottomPad }: SectionScreenProps) {
  const { openEventSheet } = useEventSheet();
  const { location, category, setCategory, states, presentCategories, all } = useEventsFilter();
  const [days, setDays] = useState<MapWindow>(UPCOMING_DAYS);

  // The 30-day window is the filter's own list; any other is its own fetch,
  // a longer one asking for more (as in EventsView).
  const { data: windowData, isFetching } = useGetUpcomingEventsQuery(
    days === UPCOMING_DAYS
      ? skipToken
      : { limit: days > UPCOMING_DAYS ? 300 : 100, days, ...location.params },
  );
  const inWindow = days === UPCOMING_DAYS ? all : (windowData?.entries ?? all);
  const mapped = mappableEvents(category ? inWindow.filter((e) => categoryFor(e.category).key === category) : inWindow);

  return (
    <View style={ss.fill}>
      <EventsMapView
        events={mapped}
        // No sheet to close first here: straight to the event.
        onOpenEvent={(e) => openEventSheet({ eventId: e.internal_id, occurrenceDate: e.occurrence_date })}
        topInset={headerPad + 6}
        bottomInset={bottomPad + 8}
        style={ss.fill}
        tools={(
          <>
            <View style={styles.toolsRow}>
              <EventSearchField style={styles.toolsSearch} onPick={(eventId) => openEventSheet({ eventId })} />
              <EventFilters
                location={location}
                states={states}
                category={category}
                onCategory={setCategory}
                presentCategories={presentCategories}
                compact
              />
            </View>
            <View style={[styles.windows, isFetching && { opacity: 0.6 }]}>
              <SubTabs
                options={MAP_WINDOW_OPTIONS}
                value={String(days) as `${MapWindow}`}
                onChange={(k) => setDays(Number(k) as MapWindow)}
                tone="grey"
              />
            </View>
            {/* The map draws nothing without a pin to frame. */}
            {mapped.length === 0 && !isFetching && (
              <EmptyState title="No events to map" message="Nothing with an address in this window." />
            )}
          </>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: GUTTER,
    zIndex: 20, elevation: 20,
  },
  toolsSearch: { flex: 1 },
  windows: { marginTop: 8 },
});
