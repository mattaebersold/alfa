import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import Avatar from '../ui/Avatar';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';

const CARD_WIDTH = Dimensions.get('window').width * 0.62;
const S3 = 'https://partstash-ghia-images.s3.us-west-2.amazonaws.com/';

interface Props {
  onCarPress: (carId: string) => void;
}

export default function FeaturedCarsRow({ onCarPress }: Props) {
  const colors = useColors();
  const { data } = useGetSiteSettingsQuery();
  const cars = data?.featured_cars ?? [];

  if (!cars.length) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.fg }]}>Featured Cars</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {cars.map((car) => {
          const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? `${S3}${car.profile_image}` : null);
          return (
            <TouchableOpacity
              key={car.internal_id}
              style={[styles.card, { backgroundColor: colors.secondary }]}
              onPress={() => onCarPress(car.internal_id)}
              activeOpacity={0.88}
            >
              {hero ? (
                <Image source={{ uri: hero }} style={styles.image} contentFit="cover" />
              ) : (
                <View style={[styles.image, { backgroundColor: colors.primaryAlt }]} />
              )}
              <View style={styles.overlay}>
                <Text style={styles.carTitle} numberOfLines={1}>
                  {car.year} {car.make} {car.model}
                </Text>
                {car.user && (
                  <View style={styles.ownerRow}>
                    <Avatar
                      filename={car.user?.gallery?.[0]?.filename}
                      name={car.user?.firstName ?? '?'}
                      size={14}
                    />
                    <Text style={styles.ownerName} numberOfLines={1}>
                      {car.user.firstName} {car.user.lastName}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { paddingTop: 14, paddingBottom: 4, borderBottomWidth: 1 },
  heading:    { fontSize: 16, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 12, marginBottom: 10 },
  scroll:     { paddingHorizontal: 12, gap: 10, paddingBottom: 12 },
  card:       { width: CARD_WIDTH, borderRadius: 10, overflow: 'hidden' },
  image:      { width: '100%', aspectRatio: 16 / 9 },
  overlay:    { padding: 8 },
  carTitle:   { fontSize: 12, fontWeight: '700', color: '#e0e0e0' },
  ownerRow:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  ownerName:  { fontSize: 11, color: '#555', flex: 1 },
});
