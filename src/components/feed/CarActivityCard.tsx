import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { Wrench, Images } from 'lucide-react-native';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Avatar from '../ui/Avatar';
import type { CarActivityItem } from '../../types/api';

/**
 * Feed row for something added to a car you follow — a mod, or a set of photos.
 *
 * Following a car only ever produced a notification before, which is the wrong
 * shape for "here's what happened": notifications are read once and cleared,
 * and the photos never appeared at all. This puts the work itself in the feed,
 * with the car it belongs to named in the attribution line and the whole row
 * opening that car.
 */
export default function CarActivityCard({ item }: { item: CarActivityItem }) {
  const colors = useColors();
  const nav = useNavigation();
  const car = item.car;
  const { data: owner } = useGetUserByIdQuery(car?.user_id ?? '', { skip: !car?.user_id });

  if (!car) return null;

  const carName = car.title
    || [car.year, car.make, car.model].filter(Boolean).join(' ')
    || 'their car';
  const timeAgo = item.created_at
    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
    : '';

  // The item's own photo where it has one — that's the new thing. The car's
  // picture stands in when a mod was logged without one, so the row still shows
  // what it's about rather than an empty grey block.
  const hero = firstGalleryUrl(item.gallery)
    ?? firstGalleryUrl(car.gallery)
    ?? (car.profile_image ? imageUrl(car.profile_image) : null);

  const isMod = item.kind === 'mod';
  const Icon = isMod ? Wrench : Images;
  const photoCount = item.gallery?.length ?? 0;
  const verb = isMod
    ? 'added a mod to'
    : photoCount > 1 ? `added ${photoCount} photos to` : 'added photos to';

  const openCar = () => (nav as any).navigate('CarDetail', { carId: car.internal_id });

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.attribution}
        onPress={() => owner && (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
        activeOpacity={0.7}
        disabled={!owner}
      >
        <Avatar user={owner} size={30} />
        <View style={styles.attributionText}>
          <Text style={[styles.line, { color: colors.fg }]} numberOfLines={2}>
            <Text style={styles.name}>@{owner?.username ?? 'Someone'}</Text>
            <Text style={{ color: colors.muted }}> {verb} </Text>
            <Text style={styles.name}>{carName}</Text>
          </Text>
          {timeAgo ? <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text> : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={openCar}
        activeOpacity={0.92}
      >
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.info}>
          <View style={[styles.kindPill, { backgroundColor: colors.segment }]}>
            <Icon size={11} color={colors.primaryAlt} />
            <Text style={[styles.kindText, { color: colors.primaryAlt }]}>
              {isMod ? 'Mod' : 'Gallery'}
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
            {item.title || (isMod ? 'New mod' : 'New photos')}
          </Text>
          {item.body ? (
            <Text style={[styles.body, { color: colors.muted }]} numberOfLines={2}>{item.body}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { marginBottom: 6 },
  attribution: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
  },
  attributionText: { flex: 1 },
  line: { fontSize: 13.5, lineHeight: 18 },
  name: { fontWeight: '800' },
  time: { fontSize: 11, marginTop: 2 },

  card: {
    borderRadius: 12, overflow: 'hidden',
    marginHorizontal: 12, marginVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  image: { width: '100%', aspectRatio: 4 / 3 },
  info:  { padding: 12, gap: 5 },
  kindPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  kindText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  title: { fontSize: 16, fontWeight: '800' },
  body:  { fontSize: 13, lineHeight: 18 },
});
