import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react-native';
import RallyDetailSheet from './RallyDetailSheet';
import EventImage from './EventImage';
import EventPills from './EventPills';
import { useGetRallysQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Rally } from '../../types/api';
import RowEndSpacer from '../ui/RowEndSpacer';
import { calendarDate } from '../../utils/calendarDate';
import { RALLY_DATE_TBA } from '../../utils/rally';
import { COMMON_RADIUS } from '../../constants/radius';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Cards stop short of full width so the next one peeks, matching the events row.
const CARD_WIDTH = SCREEN_WIDTH * 0.72;

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
 * photo now; the gold "ORS Rally" pill, the day, the title and the place all
 * go under it, on the same card surface the event cards use, so a rally in
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
      <View style={{ aspectRatio: ratio }}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
      </View>

      <View style={styles.body}>
        <EventPills />
        <Text style={styles.date}>{date}</Text>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        {rally.location ? (
          <View style={styles.meta}>
            <MapPin size={11} color={colors.grey} />
            <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>
          </View>
        ) : null}
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
  head:    { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  heading: { fontSize: 20, fontWeight: '800' },

  // Top-aligned: photos of different shapes make cards of different heights,
  // and none should stretch to match a taller neighbour.
  row:  { paddingLeft: 12, gap: 12, alignItems: 'flex-start' },
  card: {
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  body:  { padding: 12, gap: 5 },
  // ORS gold, like the pill above it — the one colour a rally has.
  date:  { fontSize: 11, fontWeight: '800', color: '#F0D689', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  meta:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, flexShrink: 1 },
});
