import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import EmptyState from '../../components/ui/EmptyState';
import { HEADER_GUTTER } from '../../components/ui/AppHeader';
import EventGridCard from './EventGridCard';
import { useGridInterest } from './useGridInterest';
import { useGetUpcomingEventsQuery, useGetEventRegionsQuery } from '../../api/apiService';
import { useLocationFilter, useNearFallback } from '../../hooks/useLocationFilter';
import NoResultsNear from '../ui/NoResultsNear';
import { NO_ZIP_NOTE } from '../../components/ui/LocationFilterRow';
import EventFilters from '../../components/society/EventFilters';
import SearchPill from '../../components/ui/SearchPill';
import { GUTTER } from '../../constants/config';
import { collapseMultiDay } from '../../constants/eventTypes';
import { useColors } from '../../hooks/useColors';
import { categoryFor } from '../../constants/eventTypes';
import { useEventSheet } from '../../providers/EventSheetProvider';
import type { SocietyEvent } from '../../types/api';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { FONT_INTER } from '../../constants/fonts'

import { SkeletonCard } from '../ui/Skeleton';
/** How far ahead the Upcoming carousel looks. */
const UPCOMING_DAYS = 30;
/** Cards in the carousel, once filtered. */
const UPCOMING_SHOWN = 20;

/**
 * The Events landing: the search and filter (Add New is in the header's
 * row of options, after ORS Rallys), then the next 30 days' events as a two-column grid, which the
 * search narrows in place. The
 * calendar and the map are the header's Calendar and Map tabs now, so they
 * aren't repeated here.
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
  const nav = useNavigation();
  const insets = useSafeAreaInsets();

  const { openEventSheet } = useEventSheet();
  const [category, setCategory] = useState<string | null>(null);
  /** The search, narrowing the grid as you type. */
  const [query, setQuery] = useState('');

  // A rolling 30-day window rather than the calendar month: on the 28th, "the
  // rest of this month" is two days of events and the carousel looks abandoned.
  //
  // Fetched whole and filtered here, rather than asking the server per
  // category: the chips need to know which categories have anything in the
  // window at all, and that's only answerable from the unfiltered list. 100 is
  // the server's cap, and far more occurrences than a month holds.
  // Location narrows on the server (a state is a query, "near me" a distance
  // from the phone, or the member's saved zip without one); type is filtered here, as above. Both feed
  // the carousel and the calendar below, so they always agree.
  const location = useLocationFilter();
  const { data: regionsData } = useGetEventRegionsQuery();
  // State codes with something coming up; undefined (every state) until the
  // server says, or from a server that predates states.
  const states = regionsData?.states?.map((s) => s.code);
  const { data, isLoading, isFetching, refetch } = useGetUpcomingEventsQuery(
    { limit: 100, days: UPCOMING_DAYS, ...location.params },
  );

  // Near me with nothing to measure from — no location shared and no saved
  // zip — falls back to everything rather than an empty screen.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);
  // Nothing coming up near you: say so, then everything as "Other upcoming events".
  useNearFallback(location, {
    settled: !!data && !isFetching && !data.near_unavailable,
    empty: (data?.entries?.length ?? 0) === 0,
  });
  const refreshControl = useRefreshControl(refetch, headerPad);
  const all = data?.entries ?? [];
  // The search narrows the grid in place, over the same 30 days and filters:
  // a title, a venue or a town.
  const term = query.trim().toLowerCase();
  const matches = (e: SocietyEvent) => !term || [e.title, e.location, e.location_city_state]
    .some((f) => f?.toLowerCase().includes(term));
  const upcoming = collapseMultiDay(
    all.filter((e) => (!category || categoryFor(e.category).key === category) && matches(e)),
  ).slice(0, UPCOMING_SHOWN);

  // Only categories with something coming up — a pill that filters to "Nothing
  // in the next 30 days" is a dead end. EventFilters keeps the selected one.
  const presentCategories = new Set(all.map((e) => categoryFor(e.category).key));

  // Stable, so the memoised cards don't all re-render with every change here.
  const openEvent = useCallback((event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date }), [openEventSheet]);
  // Attend for every card at once — one set of subscriptions, one car picker.
  const interest = useGridInterest();

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
      {/* Search by name on the left, the filter on the right. They narrow the
          upcoming events below. */}
      <View style={styles.toolsRow}>
        <SearchPill
          style={styles.toolsSearch}
          value={query}
          onChangeText={setQuery}
          onClear={() => setQuery('')}
          placeholder="Search events…"
          autoCorrect={false}
          returnKeyType="search"
        />
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
      {location.others && <NoResultsNear radius={location.radius} heading={null} style={styles.nearEmpty} />}

      {/* Upcoming events — the next 30 days, from today forward */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.fg }]}>
          {location.others ? 'Other upcoming events' : 'Upcoming Events'}
        </Text>
        <Text style={[styles.sectionSub, { color: colors.grey }]}>
          Next {UPCOMING_DAYS} days
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.mosaic}>
          {[0, 1].map((col) => (
            <View key={col} style={styles.column}>
              <SkeletonCard ratio={col ? 0.8 : 1.2} style={{ marginBottom: 0 }} />
              <SkeletonCard ratio={col ? 1.2 : 0.8} style={{ marginBottom: 0 }} />
            </View>
          ))}
        </View>
      ) : upcoming.length === 0 ? (
        <EmptyState title={term ? `No events match “${query.trim()}”` : `Nothing in the next ${UPCOMING_DAYS} days`} />
      ) : (
        // The cars mosaic's columns: alternating left and right, each card
        // its photo's shape (a card's height is only known once it loads).
        <View style={[styles.mosaic, isFetching && { opacity: 0.5 }]}>
          {[0, 1].map((col) => (
            <View key={col} style={styles.column}>
              {upcoming.filter((_, i) => i % 2 === col).map((event, i) => (
                <EventGridCard
                  key={`${event.internal_id}-${event.day}-${col}-${i}`}
                  event={event}
                  onPress={openEvent}
                  interested={interest.isInterested(event)}
                  busy={interest.isBusy(event)}
                  onToggleInterest={interest.onToggle}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    {interest.sheet}
    </>
  );
}

const styles = StyleSheet.create({

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: GUTTER, marginBottom: 6 },
  nearEmpty: { paddingHorizontal: GUTTER - 8, marginTop: 6 },
  // First on the page now: a little room under the header's rows.
  toolsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: GUTTER, paddingTop: 8,
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
  // The cars mosaic's spacing (CarColumns).
  mosaic: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8 },
  column: { flex: 1, gap: 8 },
});
