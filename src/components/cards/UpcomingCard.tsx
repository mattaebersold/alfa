import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import EventImage from '../society/EventImage';
import RegionBadge from '../ui/RegionBadge';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { RALLY_DATE_TBA } from '../../utils/rally';
import {
  categoryFor, occurrenceDate, formatEventDate, formatEventRange, ORS_EVENT_COLOR,
} from '../../constants/eventTypes';
import { contrastText } from '../../hooks/useBrandColor';
import type { Rally, SocietyEvent } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

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
              <Text style={[styles.pillText, { color: '#000000' }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {when ? <Text style={styles.meta} numberOfLines={1}>{when}</Text> : null}
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
    padding: 10,
    borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: '#1A1A1A',
  },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 8, overflow: 'hidden',
    backgroundColor: '#262626',
  },
  regionBadge: { position: 'absolute', top: 4, right: 4 },
  // Three lines at most — pills 18, title 32, the day 15 — centred in the
  // thumb's height.
  text: { flex: 1, minWidth: 0, height: THUMB, justifyContent: 'center', gap: 1 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  // The category gives way before the ORS badge does — the badge is short and
  // is the rarer, more telling of the two.
  tagPill: { flexShrink: 1 },
  pillText: { fontSize: 10.5, fontWeight: '800' },
  title: { fontSize: 12.5, lineHeight: 16, fontWeight: '800', color: '#FFFFFF' },
  meta: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
});
