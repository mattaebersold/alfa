import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '../../theme/Text';
import { format } from 'date-fns';
import EventImage from '../society/EventImage';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Rally } from '../../types/api';
import { calendarDate } from '../../utils/calendarDate';
import { RALLY_DATE_TBA, rallyDateRange } from '../../utils/rally';
import { regionLabel } from '../../constants/regions';
import CalendarTile from '../society/CalendarTile';
import RegionBadge from '../ui/RegionBadge';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, PILL_RADIUS } from '../../constants/config';
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
  // Under the weekday: the start time, or for a multi-day run its span.
  const multiDay = !!rally.end_date && rally.end_date !== rally.event_date;
  const whenSub = multiDay ? rallyDateRange(rally) : (rally.event_time || null);
  const region = regionLabel(rally.region);

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.cardImage, { aspectRatio: ratio }]}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
      </View>
      <View style={styles.cardBody}>
        {/* The title on the left; the date and time on its right — the
            weekday and the start time (or the run's span) beside the tile. */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
          <View style={styles.when}>
            <View style={styles.whenText}>
              <Text style={[styles.weekday, { color: colors.fg }]} numberOfLines={1}>
                {eventDay ? format(eventDay, 'EEE') : RALLY_DATE_TBA}
              </Text>
              {whenSub ? <Text style={[styles.range, { color: colors.grey }]} numberOfLines={1}>{whenSub}</Text> : null}
            </View>
            {eventDay ? <CalendarTile date={eventDay} /> : null}
          </View>
        </View>
        {rally.location && <Text style={[styles.location, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>}

        {(region || rally.slots_available != null) && (
          <View style={styles.foot}>
            {region ? (
              <View style={styles.region}>
                <RegionBadge region={rally.region} size={18} backdrop={false} land="rgba(255,255,255,0.35)" />
                <Text style={styles.regionText} numberOfLines={1}>{region}</Text>
              </View>
            ) : null}
            {rally.slots_available != null && (
              <Text style={styles.slots}>{rally.slots_available} slots available</Text>
            )}
          </View>
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
  title:        { flex: 1, fontSize: 16, fontFamily: FONT_INTER.bold, lineHeight: 22 },
  location:     { fontSize: 13, marginTop: 4 },
  slots:        { fontSize: 12, color: colors.primaryAlt, fontFamily: FONT_INTER.bold },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  when:         { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, maxWidth: '45%' },
  whenText:     { alignItems: 'flex-end', flexShrink: 1 },
  weekday:      { fontSize: 13, fontFamily: FONT_INTER.bold },
  range:        { fontSize: 11.5, fontFamily: FONT_INTER.semibold, marginTop: 1, textAlign: 'right' },
  foot:         { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  region: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingLeft: 8, paddingRight: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  regionText:   { fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
