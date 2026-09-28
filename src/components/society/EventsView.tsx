import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '@ors/kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import SharedModal from '../../components/ui/SharedModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import EventCard from '../../components/cards/EventCard';
import { UpcomingEventCard, UPCOMING_CARD_WIDTH } from '../../components/cards/UpcomingCard';
import EventMonthCalendar from '../../components/society/EventMonthCalendar';
import RallyCarousel from '../../components/society/RallyCarousel';
import { EventsMapTile, EventsMapSheet, mappableEvents } from '../../components/society/EventsMap';
import { useGetUpcomingEventsQuery, useGetEventRegionsQuery } from '../../api/apiService';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { NO_ZIP_NOTE } from '../../components/ui/LocationFilterRow';
import EventFilters from '../../components/society/EventFilters';
import EventSearchField from './EventSearchField';
import { GUTTER } from '../../constants/config';
import { collapseMultiDay } from '../../constants/eventTypes';
import { useColors } from '../../hooks/useColors';
import { categoryFor } from '../../constants/eventTypes';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { ss } from '../../styles/shared';
import type { SocietyEvent } from '../../types/api';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { FONT_INTER } from '../../constants/fonts'

// Shared with the feed's row, so an event is one size in both places.
const CARD_WIDTH = UPCOMING_CARD_WIDTH;
/** How far ahead the Upcoming carousel looks. */
const UPCOMING_DAYS = 30;
/** Cards in the carousel, once filtered. */
const UPCOMING_SHOWN = 20;

/**
 * Events: the next 30 days as a carousel, then the month calendar. Tapping a
 * day opens the day's stack; tapping an event there closes the sheet and opens
 * the detail screen.
 *
 * Not a screen of its own any more: it's the home screen's Events tab, shown
 * under that screen's header. `headerPad` is the space the header takes
 * (content starts under it), and `onScroll` is the header's hide-on-scroll
 * handler.
 */
