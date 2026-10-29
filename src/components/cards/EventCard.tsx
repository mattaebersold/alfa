import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { MapPin } from 'lucide-react-native';
import OrsGradient from '../ui/OrsGradient';
import Avatar from '../ui/Avatar';
import EventImage from '../society/EventImage';
import EventPills from '../society/EventPills';
import { firstGalleryUrl } from '../../utils/image';
import {
  categoryFor, occurrenceDate, formatEventDate, formatEventRange, formatTime, eventCityState, isOrsEvent, orsBadgeLabel,
} from '../../constants/eventTypes';
import { useColors } from '../../hooks/useColors';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import type { SocietyEvent, User } from '../../types/api';
import {
  COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

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
  /**
   * The photo on the left at its own shape, the details beside it — for a
   * list of a day's events, where a run of full-width photos buried the
   * details. The photo is SIDE_PHOTO_W wide, as tall as its shape makes it.
   */
  side?: boolean;
  /** The plain "Event" pill beside the category — off in a list of nothing but events. */
  typePill?: boolean;
  /** Something small at the end of the attendees row — the day pane's interest button. */
  accessory?: React.ReactNode;
  /** Tapping the address does this instead of opening the card — opening it in maps. */
  onPressLocation?: () => void;
}

/** The side layout's photo width. */
const SIDE_PHOTO_W = 140;

/** How many faces a stack shows before the rest become "+N". */
const STACK_MAX = 3;

/**
 * Up to three overlapping avatars, then "+N" for the rest. Shared with the
 * event detail, which passes a bigger `size` and `onPressUser`.
 */
