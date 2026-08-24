import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useGetUserGarageQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import type { TagItem } from './PostTagPicker';

const CARD_WIDTH = 104;

export const garageCarTag = (car: GarageCar): TagItem => ({
  id: car.internal_id,
  label: car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car',
  kind: 'car',
});

/**
 * Your own cars, as a row of thumbnails you tap to tag.
 *
 * Tagging one of your own cars is by far the commonest case, and the search
 * field made you type the name of a car you own to find it. These are the same
 * tags — tapping one is exactly what picking it out of the search results does
 * — so the field below is left to do what it's actually good for: finding
 * someone *else's* car.
 */
export default function GarageCarStrip({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (tag: TagItem) => void;
}) {
  const colors = useColors();
  const { data } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

  if (cars.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.grey }]}>Your garage</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cars.map((car) => {
          const selected = selectedIds.includes(car.internal_id);
          const hero = firstGalleryUrl(car.gallery)
            ?? (car.profile_image ? imageUrl(car.profile_image) : null);
          const tag = garageCarTag(car);

          return (
            <TouchableOpacity
              key={car.internal_id}
              style={[
                styles.card,
                { borderColor: selected ? colors.teal : colors.inputBorder, backgroundColor: colors.inputBg },
              ]}
              onPress={() => onToggle(tag)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${selected ? 'Untag' : 'Tag'} ${tag.label}`}
            >
              <Image
                source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
                style={styles.image}
                contentFit="cover"
                transition={150}
              />
              {selected && (
                <View style={[styles.check, { backgroundColor: colors.teal }]}>
                  <Check size={11} color="#FFFFFF" strokeWidth={3.5} />
                </View>
              )}
              <Text style={[styles.label, { color: colors.fg }]} numberOfLines={2}>{tag.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { marginBottom: 12 },
  heading: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  row:     { gap: 8, paddingRight: 4 },
  card:    { width: CARD_WIDTH, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden', paddingBottom: 6 },
  image:   { width: '100%', height: 62 },
  check:   {
    position: 'absolute', top: 5, right: 5,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  label:   { fontSize: 11, fontWeight: '700', paddingHorizontal: 6, paddingTop: 5, lineHeight: 14 },
});
