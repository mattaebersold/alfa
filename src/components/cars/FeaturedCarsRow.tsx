import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useGetSiteSettingsQuery, useGetUserByIdQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import Avatar from '../ui/Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 0;
const CARD_GAP = 10;
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_HEIGHT = 240;
const S3 = 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com/';

interface Props {
  onCarPress: (carId: string) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function FeaturedCard({ car, onPress }: { car: any; onPress: () => void }) {
  const { data: owner } = useGetUserByIdQuery(car.user_id, { skip: !car.user_id });
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? `${S3}${car.profile_image}` : null);
  const avatarFilename = owner?.gallery?.[0]?.filename ?? owner?.profilePicture;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      <Image
        source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <View style={styles.overlay} />
      <View style={styles.info}>
        <View style={styles.infoRow}>
          <View style={styles.infoText}>
            {car.title && (
              <Text style={styles.carTitle} numberOfLines={1}>{car.title}</Text>
            )}
            <Text style={car.title ? styles.carSubtitle : styles.carTitle} numberOfLines={1}>
              {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
            </Text>
          </View>
          {owner && (
            <Avatar filename={avatarFilename} name={owner.username ?? '?'} size={36} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function FeaturedCarsRow({ onCarPress }: Props) {
  const { data } = useGetSiteSettingsQuery();
  const raw = data?.featured_cars ?? [];

  const cars = useMemo(() => shuffle(raw), [raw.length]);

  if (!cars.length) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Featured Cars</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        contentOffset={{ x: 0, y: 0 }}
        decelerationRate="fast"
        pagingEnabled={false}
      >
        {cars.map((car) => (
          <FeaturedCard
            key={car.internal_id}
            car={car}
            onPress={() => onCarPress(car.internal_id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { backgroundColor: '#000', paddingTop: 14, paddingBottom: 14 },
  heading:    { fontSize: 16, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 14, marginBottom: 10, color: '#FFFFFF' },
  scroll:     { gap: CARD_GAP, paddingHorizontal: H_PAD },
  card:       {
    width: CARD_WIDTH, height: CARD_HEIGHT,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#111',
  },
  overlay:    {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  info:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText:   { flex: 1 },
  carTitle:   { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  carSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
