import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react-native';
import RallyDetailSheet from './RallyDetailSheet';
import { useGetRallysQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Rally } from '../../types/api';
import RowEndSpacer from '../ui/RowEndSpacer';
import { calendarDate } from '../../utils/calendarDate';
import { RALLY_DATE_TBA } from '../../utils/rally';

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
 * the bottom of it — it lost its own lettering under ours.
 *
 * No card behind any of it: the rounded image is the object, and the copy
 * runs under it straight on the page, flush with the image's edges.
 */
function RallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  // The frame the card holds until the photo reports its own shape, and for
  // rallies with no photo at all.
  const [ratio, setRatio] = useState(FALLBACK_RATIO);

  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
  const eventDay = calendarDate(rally.event_date);
  // Never null: an unscheduled rally says so rather than losing the line.
  const date = eventDay ? format(eventDay, 'MMM d, yyyy') : RALLY_DATE_TBA;

  return (
    <TouchableOpacity
      style={{ width: CARD_WIDTH }}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.image, { aspectRatio: ratio, backgroundColor: colors.segment }]}>
        {hero ? (
          <Image
            source={{ uri: hero }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onLoad={({ source }) => {
              if (source?.width && source?.height) {
                setRatio(Math.min(Math.max(source.width / source.height, MIN_RATIO), MAX_RATIO));
              }
            }}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.date}>{date}</Text>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        {rally.location ? (
          <View style={styles.meta}>
            <MapPin size={10} color={colors.grey} />
            <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/** Until the photo loads, and for rallies without one. */
const FALLBACK_RATIO = 16 / 10;
/**
 * Bounds on the photo's own shape. A tall poster is the point, but one tall
 * enough to push the details off the screen isn't — 4:5 is as tall as a
 * portrait gets here, and only a panorama would hit the wide end.
 */
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 2.4;

const styles = StyleSheet.create({
  head:    { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  heading: { fontSize: 20, fontWeight: '800' },

  // Top-aligned: photos of different shapes make cards of different heights,
  // and none should stretch to match a taller neighbour.
  row:  { paddingLeft: 12, gap: 12, alignItems: 'flex-start' },
  image: { borderRadius: 8, overflow: 'hidden' },

  // Flush with the image's left edge — only a little air above.
  body:  { paddingTop: 8, gap: 2 },
  date:  { fontSize: 10, fontWeight: '800', color: '#F0D689', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  meta:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, flexShrink: 1 },
});
