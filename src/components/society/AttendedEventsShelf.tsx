import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import RowEndSpacer from '../ui/RowEndSpacer';
import EventImage from './EventImage';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import { categoryFor, eventCityState, formatEventDate } from '../../constants/eventTypes';
import type { SocietyEvent } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

const CARD_WIDTH = 168;
const CARD_GAP = 10;
const ROW_PAD_LEFT = 16;
const MEDIA_RATIO = 4 / 3;
/** The profile shelves' card shade — see PostStrip and PhotoSpotShelf. */
const CARD_BG = SURFACE_MID;

/**
 * The events you've been to, as a shelf on your profile — the same shape as
 * the Photo spots shelf beside it: a card per date attended, latest first, each
 * the event's poster with its kind on it, then its name, the day and the town.
 *
 * Presentational, like the other shelves: the profile owns the fetch and what
 * a tap does. Renders nothing when there are none.
 */
export default function AttendedEventsShelf({ events, onEventPress }: {
  /** Past dates attended — one entry per date, so a weekly meet can be here twice. */
  events: SocietyEvent[];
  onEventPress: (event: SocietyEvent) => void;
}) {
  const colors = useColors();
  if (events.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>Events attended</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {events.map((event) => {
          const category = categoryFor(event.category);
          const day = event.day ?? event.date;
          const where = eventCityState(event);
          return (
            <TouchableOpacity
              key={`${event.internal_id}-${event.day ?? ''}`}
              style={[styles.card, { borderColor: colors.borderDark }]}
              onPress={() => onEventPress(event)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={event.title}
            >
              <View style={styles.imageWrap}>
                <EventImage uri={firstGalleryUrl(event.gallery, 'small')} style={styles.image} />
                <View style={[styles.typeBadge, { backgroundColor: category.color }]}>
                  <Text style={styles.typeText} numberOfLines={1}>{category.label}</Text>
                </View>
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.fg }]} numberOfLines={2}>{event.title}</Text>
                <Text style={[styles.meta, { color: colors.grey }]} numberOfLines={1}>
                  {[formatEventDate(day, { year: true }), where].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: { paddingHorizontal: 16, paddingBottom: 10 },
  title: { fontSize: 17, fontFamily: FONT_INTER.bold },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: {
    width: CARD_WIDTH, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, backgroundColor: CARD_BG,
  },
  // Rounded along its foot too, as the Photo spots cards are.
  imageWrap: { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: MEDIA_RATIO, backgroundColor: SURFACE_MID },
  typeBadge: {
    position: 'absolute', left: 8, bottom: 8, maxWidth: CARD_WIDTH - 16,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  typeText: { fontSize: 11, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  body: { padding: 10, gap: 4 },
  name: { fontSize: 13, fontFamily: FONT_INTER.semibold, lineHeight: 17 },
  meta: { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
});
