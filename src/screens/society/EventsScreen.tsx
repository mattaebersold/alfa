import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import SharedModal from '../../components/ui/SharedModal';
import EmptyState from '../../components/ui/EmptyState';
import Spinner from '../../components/ui/Spinner';
import EventCard from '../../components/cards/EventCard';
import { UpcomingEventCard, UPCOMING_CARD_WIDTH } from '../../components/cards/UpcomingCard';
import EventMonthCalendar from '../../components/society/EventMonthCalendar';
import RallyCarousel from '../../components/society/RallyCarousel';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useGetUpcomingEventsQuery, useGetUsageQuery, useGetEventRegionsQuery } from '../../api/apiService';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import { NO_ZIP_NOTE } from '../../components/ui/LocationFilterRow';
import EventFilters from '../../components/society/EventFilters';
import { collapseMultiDay } from '../../constants/eventTypes';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import { EVENT_LIMIT_BASIC } from '../../constants/limits';
import { categoryFor } from '../../constants/eventTypes';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { ss } from '../../styles/shared';
import type { SocietyEvent } from '../../types/api';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { useRefreshControl } from '../../hooks/useRefreshControl';

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
 */
export default function EventsScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<ScrollView>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();
  const isPro = useIsPro();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);

  const { openEventSheet } = useEventSheet();
  const [category, setCategory] = useState<string | null>(null);
  const [daySheet, setDaySheet] = useState<{ date: Date; events: SocietyEvent[] } | null>(null);
  // iOS won't present a screen while a modal is dismissing, so the tapped event
  // is held until the sheet is fully gone.
  const [pendingEvent, setPendingEvent] = useState<SocietyEvent | null>(null);

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

  // Only categories with something coming up — a pill that filters to "Nothing
  // in the next 30 days" is a dead end. EventFilters keeps the selected one.
  const presentCategories = new Set(all.map((e) => categoryFor(e.category).key));

  const openEvent = (event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date });

  // Pro has nothing to count, so it doesn't ask. `events` is missing from a
  // server older than the limit, and then the button just adds.
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro });
  const eventAllowance = !isPro && usage?.events?.limit != null ? usage.events : null;
  // At the limit the button opens the upsell rather than a form the server
  // will refuse after it's been filled in.
  const [upsell, setUpsell] = useState(false);
  const addEvent = () =>
    eventAllowance?.reached
      ? setUpsell(true)
      : (nav as any).navigate('SocietyEventCreate');

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <ScrollView
        ref={scrollRef}
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: 88 + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ScreenHeading sits at zero and every screen supplies its own
            gutter — this one had none, so the title ran out to the edge while
            the chips and carousel below it started at 12. */}
        <View style={styles.headingWrap}>
          <ScreenHeading
            title="Events"
            inline
            right={
              <HeadingActionButton
                label="Add new event"
                onPress={addEvent}
                // A basic member's allowance, on the button that spends it — the
                // count is seen every time before it matters, not only when the
                // server refuses the fourth. Just the fraction: beside the title
                // there isn't room for "this month", so that's left to the label
                // read aloud.
                badge={eventAllowance ? `${eventAllowance.used}/${eventAllowance.limit}` : undefined}
                accessibilityLabel={
                  eventAllowance
                    ? `Add new event, ${eventAllowance.used} of ${eventAllowance.limit} used this month`
                    : 'Add new event'
                }
              />
            }
          />
        </View>

        <EventFilters
          location={location}
          regions={regions}
          category={category}
          onCategory={setCategory}
          presentCategories={presentCategories}
        />
        {/* Stays on the screen rather than in the panel: it explains the list
            you're looking at, not an option you're choosing. */}
        {location.fellBack && (
          <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
        )}

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

      <ProUpsellModal
        visible={upsell}
        onClose={() => setUpsell(false)}
        title="Unlimited events with Pro"
        message={`A basic membership includes ${EVENT_LIMIT_BASIC} new events a month. Pro removes the limit, so you can put every meet on the calendar.`}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headingWrap: { paddingHorizontal: 12, marginBottom: 4 },

  note: { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginBottom: 6 },

  sectionHead: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800' },
  sectionSub:   { fontSize: 13, fontWeight: '600' },

  // Top-aligned, so a card is never stretched to a neighbour's height.
  carousel: { paddingLeft: 12, gap: 12, alignItems: 'flex-start' },

  sheetBody: { padding: 12, gap: 12, paddingBottom: 32 },
});
