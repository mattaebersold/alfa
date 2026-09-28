import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import {
  COMMON_RADIUS,
  COLOR_GRAY_17,
  COLOR_GRAY_208,
  COLOR_GRAY_26,
  COLOR_GRAY_46,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/** The photo panel's height. */
const PHOTO_H = 108;
/** How far each slice leans — the same as the site's tiles. */
const SKEW_DEG = 11;
/** How far, in points, each slice's top edge sits right of its bottom. */
const LEAN = PHOTO_H * Math.tan((SKEW_DEG * Math.PI) / 180);
/** The gap between slices — none: they meet, and a shadow marks the join (see sliceOver). */
const SEAM = 0;
const SKEW = `-${SKEW_DEG}deg`;
const UNSKEW = `${SKEW_DEG}deg`;

/**
 * A make or a model, as a tile: its cars' photos across the top — one full,
 * or two or three side by side in slanted slices — then its name and a grey
 * count beside it.
 *
 * The Brands screen's grid (count = models on the site) and a brand's model
 * carousel (count = cars of that model). In the carousel (`fitName`) the tile
 * is as wide as its name needs, so a name never breaks across two lines.
 */
export default function MakeTile({ name, subtitle, photos, count, countLabel, onPress, style, badge, fitName }: {
  name: string;
  /** A second, quieter line — the model a generation tile belongs to. */
  subtitle?: string;
  /** Up to three photo filenames. None, and the car glyph stands in. */
  photos?: string[];
  count?: number;
  /** For screen readers — "15 models", "4 cars". */
  countLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  /** Pinned to the tile's top-right corner — a bookmark mark, say. */
  badge?: React.ReactNode;
  /** Size to the name rather than to the host — for a horizontal row. */
  fitName?: boolean;
}) {
  const colors = useColors();
  const shots = (photos ?? []).slice(0, 3).map((f) => imageUrl(f)).filter((u): u is string => !!u);
  // The slices are laid out in points, so they wait for the panel's width.
  const [width, setWidth] = useState(0);

  return (
    <TouchableOpacity
      style={[styles.card, fitName && styles.cardFit, style]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={countLabel ? `${name}, ${countLabel}` : name}
    >
      <View style={styles.photos} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {shots.length === 0 ? (
          <View style={[styles.photo, styles.blank]}>
            <Car size={26} color={colors.grey} />
          </View>
        ) : shots.length === 1 ? (
          <Image source={{ uri: shots[0] }} style={styles.photo} contentFit="cover" transition={150} />
        ) : width > 0 ? (
          // Each slice is a skewed, clipping, square-cornered band; its photo
          // is skewed back inside it so the car stays upright. The outer two
          // run past the panel's edges, which the panel's own clip trims.
          shots.map((uri, i) => {
            const n = shots.length;
            const left = i === 0 ? -LEAN : (i * width) / n + SEAM / 2;
            const right = i === n - 1 ? width + LEAN : ((i + 1) * width) / n - SEAM / 2;
            const w = right - left;
            return (
              <View key={uri} style={[styles.slice, i > 0 && styles.sliceOver, { left, width: w, transform: [{ skewX: SKEW }] }]}>
                <Image
                  source={{ uri }}
                  style={[styles.sliceImage, { left: -LEAN / 2, width: w + LEAN, transform: [{ skewX: UNSKEW }] }]}
                  contentFit="cover"
                  transition={150}
                />
              </View>
            );
          })
        ) : null}
      </View>

      {badge ? <View style={styles.badge} pointerEvents="none">{badge}</View> : null}

      <View style={[styles.nameRow, fitName && styles.nameRowFill]}>
        <View style={styles.nameText}>
          <Text
            style={[styles.name, { color: colors.fg }]}
            numberOfLines={1}
            // In a fixed-width grid a long name shrinks rather than breaking.
            adjustsFontSizeToFit={!fitName}
            minimumFontScale={0.75}
          >
            {name}
          </Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.grey }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {count != null && count > 0 && (
          <View style={styles.countBubble}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    // No border; a step lighter than the page instead — the upcoming event
    // cards' grey.
    borderRadius: COMMON_RADIUS,
    backgroundColor: COLOR_GRAY_26,
    // No padding: the photos run to the card's edges, and the clip gives them
    // its top corners. The name brings its own.
    gap: 8, overflow: 'hidden',
  },
  // Sized by the name, but never narrower than a photo panel worth looking at.
  cardFit: { minWidth: 168 },
  // Rounded at the foot too, where it meets the name — the card's radius, as
  // the listing and event cards' pictures are.
  photos: {
    height: PHOTO_H, width: '100%', overflow: 'hidden',
    borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS,
  },
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: COLOR_GRAY_17 },
  slice: { position: 'absolute', top: 0, height: PHOTO_H, overflow: 'hidden' },
  // Every slice after the first casts a shadow back over the one before, so
  // they read as photos laid overlapping rather than cut from one.
  sliceOver: { boxShadow: '-4px 0px 10px rgba(0, 0, 0, 0.55)' },
  sliceImage: { position: 'absolute', top: 0, height: PHOTO_H, backgroundColor: COLOR_GRAY_17 },
  blank: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, zIndex: 10 },
  // The name on the left, the count on the right.
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7, paddingHorizontal: 12, paddingBottom: 8 },
  // In a row stretched to its tallest tile, the name centres vertically in what's left.
  nameRowFill: { flex: 1 },
  nameText: { flexShrink: 1, alignItems: 'flex-start' },
  name: { fontSize: 17, fontFamily: FONT_INTER.bold, letterSpacing: -0.2 },
  subtitle: { fontSize: 11.5, fontFamily: FONT_INTER.semibold, marginTop: 1 },
  countBubble: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: COLOR_GRAY_46,
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 11.5, fontFamily: FONT_INTER.extrabold, color: COLOR_GRAY_208 },
});
