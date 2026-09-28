import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@ors/kit';
import { format } from 'date-fns';
import RallyDetailSheet from './RallyDetailSheet';
import EventImage from './EventImage';
import { useGetRallysQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Rally } from '../../types/api';
import RowEndSpacer from '../ui/RowEndSpacer';
import { calendarDate } from '../../utils/calendarDate';
import { RALLY_DATE_TBA } from '../../utils/rally';
import { COLOR_BLACK, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Cards stop short of full width so the next one peeks, matching the events row.
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
/** A card's corners, and its picture's — tighter than the app's radius. */
const CARD_RADIUS = 12;

/**
 * ORS Rallys as a horizontal row, pulling the same list the Rallys section
 * shows. Tapping one opens the same detail sheet used there.
 */
export default function RallyCarousel() {
  const colors = useColors();
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);
  const { data } = useGetRallysQuery({ page: 0, limit: 12 });

  const rallys = data?.entries ?? [];
  if (rallys.length === 0) return null;

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.heading, { color: colors.fg }]}>ORS Rallys</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + 12}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {rallys.map((rally: Rally) => (
          <RallyCard
            key={rally.internal_id}
            rally={rally}
            onPress={() => setSelectedRallyId(rally.internal_id)}
          />
        ))}
        <RowEndSpacer />
      </ScrollView>

      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </View>
  );
}

/**
 * One rally: its picture whole, then the details under it.
 *
 * The photo takes its own shape rather than a fixed frame. Rally art is
 * usually a poster, and cropped to a landscape card — with the copy laid over
 * the bottom of it — it lost its own lettering under ours. Nothing sits on the
 * photo now; the title and the day go under it, on the same card surface the event cards use, so a rally in
 * this row reads as one more event rather than a different kind of object.
 */
function RallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const { ratio, onAspectRatio } = useNaturalRatio(FALLBACK_RATIO);

  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
  const eventDay = calendarDate(rally.event_date);
  // Never null: an unscheduled rally says so rather than losing the line.
  const date = eventDay ? format(eventDay, 'EEE, MMM d, yyyy') : RALLY_DATE_TBA;

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_WIDTH, backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.photo, { aspectRatio: ratio }]}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        <Text style={[styles.date, { color: colors.grey }]}>{date}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Until the photo loads, and for rallies without one. The bounds on the
 * photo's own shape are the event cards' — see `clampCardRatio`.
 */
const FALLBACK_RATIO = 16 / 10;

const styles = StyleSheet.create({
  head:    { paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: 10 },
  heading: { fontSize: 20, fontFamily: FONT_INTER.bold },

  // Stretched: photos of different shapes make cards of different heights, and
  // every card grows to the tallest's, so the row ends in one straight line.
  row:  { paddingLeft: GUTTER, gap: 12, alignItems: 'stretch' },
  card: {
    borderRadius: CARD_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // Rounded at the foot too, where it meets the words — the card's radius, as
  // the upcoming event cards' pictures are.
  photo: { borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden' },

  // Fills what's left of a stretched card: the title up top, the day at the foot.
  body:  { flexGrow: 1, padding: 12, gap: 4, justifyContent: 'space-between' },
  date:  { fontSize: 12, fontFamily: FONT_INTER.semibold },
  title: { fontSize: 14, lineHeight: 18, fontFamily: FONT_INTER.extrabold },
});
