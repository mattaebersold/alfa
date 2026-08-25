import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Car as CarIcon } from 'lucide-react-native';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Avatar from '../ui/Avatar';
import { TYPE_COLORS, formatLabel } from '../cards/CarCard';
import type { GarageCar } from '../../types/api';

/**
 * Feed row for a car someone you follow added to their garage.
 *
 * A new car isn't a post about a car, and the two used to be told apart only by
 * a line of small text above an otherwise identical card. This is one poster
 * instead: the whole thing is the photo, the attribution rides on top of it,
 * and the car's name, its year/make/model and its badges are stacked over the
 * bottom under a car mark. Nothing sits outside the image, so it reads as an
 * announcement rather than as another entry in the stream.
 */
export default function GarageAdditionCard({ car }: { car: GarageCar }) {
  const colors = useColors();
  const nav = useNavigation();
  const { data: owner } = useGetUserByIdQuery(car.user_id, { skip: !car.user_id });

  const carTitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
  const displayTitle = car.title || carTitle || 'a car';
  // Only when the owner named it — otherwise the subtitle would repeat the
  // title word for word.
  const subtitle = car.title ? [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ') : car.trim;
  const timeAgo = car.created_at
    ? formatDistanceToNow(new Date(car.created_at), { addSuffix: true })
    : '';

  const typeBadge = TYPE_COLORS[car.type ?? ''];
  const typeLabel = formatLabel(car.type);
  const categoryLabel = formatLabel(car.category);

  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);

  return (
    <TouchableOpacity
      // The type colour edges the card, but at low alpha — it's a tint that
      // registers in passing, not a frame competing with the photo inside it.
      style={[styles.card, { borderColor: typeBadge ? `${typeBadge.bg}80` : colors.borderDark }]}
      onPress={() => (nav as any).navigate('CarDetail', { carId: car.internal_id })}
      activeOpacity={0.92}
    >
      <Image
        source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
        style={styles.image}
        contentFit="cover"
        transition={250}
      />

      {/* Two scrims: one anchors the attribution, one carries the name block.
          A single flat dim would wash out the middle of the photo, which is
          the part worth showing. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.25)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={styles.scrimTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        locations={[0, 0.5, 1]}
        style={styles.scrimBottom}
        pointerEvents="none"
      />

      <TouchableOpacity
        style={styles.attribution}
        onPress={() => owner && (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
        activeOpacity={0.7}
        disabled={!owner}
      >
        <Avatar filename={owner?.gallery?.[0]?.filename} name={owner?.username ?? '?'} size={28} />
        <View style={styles.attributionText}>
          <Text style={styles.line} numberOfLines={1}>
            <Text style={styles.name}>@{owner?.username ?? 'Someone'}</Text>
            <Text style={styles.lineMuted}> added a car to their garage</Text>
          </Text>
          {timeAgo ? <Text style={styles.time}>{timeAgo}</Text> : null}
        </View>
      </TouchableOpacity>

      <View style={styles.plate} pointerEvents="none">
        <CarIcon size={38} color="#FFFFFF" strokeWidth={1.6} />
        <Text style={styles.title} numberOfLines={2}>{displayTitle}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        {(typeLabel || categoryLabel) && (
          <View style={styles.badges}>
            {typeLabel && typeBadge && (
              <View style={[styles.badge, { backgroundColor: typeBadge.bg }]}>
                <Text style={[styles.badgeText, { color: typeBadge.text }]}>{typeLabel}</Text>
              </View>
            )}
            {categoryLabel && (
              <View style={[styles.badge, styles.badgeDark]}>
                <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>{categoryLabel}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    marginHorizontal: 12, marginVertical: 8,
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.25,
    backgroundColor: '#111111',
  },
  // Taller than a CarCard's 4:3 — the name block needs room under the car
  // without covering it.
  image: { width: '100%', aspectRatio: 1 },

  scrimTop:    { position: 'absolute', left: 0, right: 0, top: 0, height: '34%' },
  scrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },

  attribution: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  attributionText: { flex: 1 },
  line:      { fontSize: 13, lineHeight: 17, color: '#FFFFFF' },
  lineMuted: { color: 'rgba(255,255,255,0.78)' },
  name:      { fontWeight: '800', color: '#FFFFFF' },
  time:      { fontSize: 11, marginTop: 1, color: 'rgba(255,255,255,0.6)' },

  plate: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingBottom: 20,
  },
  title: {
    fontSize: 30, fontWeight: '800', color: '#FFFFFF', textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 12, fontWeight: '700', textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: -2,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 6 },
  badge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeDark: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
  },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
});
