import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { UpcomingEventCard, UpcomingRallyCard, UPCOMING_CARD_WIDTH } from '../cards/UpcomingCard';
import RallyDetailSheet from '../society/RallyDetailSheet';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { useGetUpcomingEventsQuery, useGetRallysQuery } from '../../api/apiService';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { mergeUpcoming } from '../../utils/rally';
import { collapseMultiDay } from '../../constants/eventTypes';
import type { SocietyEvent } from '../../types/api';

// Shared with the Events screen's carousel, so an event is one size in both.
const CARD_WIDTH = UPCOMING_CARD_WIDTH;
const CARD_GAP = 12;
/** How far ahead the row looks — matches the Events screen's own carousel. */
const UPCOMING_DAYS = 30;
const MAX_CARDS = 12;
/**
 * Rallys aren't windowed the way events are: every upcoming one goes in the
 * row, however far out it is — a rally months away is still what you plan
 * around. The cap is a runaway guard, not a shelf size.
 */
const RALLY_FETCH = 12;

/**
 * "Upcoming Events" at the top of the feed — the next 30 days near the member
 * (within 100 miles of their zip), as a carousel of
 * the same UpcomingCards the Events screen uses, so an event reads the same
 * wherever you meet it.
 *
 * Rallys sit among the events in date order, as they do on murray: the row is
 * a schedule, and a rally months out ahead of a meet this Saturday stopped it
 * reading as one. Their gold "ORS Rally" pill still picks them out.
 *
 * Renders nothing when the window is empty: an empty state at the top of the
 * feed is worse than the feed simply starting where it always did.
 */
export default function UpcomingEventsRow() {
  const navigation = useNavigation<any>();
  const { openEventSheet } = useEventSheet();
  const [openRallyId, setOpenRallyId] = useState<string | null>(null);
  // Near the member only — measured from the zip on their profile, the same
  // "Near me" the Events screen opens on. A member with no zip gets every
  // upcoming event instead (the server answers unfiltered, with
  // `near_unavailable`), which beats an empty row at the top of the feed.
  const { data } = useGetUpcomingEventsQuery({ days: UPCOMING_DAYS, limit: MAX_CARDS, near: 'me' });
  const { data: rallyData } = useGetRallysQuery({ page: 0, limit: RALLY_FETCH, time_filter: 'upcoming' });

  // Neither endpoint returns anything in date order — events come back by
  // occurrence within the window, rallys by creation — so the row is ordered
  // here, across both.
  // Multi-day events once each, however the list arrived.
  const items = mergeUpcoming(rallyData?.entries ?? [], collapseMultiDay(data?.entries ?? []));

  if (!items.length) return null;

  const open = (event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date });

  return (
    // Bare: the event cards are surfaces of their own, and a card around
    // them only boxed them in and cost the row 16pt of width.
    <SuggestionCard
      title="Upcoming Events"
      bare
      action={{
        label: 'View all',
        onPress: () => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Events' } }),
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {items.map((entry, i) =>
          entry.kind === 'rally' ? (
            <UpcomingRallyCard
              key={`rally-${entry.item.internal_id}`}
              rally={entry.item}
              width={CARD_WIDTH}
              onPress={() => setOpenRallyId(entry.item.internal_id)}
            />
          ) : (
            // A repeating event can appear on several dates in the window, so
            // the occurrence's day is part of the key.
            <UpcomingEventCard
              key={`${entry.item.internal_id}-${entry.item.day}-${i}`}
              event={entry.item}
              width={CARD_WIDTH}
              onPress={open}
            />
          )
        )}
        <RowEndSpacer width={SUGGESTION_CARD_PAD} />
      </ScrollView>

      {/* One sheet for the row, told which rally to show — the row can hold
          several now, and a sheet per card would mount them all. */}
      <RallyDetailSheet rallyId={openRallyId} onClose={() => setOpenRallyId(null)} />
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  // Compact cards are all one height already; the top alignment stays so a
  // card can never be stretched to match a taller one.
  scroll: { gap: CARD_GAP, paddingLeft: SUGGESTION_CARD_PAD, alignItems: 'flex-start' },
});
