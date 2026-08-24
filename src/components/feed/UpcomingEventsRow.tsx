import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from 'lucide-react-native';
import EventCard from '../cards/EventCard';
import EventDateBadge from '../society/EventDateBadge';
import RallyDetailSheet from '../society/RallyDetailSheet';
import RowEndSpacer from '../ui/RowEndSpacer';
import SuggestionCard, { SUGGESTION_CARD_PAD } from './SuggestionCard';
import { useGetUpcomingEventsQuery, useGetRallysQuery } from '../../api/apiService';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { calendarTime } from '../../utils/calendarDate';
import { ORS_EVENT_COLOR } from '../../constants/eventTypes';
import type { SocietyEvent, Rally } from '../../types/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Short of the card's inner width so the next event peeks out and the row
// reads as scrollable without needing a scrollbar to say so.
const CARD_WIDTH = SCREEN_WIDTH * 0.66;
const CARD_GAP = 12;
/**
 * Every card in this row is the same 16/9 frame. Elsewhere an event card takes
 * its photo's own shape, but here they sit shoulder to shoulder in a scroller,
 * where mixed heights read as a broken row rather than as varied photos.
 */
const CARD_RATIO = 16 / 9;
/** How far ahead the row looks — matches the Events screen's own carousel. */
const UPCOMING_DAYS = 30;
const MAX_CARDS = 12;
/** Enough upcoming rallys to pick the soonest from whatever order they arrive in. */
const RALLY_FETCH = 12;

/**
 * The next ORS rally, wearing the same frame as the event cards beside it.
 *
 * A rally isn't a society event and doesn't come from that endpoint, so it
 * can't simply be an `EventCard` — but in this row it has to read as one more
 * card in the shelf rather than as a different kind of object, so it borrows
 * the same photo/scrim/date-badge/accent construction. The pill says "ORS
 * Rally" where an event's says its category.
 */
function RallyRowCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);

  return (
    <TouchableOpacity
      style={[styles.rallyCard, { width: CARD_WIDTH }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={{ aspectRatio: CARD_RATIO }}>
        {hero ? (
          <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.rallyPlaceholder]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(15,15,15,0.55)', 'rgba(15,15,15,0.97)']}
          locations={[0.2, 0.6, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.rallyTopRow}>
          <View style={[styles.rallyPill, { backgroundColor: ORS_EVENT_COLOR }]}>
            <Text style={styles.rallyPillText} numberOfLines={1}>ORS Rally</Text>
          </View>
        </View>

        <View style={styles.rallyBody}>
          <EventDateBadge date={rally.event_date} size="sm" />
          <View style={styles.rallyText}>
            <Text style={styles.rallyTitle} numberOfLines={2}>{rally.title}</Text>
            {rally.location ? (
              <View style={styles.rallyMeta}>
                <MapPin size={11} color="rgba(255,255,255,0.85)" />
                <Text style={styles.rallyMetaText} numberOfLines={1}>{rally.location}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.rallyAccent, { backgroundColor: ORS_EVENT_COLOR }]} />
    </TouchableOpacity>
  );
}

/**
 * "Upcoming Events" at the top of the feed — the next 30 days as a carousel of
 * the same cards the Events screen uses, so an event reads the same wherever
 * you meet it.
 *
 * The soonest ORS rally takes the first slot, as it does on murray: a rally is
 * the one date the club puts its own name on, and buried eighth in a scroller
 * it was the thing least likely to be seen.
 *
 * Renders nothing when the window is empty: an empty state at the top of the
 * feed is worse than the feed simply starting where it always did.
 */
export default function UpcomingEventsRow() {
  const { openEventSheet } = useEventSheet();
  const [rallyOpen, setRallyOpen] = useState(false);
  const { data } = useGetUpcomingEventsQuery({ days: UPCOMING_DAYS, limit: MAX_CARDS });
  const { data: rallyData } = useGetRallysQuery({ page: 0, limit: RALLY_FETCH, time_filter: 'upcoming' });

  const upcoming = data?.entries ?? [];
  // The endpoint's own order is by creation, not by date, so the soonest one is
  // picked here rather than trusted to arrive first.
  const nextRally = [...(rallyData?.entries ?? [])]
    .filter((r) => !!r.event_date)
    .sort((a, b) => calendarTime(a.event_date, Infinity) - calendarTime(b.event_date, Infinity))[0] ?? null;

  if (!upcoming.length && !nextRally) return null;

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
        {nextRally && (
          <RallyRowCard rally={nextRally} onPress={() => setRallyOpen(true)} />
        )}
        {upcoming.map((event, i) => (
          // A repeating event can appear on several dates in the window, so the
          // occurrence's day is part of the key.
          <EventCard
            key={`${event.internal_id}-${event.day}-${i}`}
            event={event}
            width={CARD_WIDTH}
            ratio={CARD_RATIO}
            showInterested={false}
            onPress={open}
          />
        ))}
        <RowEndSpacer width={SUGGESTION_CARD_PAD} />
      </ScrollView>

      <RallyDetailSheet
        rallyId={rallyOpen && nextRally ? nextRally.internal_id : null}
        onClose={() => setRallyOpen(false)}
      />
    </SuggestionCard>
  );
}

const styles = StyleSheet.create({
  // The fixed ratio already makes every card the same height; the top
  // alignment stays so a card can never be stretched to match a taller one.
  scroll: { gap: CARD_GAP, paddingLeft: SUGGESTION_CARD_PAD, alignItems: 'flex-start' },

  rallyCard:        { borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1A1A' },
  rallyPlaceholder: { backgroundColor: '#242424' },
  rallyAccent:      { height: 3 },
  rallyTopRow:      { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row' },
  rallyPill:        { flexShrink: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rallyPillText:    {
    fontSize: 11, fontWeight: '800', color: '#000000',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  rallyBody: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 12,
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  rallyText:  { flex: 1 },
  rallyTitle: {
    fontSize: 16, lineHeight: 20, fontWeight: '800', color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rallyMeta:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  rallyMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
});