export function InterestedStack({ users, total, size = 26, onPressUser }: {
  users?: User[];
  total: number;
  size?: number;
  onPressUser?: (user: User) => void;
}) {
  const colors = useColors();
  if (!users?.length) return null;
  const shown = users.slice(0, STACK_MAX);
  const extra = Math.max(total, users.length) - shown.length;
  const overlap = { marginLeft: -Math.round(size * 0.3) };

  return (
    <View style={styles.stack}>
      {shown.map((user, i) => (
        <TouchableOpacity
          key={user.user_id}
          style={i > 0 ? overlap : undefined}
          onPress={() => onPressUser?.(user)}
          disabled={!onPressUser}
          activeOpacity={0.8}
        >
          <Avatar user={user} size={size} />
        </TouchableOpacity>
      ))}
      {extra > 0 && (
        <View
          style={[
            styles.stackMore, overlap,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary },
          ]}
        >
          <Text style={[styles.stackMoreText, { color: colors.fg, fontSize: Math.round(size * 0.38) }]}>+{extra}</Text>
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
  event, onPress, width, ratio, showInterested = true, side = false, typePill = true,
  accessory, onPressLocation,
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
  // The town, beside the time on the side layout — the address below is
  // often cut off before it gets there.
  const cityState = side ? eventCityState(event) : null;

  /**
   * An ORS event in the day pane's list wears the calendar's ORS livery — the
   * same gradient its day is painted in — with its words in black over it.
   */
  const ors = isOrsEvent(event);
  const livery = side && ors;
  const ink = livery ? COLOR_BLACK : colors.fg;
  // The day and time pills: sunk into the card, or on the livery a shade of it.
  const whenBg = livery ? 'rgba(0,0,0,0.12)' : colors.bg;

  const showMeta = !!event.location;
  const showPeople = (showInterested && !!event.interested_preview?.length) || !!accessory;

  return (
    <TouchableOpacity
      style={[styles.card, side && styles.cardSide, { backgroundColor: colors.card }, width != null && { width }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.9}
    >
      {livery ? (
        <OrsGradient />
      ) : null}
      {/* The card's own corners round the photo — nothing sits on top of it. */}
      {/* Beside the copy, a tall flyer is held to a square — at its own shape it
          made the card twice the copy's height, all of it empty space. */}
      {/* No photo, no stand-in: the details take the card's whole width. */}
      {hero ? (
        <View style={side ? [styles.photoSide, { minHeight: SIDE_PHOTO_W / Math.max(frameRatio, 1) }] : { aspectRatio: frameRatio }}>
          <EventImage
            uri={hero}
            style={StyleSheet.absoluteFill}
            onAspectRatio={ratio == null ? onAspectRatio : undefined}
          />
        </View>
      ) : null}

      <View style={[styles.body, side && styles.bodySide]}>
        <EventPills category={category} ors={ors} orsLabel={orsBadgeLabel(event)} typePill={typePill} orsBlack={livery} />

        {/* Beside a photo the title comes first, the day and time under it. */}
        {side ? (
          <>
            <Text style={[styles.title, styles.titleSide, livery && { color: COLOR_BLACK }]} numberOfLines={2}>{event.title}</Text>
            {/* The town on its own line, between the title and the pills. */}
            {cityState ? (
              <Text style={[styles.whenPlace, { color: ink }]} numberOfLines={1}>{cityState}</Text>
            ) : null}
          </>
        ) : null}

        {/* The day in the category's colour: the pill alone is easy to miss
            when scanning a list, and this is enough colour to sort cards at a
            glance without giving the photo anything back. */}
        {side ? (
          // Beside a photo the day and the time are two things, not one run
          // of coloured capitals: the day in white, the time apart from it
          // with its clock, quieter.
          (day || time) ? (
            <View style={styles.whenRow}>
              {/* The day and the time each in a dark pill, sunk into the card. */}
              {day ? (
                <View style={[styles.whenPill, styles.whenPillShrink, { backgroundColor: whenBg }]}>
                  <Text style={[styles.whenDay, { color: ink }]} numberOfLines={1}>{day}</Text>
                </View>
              ) : null}
              {time ? (
                <View style={[styles.whenPill, { backgroundColor: whenBg }]}>
                  <Text style={[styles.whenTimeText, { color: ink }]}>{time}</Text>
                </View>
              ) : null}
            </View>
          ) : null
        ) : when ? <Text style={[styles.when, { color: category.color }]}>{when}</Text> : null}

        {side ? null : (
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{event.title}</Text>
        )}

        {/* Where, then who's going on a row of its own under it — the
            address gets the full width, and the faces sit with the button
            that adds yours. */}
        {showMeta && (
          <View style={styles.meta}>
            {event.location ? (
              <TouchableOpacity
                style={styles.location}
                onPress={onPressLocation}
                disabled={!onPressLocation}
                activeOpacity={0.6}
                hitSlop={6}
                accessibilityRole={onPressLocation ? 'link' : undefined}
              >
                {side ? null : <MapPin size={12} color={ink} />}
                <Text style={[styles.locationText, { color: ink }]} numberOfLines={1}>
                  {event.location}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        {showPeople && (
          <View style={[styles.people, side && styles.peopleFoot]}>
            {showInterested && (
              <InterestedStack users={event.interested_preview} total={event.interested_count ?? 0} />
            )}
            {accessory}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  body: { padding: 12, gap: 6 },
  // Side by side: the details run the photo's full height, so who's going
  // (and the Attend pill) can sit at the foot.
  cardSide: { flexDirection: 'row', alignItems: 'stretch' },
  // Its own rounded right edge, where it meets the details. At least its own
  // shape tall; stretched past that when the details run taller, the photo
  // covering the extra rather than leaving a gap under it.
  photoSide: {
    width: SIDE_PHOTO_W, alignSelf: 'stretch', overflow: 'hidden',
    borderTopRightRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS,
  },
  bodySide: { flex: 1, minWidth: 0, paddingVertical: 10, gap: 5 },

  when: {
    fontSize: 11, fontFamily: FONT_INTER.extrabold,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 2,
  },
  title: { fontSize: 16, lineHeight: 20, fontFamily: FONT_INTER.bold },
  titleSide: { fontSize: 16.5, lineHeight: 20, color: COLOR_WHITE },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  whenPill: { borderRadius: PILL_RADIUS, paddingHorizontal: 8, paddingVertical: 3 },
  whenPillShrink: { flexShrink: 1 },
  whenDay: { fontSize: 11.5, fontFamily: FONT_INTER.bold },
  whenTimeText: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
  whenPlace: { fontSize: 12, fontFamily: FONT_INTER.medium, opacity: 0.85, marginTop: -2 },

  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  // Anchored to the bottom of a side card, however short the copy above it.
  peopleFoot: { marginTop: 'auto', paddingTop: 4 },
  // Bright, but a step under the title.
  location: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.85 },
  locationText: { flex: 1, fontSize: 12.5 },

  stack:        { flexDirection: 'row', alignItems: 'center' },
  stackMore:    { alignItems: 'center', justifyContent: 'center' },
  stackMoreText: { fontFamily: FONT_INTER.extrabold },
});