export function EventsView({ headerPad, onScroll, scrollRef: givenRef }: {
  headerPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** For a host that needs to move the scroll itself — the home screen's jump to the top. */
  scrollRef?: React.RefObject<ScrollView | null>;
}) {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const ownRef = useRef<ScrollView>(null);
  const scrollRef = givenRef ?? ownRef;
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { openEventSheet } = useEventSheet();
  const [category, setCategory] = useState<string | null>(null);
  const [daySheet, setDaySheet] = useState<{ date: Date; events: SocietyEvent[] } | null>(null);
  // iOS won't present a screen while a modal is dismissing, so the tapped event
  // is held until the sheet is fully gone.
  const [pendingEvent, setPendingEvent] = useState<SocietyEvent | null>(null);
  /** The map of upcoming events, in a sheet over this screen. */
  const [mapOpen, setMapOpen] = useState(false);

  // A rolling 30-day window rather than the calendar month: on the 28th, "the
  // rest of this month" is two days of events and the carousel looks abandoned.
  //
  // Fetched whole and filtered here, rather than asking the server per
  // category: the chips need to know which categories have anything in the
  // window at all, and that's only answerable from the unfiltered list. 100 is
  // the server's cap, and far more occurrences than a month holds.
  // Location narrows on the server (a region is a query, "near me" a distance
  // from the member's saved zip); type is filtered here, as above. Both feed
  // the carousel and the calendar below, so they always agree.
  const location = useLocationFilter();
  const { data: regionsData } = useGetEventRegionsQuery();
  const regions = regionsData?.regions ?? [];
  const { data, isLoading, isFetching, refetch } = useGetUpcomingEventsQuery(
    { limit: 100, days: UPCOMING_DAYS, ...location.params },
  );

  // Near me with nothing to measure from — no location shared and no saved
  // zip — falls back to everything rather than an empty screen.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);
  const refreshControl = useRefreshControl(refetch, headerPad);
  const all = data?.entries ?? [];
  const upcoming = collapseMultiDay(
    category ? all.filter((e) => categoryFor(e.category).key === category) : all,
  ).slice(0, UPCOMING_SHOWN);

  // The same window and filters as the carousel, minus anything with no
  // address to pin — so the map and the cards above it always agree.
  const mapped = mappableEvents(category ? all.filter((e) => categoryFor(e.category).key === category) : all);

  // Only categories with something coming up — a pill that filters to "Nothing
  // in the next 30 days" is a dead end. EventFilters keeps the selected one.
  const presentCategories = new Set(all.map((e) => categoryFor(e.category).key));

  const openEvent = (event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date });

  return (
    <>
      <ScrollView
        ref={scrollRef}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: 88 + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Upcoming carousel — the next 30 days, from today forward */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.fg }]}>Upcoming Events</Text>
          <Text style={[styles.sectionSub, { color: colors.grey }]}>
            Next {UPCOMING_DAYS} days
          </Text>
        </View>

        {isLoading ? (
          <Spinner />
        ) : upcoming.length === 0 ? (
          <EmptyState title={`Nothing in the next ${UPCOMING_DAYS} days`} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            // Dimmed while a filter change is being fetched, so the cards on
            // screen visibly belong to the previous choice until the new ones land.
            style={isFetching ? { opacity: 0.5 } : undefined}
            contentContainerStyle={styles.carousel}
            snapToInterval={CARD_WIDTH + 12}
            snapToAlignment="start"
            decelerationRate="fast"
          >
            {upcoming.map((event, i) => (
              <UpcomingEventCard
                key={`${event.internal_id}-${event.day}-${i}`}
                event={event}
                width={CARD_WIDTH}
                showRegion
                onPress={openEvent}
              />
            ))}
            <RowEndSpacer />
          </ScrollView>
        )}

        {/* The filter, under the carousel rather than above it: the next few
            weeks lead the screen, and the filter follows for whoever wants to
            narrow them. It still filters everything — the carousel above, the
            map and the calendar below. */}
        {/* Search an event by name on the left, the filter on the right —
            the photography map's pattern. Raised above the map tile below so
            the search's results drop over it. */}
        <View style={[styles.filtersBelow, styles.toolsRow]}>
          <EventSearchField
            style={styles.toolsSearch}
            onPick={(eventId) => openEventSheet({ eventId })}
          />
          <EventFilters
            location={location}
            regions={regions}
            category={category}
            onCategory={setCategory}
            presentCategories={presentCategories}
            compact
          />
        </View>
        {/* Stays on the screen rather than in the panel: it explains the list
            you're looking at, not an option you're choosing. */}
        {location.fellBack && (
          <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
        )}

        {/* The same events, on a map — a sheet over this screen. Nothing when
            none of them has an address to put a pin on. */}
        <EventsMapTile events={mapped} days={UPCOMING_DAYS} onPress={() => setMapOpen(true)} />

        {/* Month calendar */}
        <View style={{ marginTop: 24 }}>
          <EventMonthCalendar
            category={category ?? undefined}
            location={location.params}
            onSelectDay={(date, events) => setDaySheet({ date, events })}
          />
        </View>

        <RallyCarousel />
      </ScrollView>

      <EventsMapSheet
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        events={mapped}
        // Closed first, then opened — iOS won't present the event over a
        // sheet that's still going. Same handoff as the day sheet below.
        onOpenEvent={(e) => { setPendingEvent(e); setMapOpen(false); }}
        onDismissed={() => {
          if (pendingEvent) {
            const event = pendingEvent;
            setPendingEvent(null);
            openEvent(event);
          }
        }}
      />

      {/* A day's events */}
      <SharedModal
        visible={!!daySheet}
        onClose={() => setDaySheet(null)}
        onDismissed={() => {
          if (pendingEvent) {
            const event = pendingEvent;
            setPendingEvent(null);
            openEvent(event);
          }
        }}
        title={
          daySheet
            ? daySheet.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : ''
        }
      >
        {/* Scrolls: each card is as tall as its photo, so a busy Saturday runs
            past the sheet, and the sheet clips whatever it's handed. */}
        <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
          {(daySheet?.events ?? []).map((event, i) => (
            <EventCard
              key={`${event.internal_id}-${i}`}
              event={event}
              onPress={(e) => { setPendingEvent(e); setDaySheet(null); }}
            />
          ))}
        </ScrollView>
      </SharedModal>

    </>
  );
}

const styles = StyleSheet.create({

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: GUTTER, marginBottom: 6 },

  filtersBelow: { marginTop: 12 },
  toolsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: GUTTER,
    zIndex: 20, elevation: 20,
  },
  toolsSearch: { flex: 1 },
  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: GUTTER, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontFamily: FONT_INTER.bold },
  sectionSub:   { fontSize: 13, fontFamily: FONT_INTER.semibold },

  // Top-aligned, so a card is never stretched to a neighbour's height.
  carousel: { paddingLeft: GUTTER, gap: 12, alignItems: 'flex-start' },

  sheetBody: { padding: 12, gap: 12, paddingBottom: 32 },
});
