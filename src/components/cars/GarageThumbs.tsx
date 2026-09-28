import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image as ExpoImage } from 'expo-image';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_58, COLOR_WHITE } from '../../constants/config';

/**
 * Up to `max` overlapping car photos from the user's garage, followed by a
 * "+N" chip when the garage holds more than that. Renders nothing for an empty
 * garage — the button's door icon already stands on its own.
 *
 * Shared by the header's garage button and the one on your profile banner, so
 * the two read as the same door.
 */
export default function GarageThumbs({ cars, max = 2, size = 23, total }: {
  cars: GarageCar[];
  max?: number;
  /** Each photo's diameter. The overlap and the "+N" scale with it. */
  size?: number;
  /** The garage's real size, when `cars` is only a page of it — for the "+N". */
  total?: number;
}) {
  const shown = cars.slice(0, max);
  const overflow = (total ?? cars.length) - shown.length;
  const dims = { width: size, height: size, borderRadius: size / 2 };
  const overlap = { marginLeft: -Math.round(size * 0.37) };
  if (shown.length === 0) return null;

  return (
    <View style={styles.thumbRow}>
      {shown.map((car, i) => {
        const uri = car.profile_image
          ? imageUrl(car.profile_image) ?? undefined
          : firstGalleryUrl(car.gallery) ?? undefined;
        return (
          <ExpoImage
            key={car.internal_id ?? i}
            source={{ uri }}
            style={[styles.thumb, dims, i > 0 && overlap]}
            contentFit="cover"
          />
        );
      })}
      {overflow > 0 && (
        <View style={[styles.thumb, dims, overlap, styles.thumbMore]}>
          <Text style={[styles.thumbMoreText, { fontSize: size * 0.41 }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbRow:     { flexDirection: 'row', alignItems: 'center' },
  thumb:        { borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.25)' },
  // Solid dark grey rather than 75% black: the button behind it is now a 10%
  // black wash, so a translucent chip picked up whatever photo was underneath
  // and the count sat on a moving ground.
  thumbMore:    { backgroundColor: COLOR_GRAY_58, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:{ fontWeight: '800', color: COLOR_WHITE },
});
