import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import EventImage from '../society/EventImage';
import EventPills from '../society/EventPills';
import { firstGalleryUrl } from '../../utils/image';
import {
  categoryFor, occurrenceDate, formatEventDate, formatEventRange, formatTime,
} from '../../constants/eventTypes';
import { useColors } from '../../hooks/useColors';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import type { SocietyEvent, User } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * The frame the card holds until the photo reports its own shape, and the
 * shape of the blurred stand-in for events with no photo. Landscape, and on
 * the shallow side of it: the stand-in is a backdrop, not a picture of the
 * event, and shouldn't take more of the card than the copy does.
 */
const FALLBACK_RATIO = 16 / 9;

interface EventCardProps {
  event: SocietyEvent;
  onPress?: (event: SocietyEvent) => void;
  width?: number;
  /**
   * Hold the photo to a fixed shape (16/9, say) instead of letting the card
   * take the photo's own. Worth it where the cards sit side by side and the
   * ragged heights read as sloppy rather than as photos being photos.
   */
  ratio?: number;
  /**
   * Show who's interested, at the end of the meta line. Off where the card is
   * small enough that the stack crowds the copy more than the faces are worth.
   */
  showInterested?: boolean;
}

/** Up to three overlapping avatars, then "+N" for the rest. */
function InterestedStack({ users, total }: { users?: User[]; total: number }) {
  const colors = useColors();
  if (!users?.length) return null;
  const extra = total - users.length;

  return (
    <View style={styles.stack}>
      {users.map((user, i) => (
        <View key={user.user_id} style={i > 0 ? styles.stackOverlap : undefined}>
          <Avatar user={user} size={26} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.stackMore, styles.stackOverlap, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.stackMoreText, { color: colors.fg }]}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The society event card — the day sheet, Your Events and the feed's new-event
 * posts use it, so an event reads the same wherever it appears. The upcoming
 * carousels use the smaller UpcomingCard instead.
 *
 * The photo first, whole and at its own shape, with nothing drawn over it:
 * event art is a flyer as often as a photograph, and both a fixed frame and a
 * title laid across the bottom cost it its own lettering. Everything the card
 * has to say sits under the photo on the card's own surface — the category
 * and "Event" as pills, the day and time, the title, then where it is and
 * who's going.
 */
export default function EventCard({
  event, onPress, width, ratio, showInterested = true,
}: EventCardProps) {
  const colors = useColors();
  const { ratio: measuredRatio, onAspectRatio } = useNaturalRatio(FALLBACK_RATIO);

  if (!event) return null;

  const category = categoryFor(event.category);
  const hero = firstGalleryUrl(event.gallery);
  // A caller-set shape wins outright; nothing measures the photo in that case,
  // since the frame isn't going to move whatever comes back.
  const frameRatio = ratio ?? measuredRatio;

  // A multi-day event says its whole span; anything else names its day. An
  // event whose schedule has run out (Your Events' past section) has no day to
  // name, so it says how it used to repeat instead of losing the line.
  const day = formatEventRange(event)
    ?? (formatEventDate(occurrenceDate(event), { weekday: true }) || event.schedule_label);
  const time = formatTime(event.start_time);
  const when = [day, time].filter(Boolean).join(' · ');

  const showMeta = !!event.location || showInterested;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }, width != null && { width }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.9}
    >
      {/* The card's own corners round the photo — nothing sits on top of it. */}
      <View style={{ aspectRatio: frameRatio }}>
        <EventImage
          uri={hero}
          style={StyleSheet.absoluteFill}
          onAspectRatio={ratio == null ? onAspectRatio : undefined}
        />
      </View>

      <View style={styles.body}>
        <EventPills category={category} ors={event.ors_sponsored} />

        {/* The day in the category's colour: the pill alone is easy to miss
            when scanning a list, and this is enough colour to sort cards at a
            glance without giving the photo anything back. */}
        {when ? <Text style={[styles.when, { color: category.color }]}>{when}</Text> : null}

        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{event.title}</Text>

        {/* Where, left; who's going, right. The location takes whatever the
            stack leaves so a long address truncates instead of pushing the
            faces off the card. */}
        {showMeta && (
          <View style={styles.meta}>
            {event.location ? (
              <View style={styles.location}>
                <MapPin size={12} color={colors.grey} />
                <Text style={[styles.locationText, { color: colors.grey }]} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            ) : <View style={styles.location} />}
            {showInterested && (
              <InterestedStack users={event.interested_preview} total={event.interested_count ?? 0} />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  body: { padding: 12, gap: 6 },

  when: {
    fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 2,
  },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '800' },

  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  location: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { flex: 1, fontSize: 12.5 },

  stack:        { flexDirection: 'row', alignItems: 'center' },
  stackOverlap: { marginLeft: -8 },
  stackMore: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  stackMoreText: { fontSize: 10, fontWeight: '800' },
});
