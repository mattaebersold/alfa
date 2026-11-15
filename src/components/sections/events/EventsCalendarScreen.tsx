import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../../theme/Text';
import EventMonthCalendar from '../../society/EventMonthCalendar';
import EventFilters from '../../society/EventFilters';
import EventSearchField from '../../society/EventSearchField';
import { NO_ZIP_NOTE } from '../../ui/LocationFilterRow';
import NoResultsNear from '../../ui/NoResultsNear';
import EventDaySheet from './EventDaySheet';
import { useEventsFilter } from './useEventsFilter';
import { useEventSheet } from '../../../providers/EventSheetProvider';
import { useRefreshControl } from '../../../hooks/useRefreshControl';
import { useColors } from '../../../hooks/useColors';
import { GUTTER } from '../../../constants/config';
import type { SocietyEvent } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/**
 * Events › Calendar: the landing's month calendar as the whole pane, under
 * the same search and filter. A day opens its events in a pane, as on the
 * landing; an event there opens the event.
 */
export default function EventsCalendarScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
  const colors = useColors();
  const { openEventSheet } = useEventSheet();
  const { location, category, setCategory, states, presentCategories, upcoming } = useEventsFilter();
  const [day, setDay] = useState<{ date: Date; events: SocietyEvent[] } | null>(null);
  // The calendar holds its own month query; a pull refreshes the filter's
  // list, and the calendar's goes with it (both provide 'SocietyEvent').
  const refreshControl = useRefreshControl(upcoming.refetch, headerPad);

  return (
    <>
      <ScrollView
        refreshControl={refreshControl}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: bottomPad }}
      >
        {/* Search left, filter right — the landing's row. Raised so the
            search's results drop over the calendar. */}
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
        {location.fellBack && (
          <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
        )}
        {location.others && <NoResultsNear radius={location.radius} style={{ marginTop: 6 }} />}

        <View style={styles.calendar}>
          <EventMonthCalendar
            category={category ?? undefined}
            location={location.params}
            onSelectDay={(date, events) => setDay({ date, events })}
          />
        </View>
      </ScrollView>

      <EventDaySheet
        day={day}
        onClose={() => setDay(null)}
        onOpenEvent={(e) => openEventSheet({ eventId: e.internal_id, occurrenceDate: e.occurrence_date })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  toolsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: GUTTER,
    zIndex: 20, elevation: 20,
  },
  toolsSearch: { flex: 1 },
  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: GUTTER, marginTop: 6 },
  calendar: { marginTop: 12 },
});
