import React from 'react';
import { ScrollView, StyleSheet, Dimensions } from 'react-native';
import EventCard from '../cards/EventCard';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { useGetUpcomingEventsQuery } from '../../api/apiService';
import { useEventSheet } from '../../providers/EventSheetProvider';
import type { SocietyEvent } from '../../types/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Short of the card's inner width so the next event peeks out and the row
// reads as scrollable without needing a scrollbar to say so.
const CARD_WIDTH = SCREEN_WIDTH * 0.66;
const CARD_GAP = 12;
/** How far ahead the row looks — matches the Events screen's own carousel. */
const UPCOMING_DAYS = 30;
const MAX_CARDS = 12;

/**
 * "Upcoming Events" at the top of the feed — the next 30 days as a carousel of
 * the same cards the Events screen uses, so an event reads the same wherever
 * you meet it.
 *
 * Renders nothing when the window is empty: an empty state at the top of the
 * feed is worse than the feed simply starting where it always did.
 */
export default function UpcomingEventsRow() {
  const { openEventSheet } = useEventSheet();
  const { data } = useGetUpcomingEventsQuery({ days: UPCOMING_DAYS, limit: MAX_CARDS });

  const upcoming = data?.entries ?? [];
  if (!upcoming.length) return null;

  const open = (event: SocietyEvent) =>
    openEventSheet({ eventId: event.internal_id, occurrenceDate: event.occurrence_date });

  return (
    <SuggestionCard title="Upcoming Events">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {upcoming.map((event, i) => (
          // A repeating event can appear on several dates in the window, so the
          // occurrence's day is part of the key.
          <EventCard
            key={`${event.internal_id}-${event.day}-${i}`}
            event={event}
            width={CARD_WIDTH}
            onPress={open}
          />
        ))}
        <RowEndSpacer width={SUGGESTION_CARD_PAD} />
      </ScrollView>
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  // Cards align to the top so a row of differently-shaped photos hangs from one
  // line rather than floating at mixed heights.
  scroll: { gap: CARD_GAP, paddingLeft: SUGGESTION_CARD_PAD, alignItems: 'flex-start' },
});
