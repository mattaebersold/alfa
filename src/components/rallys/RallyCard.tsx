import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@ors/kit';
import { format } from 'date-fns';
import EventImage from '../society/EventImage';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Rally } from '../../types/api';
import { calendarDate } from '../../utils/calendarDate';
import { RALLY_DATE_TBA } from '../../utils/rally';
import { COMMON_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

export const rallyHero = (rally: Rally) =>
  (rally.hero_image ? imageUrl(rally.hero_image) : null) ?? firstGalleryUrl(rally.gallery);

/**
 * The full card for an upcoming rally: hero, pill, date, title, and a way in.
 *
 * The card takes the photo's own shape rather than cropping it to 16/9. These
 * are the club's own posters and route maps as often as they are photographs,
 * and a fixed frame cut the tops off them. The bounds are the event cards' —
 * see `clampCardRatio` — so a rally and an event photo are the same shape.
 */
export default function RallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const hero = rallyHero(rally);
  // 16/9 until the photo reports its shape, and for rallies without one.
  const { ratio, onAspectRatio } = useNaturalRatio(16 / 9);
  const eventDay = calendarDate(rally.event_date);
  // Never null: an unscheduled rally says so rather than losing the line.
  const date = eventDay ? format(eventDay, 'EEE, MMM d, yyyy') : RALLY_DATE_TBA;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.cardImage, { aspectRatio: ratio }]}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.date}>{date}</Text>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        {rally.location && <Text style={[styles.location, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>}
        {rally.slots_available != null && (
          <Text style={styles.slots}>{rally.slots_available} slots available</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({

  card:         {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  // Rounded at the foot too, so the photo sits in the card rather than capping it.
  cardImage:    { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  cardBody:     { padding: 12 },
  date:         { fontSize: 12, fontFamily: FONT_INTER.bold, color: colors.primaryAlt, marginBottom: 4 },
  title:        { fontSize: 16, fontFamily: FONT_INTER.bold, lineHeight: 22 },
  location:     { fontSize: 13, marginTop: 4 },
  slots:        { fontSize: 12, color: colors.primaryAlt, fontFamily: FONT_INTER.bold, marginTop: 6 },
});
