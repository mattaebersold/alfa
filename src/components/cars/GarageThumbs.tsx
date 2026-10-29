import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image as ExpoImage } from '../ui/AppImage';
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
/** How far each photo after the first tucks under the one before, as a share of its size. */
const OVERLAP = 0.37;
/** The soft drop each photo casts with `shadow`, so the stack reads as pieces laid on the button. */
const THUMB_SHADOW = '0px 2px 5px rgba(0, 0, 0, 0.75)';

/** Each photo's advance along the row. */
const stepFor = (size: number, overlap: number) => size - Math.round(size * overlap);

/**
 * The row's drawn width for `shown` photos, plus the "+N" chip when `more` —
 * for a caller fitting as many as its room allows.
 */
export function garageThumbsWidth(shown: number, more: boolean, size = 23, overlap = OVERLAP): number {
  if (shown <= 0) return 0;
  return size + stepFor(size, overlap) * (shown - 1 + (more ? 1 : 0));
}

export default function GarageThumbs({ cars, max = 2, size = 23, overlap = OVERLAP, shadow = false, total }: {
  cars: GarageCar[];
  max?: number;
  /** Each photo's diameter. The overlap and the "+N" scale with it. */
  size?: number;
  /** How far each tucks under the one before, as a share of its size — smaller spaces them out. */
  overlap?: number;
  /** A soft shadow under each photo. */
  shadow?: boolean;
  /** The garage's real size, when `cars` is only a page of it — for the "+N". */
  total?: number;
}) {
  const shown = cars.slice(0, max);
  const overflow = (total ?? cars.length) - shown.length;
  const dims = { width: size, height: size, borderRadius: size / 2 };
  const tuck = { marginLeft: stepFor(size, overlap) - size };
  const drop = shadow ? { boxShadow: THUMB_SHADOW } : null;
  if (shown.length === 0) return null;

  return (
    <View style={styles.thumbRow}>
      {shown.map((car, i) => {
        const uri = car.profile_image
          ? imageUrl(car.profile_image) ?? undefined
          : firstGalleryUrl(car.gallery) ?? undefined;
        return (
          // The shadow on a wrapper: the image clips to its circle.
          <View key={car.internal_id ?? i} style={[dims, i > 0 && tuck, drop]}>
            <ExpoImage small source={{ uri }} style={dims} contentFit="cover" />
          </View>
        );
      })}
      {overflow > 0 && (
        <View style={[dims, tuck, drop, styles.thumbMore]}>
          <Text style={[styles.thumbMoreText, { fontSize: size * 0.41 }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumbRow:     { flexDirection: 'row', alignItems: 'center' },
  // Solid dark grey rather than 75% black: the button behind it is now a 10%
  // black wash, so a translucent chip picked up whatever photo was underneath
  // and the count sat on a moving ground.
  thumbMore:    { backgroundColor: COLOR_GRAY_58, alignItems: 'center', justifyContent: 'center' },
  thumbMoreText:{ fontWeight: '800', color: COLOR_WHITE },
});
