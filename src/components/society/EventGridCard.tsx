import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { UserPlus, UserCheck } from 'lucide-react-native';
import EventImage from './EventImage';
import CalendarTile from './CalendarTile';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl } from '../../utils/image';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { useColors } from '../../hooks/useColors';
import {
  categoryFor, occurrenceDate, formatEventRange, formatTime, ORS_EVENT_COLOR, orsBadgeLabel, eventCityState,
} from '../../constants/eventTypes';
import { calendarDate } from '../../utils/calendarDate';
import type { SocietyEvent } from '../../types/api';
import { COLOR_BLACK, COLOR_WHITE, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** The grid cards' fill — a step lighter than the cars mosaic's, off the app's near-black. */
const CARD_BG = SURFACE_MID;
/** Tighter than the app's radius — a small card in a dense grid. */
const CARD_RADIUS = 8;
/** Until the photo has decoded. */
const FALLBACK_RATIO = 4 / 3;

/**
 * One event in the Events landing's two-column mosaic, styled as the cars
 * grid's cards are (CarGridItem): the photo whole across the top at its own
 * shape, rounded at its foot, and the words beneath it.
 *
 * No photo, no picture box — the card is just its words, rather than a grey
 * stand-in taking up half of it.
 */
function EventGridCard({ event, onPress, interested, busy, onToggleInterest }: {
  event: SocietyEvent;
  onPress: (event: SocietyEvent) => void;
  /** Attend's state, held by the grid (useGridInterest) rather than per card. */
  interested: boolean;
  busy: boolean;
  onToggleInterest: (event: SocietyEvent) => void;
}) {
  const colors = useColors();
  const image = firstGalleryUrl(event.gallery, 'small');
  const { ratio, onAspectRatio } = useNaturalRatio(FALLBACK_RATIO);
  const category = categoryFor(event.category);
  const badge = orsBadgeLabel(event);
  const city = eventCityState(event);
  // The day as a little desk calendar — month over the date — with the
  // weekday beside it, and under that the span (multi-day) or the start time.
  const day = calendarDate(occurrenceDate(event));
  const sub = formatEventRange(event) ?? formatTime(event.start_time);
  // Attend this date from the card — the same toggle (and car picker) as the
  // event's own Attend.
  const brand = useBrandColor();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: CARD_BG }]}
      onPress={() => onPress(event)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={event.title || 'Event'}
    >
      {image ? (
        <View style={[styles.photo, { aspectRatio: ratio }]}>
          <EventImage uri={image} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
        </View>
      ) : null}

      <View style={styles.info}>
        {/* The type as a word in its colour, not a pill. */}
        <View style={styles.tags}>
          <Text style={[styles.type, { color: category.color }]} numberOfLines={1}>{category.label}</Text>
          {badge ? (
            <Text style={[styles.type, { color: ORS_EVENT_COLOR }]} numberOfLines={1}>· {badge}</Text>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>{event.title || 'Event'}</Text>
        {city ? <Text style={[styles.city, { color: colors.grey }]} numberOfLines={1}>{city}</Text> : null}

        {day ? (
          <View style={styles.when}>
            <CalendarTile date={day} />
            <View style={styles.whenText}>
              <Text style={[styles.weekday, { color: colors.fg }]} numberOfLines={1}>
                {day.toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              {sub ? <Text style={[styles.whenSub, { color: colors.grey }]} numberOfLines={1}>{sub}</Text> : null}
            </View>
            <TouchableOpacity
              style={[styles.attend, interested && { backgroundColor: brand }, busy && { opacity: 0.6 }]}
              onPress={() => onToggleInterest(event)}
              disabled={busy}
              activeOpacity={0.75}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={interested ? 'Attending — tap to stop' : 'Attend'}
              accessibilityState={{ selected: interested }}
            >
              {interested
                ? <UserCheck size={15} color={COLOR_BLACK} strokeWidth={2.4} />
                : <UserPlus size={15} color={COLOR_WHITE} strokeWidth={2.4} />}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Memoised: a change to one card's Attend leaves the other cards alone. */
export default memo(EventGridCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  // Full-bleed across the top, rounded at its foot to the card's radius.
  photo: {
    width: '100%',
    borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  info: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 3 },
  tags: { flexDirection: 'row', gap: 4 },
  type: { flexShrink: 1, fontSize: 11.5, fontFamily: FONT_INTER.bold, letterSpacing: 0.1 },
  title: { fontSize: 13, lineHeight: 17, fontFamily: FONT_INTER.bold },
  city: { fontSize: 11, fontFamily: FONT_INTER.medium, marginTop: -1 },

  when: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  whenText: { flex: 1, minWidth: 0 },
  attend: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  weekday: { fontSize: 12, fontFamily: FONT_INTER.bold },
  whenSub: { fontSize: 11, fontFamily: FONT_INTER.semibold, marginTop: 1 },
});
