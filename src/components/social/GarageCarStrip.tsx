import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import { useGetUserGarageQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import type { TagItem } from './PostTagPicker';
import { COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

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
  bleed = 0,
}: {
  selectedIds: string[];
  onToggle: (tag: TagItem) => void;
  /**
   * The padding of whatever it sits in. The strip reaches out past it to that
   * container's edges, so the cars scroll edge to edge, and the first one
   * still starts on the padding line.
   */
  bleed?: number;
}) {
  const colors = useColors();
  const { data } = useGetUserGarageQuery();
  const cars = data?.entries ?? [];

  if (cars.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={[styles.row, { paddingHorizontal: bleed }]}
      >
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
                // No border and no ground of its own — the photo is the tile,
                // and tagged is the teal check on it.
                { backgroundColor: colors.inputBg },
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
                  <Check size={11} color={COLOR_WHITE} strokeWidth={3.5} />
                </View>
              )}
              {/* On the photo rather than in a bar under it: the name sits in
                  the image's lower edge, on a see-through band. */}
              <Text style={styles.label} numberOfLines={2}>{tag.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { marginBottom: 12 },
  row:     { gap: 8 },
  // Tighter corners than the app's radius: at this size a full one rounds
  // away a real share of a small photo.
  card:    { width: CARD_WIDTH, borderRadius: 6, overflow: 'hidden' },
  // Taller now that it carries the name — the photo is the whole tile.
  image:   { width: '100%', height: 78 },
  check:   {
    position: 'absolute', top: 5, right: 5,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  label:   {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 6, paddingTop: 4, paddingBottom: 5,
    fontSize: 11, fontFamily: FONT_INTER.bold, lineHeight: 14, color: COLOR_WHITE,
    // A see-through black band across the photo's foot, so the name reads over
    // any picture without hiding the car behind it.
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
