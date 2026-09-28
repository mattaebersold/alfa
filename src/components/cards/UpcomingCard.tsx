import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@ors/kit';
import EventImage from '../society/EventImage';
import RegionBadge from '../ui/RegionBadge';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { RALLY_DATE_TBA } from '../../utils/rally';
import {
  categoryFor, occurrenceDate, formatEventDate, formatEventRange, ORS_EVENT_COLOR,
} from '../../constants/eventTypes';
import { contrastText } from '../../hooks/useBrandColor';
import type { Rally, SocietyEvent } from '../../types/api';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_26,
  COLOR_GRAY_38,
  COLOR_WHITE,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** Square thumbnail edge, and so the height of every card. */
const THUMB = 90;

/**
 * Card width in both upcoming carousels — the Events screen's and the feed's —
 * so an event is the same size wherever you meet it. Just over half the
 * screen: most of a second card shows beside the first, and the title still
 * gets two lines' worth of room beside the thumbnail.
 */
export const UPCOMING_CARD_WIDTH = Dimensions.get('window').width * 0.58;

/**
 * One entry in an upcoming carousel — the Events screen's and the feed's —
 * as a line of copy with its picture beside it, not over it.
 *
 * A poster is almost never a card's shape, so as a backdrop it was either
 * cropped into a strip of somebody's flyer or left the title fighting a busy
 * image through a scrim. As a fixed square beside the text the picture is
 * still there to recognise the event by, the copy sits on a plain card where
 * it reads, and the whole row is a fraction of the height.
 *
 * Every line has a fixed budget — the tag row, two for the title, one for the
 * day — so cards stay the same height side by side.
 */
function UpcomingCard({ tag, color, badge, title, when, image, region, width, onPress }: {
  /** Category, or "ORS Rally" — a pill in `color`. */
  tag: string;
  color: string;
  /** A gold pill beside the tag — "ORS Event". */
  badge?: string;
  title?: string;
  when?: string | null;
  image?: string | null;
  /** Region key — draws the little US map on the thumbnail. See RegionBadge. */
  region?: string | null;
  width?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, width != null && { width }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.thumb}>
        <EventImage uri={image} style={StyleSheet.absoluteFill} />
        {/* Top right, over the photo's corner — the card already says what and
            when, and this says where without a line of text. */}
        {region ? (
          <View style={styles.regionBadge}>
            <RegionBadge region={region} size={30} />
          </View>
        ) : null}
      </View>

      <View style={styles.text}>
        <View style={styles.tags}>
          <View style={[styles.pill, styles.tagPill, { backgroundColor: color }]}>
            <Text style={[styles.pillText, { color: contrastText(color) }]} numberOfLines={1}>{tag}</Text>
          </View>
          {badge ? (
            <View style={[styles.pill, { backgroundColor: ORS_EVENT_COLOR }]}>
              <Text style={[styles.pillText, { color: COLOR_BLACK }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.foot}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {when ? <Text style={styles.meta} numberOfLines={1}>{when}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/** A society event — or one occurrence of a repeating one. */
export function UpcomingEventCard({ event, width, showRegion, onPress }: {
  event: SocietyEvent;
  width?: number;
  /**
   * Draw the little US map on the thumbnail. On the Events screen, where a row
   * of cards spans the country and where each one is is worth knowing at a
   * glance; off in the feed, which is already a column of somewhere else.
   */
  showRegion?: boolean;
  onPress: (event: SocietyEvent) => void;
}) {
  const category = categoryFor(event.category);
  // The day only — no time, no address. A multi-day event arrives once and
  // says its whole span rather than just the day it starts.
  const when = formatEventRange(event) ?? formatEventDate(occurrenceDate(event), { weekday: true });

  return (
    <UpcomingCard
      tag={category.label}
      color={category.color}
      badge={event.ors_sponsored ? 'ORS Event' : undefined}
      title={event.title}
      when={when}
      image={firstGalleryUrl(event.gallery)}
      region={showRegion ? event.region : null}
      width={width}
      onPress={() => onPress(event)}
    />
  );
}

/**
 * An ORS rally, as one more card among the events.
 *
 * A rally isn't a society event and comes from its own endpoint, but where it
 * sits in the feed's row it has to read as one more card rather than a
 * different kind of object. "ORS Rally" in ORS gold stands in for a category.
 */
export function UpcomingRallyCard({ rally, width, onPress }: {
  rally: Rally;
  width?: number;
  onPress: () => void;
}) {
  return (
    <UpcomingCard
      tag="ORS Rally"
      color={ORS_EVENT_COLOR}
      title={rally.title}
      // Never blank: an unscheduled rally says so rather than losing the line.
      when={formatEventDate(rally.event_date, { weekday: true }) || RALLY_DATE_TBA}
      image={rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery)}
      width={width}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    // No padding on the picture's side: it runs to the card's top, bottom and
    // left edges, and the card's clip rounds its left corners.
    paddingRight: 10,
    borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: COLOR_GRAY_26,
  },
  thumb: {
    // The card's full height (what the padding used to add), square.
    width: THUMB + 20, height: THUMB + 20,
    // Rounded only where it meets the words — the card's own radius.
    borderTopRightRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden',
    backgroundColor: COLOR_GRAY_38,
  },
  regionBadge: { position: 'absolute', top: 4, right: 4 },
  // The picture's full height: the pills up top, the title and day at the foot.
  text: {
    flex: 1, minWidth: 0, height: THUMB + 20, paddingVertical: 10,
    justifyContent: 'space-between',
  },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: { gap: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  // The category gives way before the ORS badge does — the badge is short and
  // is the rarer, more telling of the two.
  tagPill: { flexShrink: 1 },
  pillText: { fontSize: 9, fontFamily: FONT_INTER.extrabold },
  title: { fontSize: 12.5, lineHeight: 16, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  meta: { fontSize: 12, lineHeight: 15, fontFamily: FONT_INTER.semibold, color: 'rgba(255,255,255,0.6)' },
});
