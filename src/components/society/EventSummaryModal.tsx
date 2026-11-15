import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../theme/Text';
import { MapPin, Repeat, CalendarDays } from 'lucide-react-native';
import SummaryModal, { useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import CheckeredFlag from '../ui/CheckeredFlag';
import EventImage from './EventImage';
import EventDateBadge from './EventDateBadge';
import { EventInterestBar, EventPill, EventPillRow } from './EventDetailBody';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { useGetSocietyEventQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { openInMaps } from '../../utils/openInMaps';
import { categoryFor, formatTime, isOrsEvent, ORS_EVENT_COLOR, toDayKey } from '../../constants/eventTypes';
import type { SocietyEvent } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * The next date a recurring event is on, if it's still to come. Null for a
 * one-off — a post tagged with one is about a day that's been and gone — and
 * for a series that has run out.
 */
function upcomingOccurrence(event: SocietyEvent): string | null {
  if (!event.frequency || event.frequency === 'single') return null;
  const next = event.next_occurrence;
  if (!next) return null;
  return toDayKey(next) >= toDayKey(new Date()) ? next : null;
}

/**
 * An event, summarised — opened from the event tile on a post.
 *
 * A post tagged with an event is mostly about one that has already happened,
 * so this is what the event was, not a ticket to it: its poster, what kind,
 * the title, when, where and what. Attend (and Add to Calendar) only appear
 * for a recurring event with a date still ahead, and act on that next date.
 * View Event, beside them (or alone), opens the calendar's full sheet.
 *
 * The common summary panel (SummaryModal), dressed like the group's: the
 * picture leads, the details under it.
 */
export default function EventSummaryModal({ eventId, origin, onClose }: {
  /** The event to show; null while closed. */
  eventId: string | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  // Held through the close, so the panel fades out on the event rather than emptying.
  const [shownId, setShownId] = useState(eventId);
  if (eventId && eventId !== shownId) setShownId(eventId);

  const { data: event, isLoading } = useGetSocietyEventQuery(shownId ?? '', { skip: !shownId });
  const [posterRatio, setPosterRatio] = useState(16 / 9);

  const poster = event ? firstGalleryUrl(event.gallery) : null;
  const next = event ? upcomingOccurrence(event) : null;
  // A recurring event's next date when there is one; otherwise the date it was on.
  const shownDate = next ?? event?.date ?? null;
  const category = event ? categoryFor(event.category) : null;
  const time = event ? formatTime(event.start_time) : null;
  const body = event?.body ? stripHtml(event.body).trim() : '';

  return (
    <SummaryModal
      visible={!!eventId}
      onClose={onClose}
      origin={origin}
    >
      {isLoading || !event || !category ? (
        <View style={styles.loading}><Spinner /></View>
      ) : (
        <View>
          {/* The poster leads, as a group's banner does — at its own shape,
              capped at square. None at all when there isn't one. */}
          {poster ? (
            <View style={styles.posterWrap}>
              <EventImage
                uri={poster}
                style={[styles.poster, { aspectRatio: Math.max(1, posterRatio) }]}
                onAspectRatio={setPosterRatio}
              />
              {/* What kind of event, on the poster's top-left corner. */}
              <View style={[styles.category, styles.onPoster, { backgroundColor: category.color }]}>
                <Text style={styles.categoryText}>{category.label}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.body}>
            {/* The kind here only when there's no poster to carry it. */}
            {!poster || isOrsEvent(event) ? (
              <View style={styles.tags}>
                {!poster ? (
                  <View style={[styles.category, { backgroundColor: category.color }]}>
                    <Text style={styles.categoryText}>{category.label}</Text>
                  </View>
                ) : null}
                {isOrsEvent(event) ? (
                  <View style={[styles.category, styles.ors, { backgroundColor: ORS_EVENT_COLOR }]}>
                    <CheckeredFlag size={11} color={COLOR_BLACK} />
                    <Text style={styles.categoryText}>{event.ors_sponsored ? 'ORS Sponsored' : 'ORS attending'}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={[styles.title, { color: colors.fg }]} numberOfLines={3}>{event.title}</Text>

            {/* When: the date, the time, and how often for a series. */}
            {shownDate || time || event.schedule_label ? (
              <View style={styles.when}>
                {shownDate ? <EventDateBadge date={shownDate} /> : null}
                <View style={styles.whenText}>
                  {next ? <Text style={[styles.whenLabel, { color: colors.grey }]}>Next</Text> : null}
                  {time ? <Text style={[styles.time, { color: colors.fg }]} numberOfLines={1}>{time}</Text> : null}
                  {event.frequency !== 'single' && event.schedule_label ? (
                    <View style={styles.repeatRow}>
                      <Repeat size={13} color={colors.grey} strokeWidth={2.4} />
                      <Text style={[styles.repeatText, { color: colors.grey }]} numberOfLines={2}>
                        {event.schedule_label}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Where — the address opens the maps app. */}
            {event.location ? (
              <TouchableOpacity style={styles.location} onPress={() => openInMaps(event)} activeOpacity={0.8}>
                <MapPin size={15} color={colors.grey} />
                <Text style={[styles.locationText, { color: colors.fg }]} numberOfLines={2}>{event.location}</Text>
              </TouchableOpacity>
            ) : null}

            {body ? (
              <Text style={[styles.about, { color: colors.muted }]} numberOfLines={5}>{body}</Text>
            ) : null}

            {/* Attend and Add only for a series with a date still ahead (see
                upcomingOccurrence); the way on to the full event either way. */}
            <View style={styles.attend}>
              {next ? (
                <EventInterestBar
                  eventId={event.internal_id}
                  occurrenceDate={next}
                  calendarLabel="Add"
                  after={<ViewEventPill eventId={event.internal_id} occurrenceDate={next} />}
                />
              ) : (
                <EventPillRow><ViewEventPill eventId={event.internal_id} /></EventPillRow>
              )}
            </View>
          </View>
        </View>
      )}
    </SummaryModal>
  );
}

/**
 * The full event — who's going, its posts, its comments — in the calendar's
 * sheet, once this panel has closed (iOS won't present one over the other).
 */
function ViewEventPill({ eventId, occurrenceDate }: { eventId: string; occurrenceDate?: string }) {
  const panel = useSummaryPanel();
  const { openEventSheet } = useEventSheet();
  return (
    <EventPill
      Icon={CalendarDays}
      label="View"
      accessibilityLabel="View event"
      onPress={() => panel?.closeThen(() => openEventSheet({ eventId, occurrenceDate }))}
    />
  );
}

const styles = StyleSheet.create({
  loading: { height: 200, alignItems: 'center', justifyContent: 'center' },
  posterWrap: { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  poster: { width: '100%' },
  body: { padding: 14, paddingTop: 16, paddingBottom: 16, gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  category: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  ors: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onPoster: { position: 'absolute', top: 14, left: 14 },
  categoryText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  title: { fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: -0.3, color: COLOR_WHITE },
  when: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  whenText: { flex: 1, minWidth: 0, gap: 4 },
  whenLabel: { fontSize: 11, fontFamily: FONT_INTER.bold, textTransform: 'uppercase', letterSpacing: 0.6 },
  time: { fontSize: 16, fontFamily: FONT_INTER.bold },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  repeatText: { flexShrink: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },
  location: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  locationText: { flex: 1, fontSize: 14 },
  about: { fontSize: 14, lineHeight: 20 },
  attend: { marginTop: 6 },
});
