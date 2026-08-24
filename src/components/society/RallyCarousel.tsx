import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { MapPin } from 'lucide-react-native';
import RallyDetailSheet from './RallyDetailSheet';
import { useGetRallysQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { Rally } from '../../types/api';
import RowEndSpacer from '../ui/RowEndSpacer';
import { calendarDate } from '../../utils/calendarDate';

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
        {rallys.map((rally: Rally) => {
          const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
          const eventDay = calendarDate(rally.event_date);
          const date = eventDay ? format(eventDay, 'MMM d, yyyy') : null;

          return (
            <TouchableOpacity
              key={rally.internal_id}
              style={[styles.card, { width: CARD_WIDTH, backgroundColor: colors.card }]}
              onPress={() => setSelectedRallyId(rally.internal_id)}
              activeOpacity={0.9}
            >
              {hero ? (
                <Image source={{ uri: hero }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.segment }]} />
              )}

              <LinearGradient
                colors={['transparent', 'rgba(15,15,15,0.85)']}
                locations={[0.35, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              <View style={styles.body}>
                {date && <Text style={styles.date}>{date}</Text>}
                <Text style={styles.title} numberOfLines={2}>{rally.title}</Text>
                {rally.location ? (
                  <View style={styles.meta}>
                    <MapPin size={11} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.metaText} numberOfLines={1}>{rally.location}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>

      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  head:    { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10 },
  heading: { fontSize: 20, fontWeight: '800' },

  row:  { paddingLeft: 12, gap: 12 },
  card: { aspectRatio: 16 / 10, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end' },

  body:  { padding: 12, gap: 3 },
  date:  { fontSize: 11, fontWeight: '800', color: '#F0D689', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  meta:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: 'rgba(255,255,255,0.85)', flexShrink: 1 },
});
