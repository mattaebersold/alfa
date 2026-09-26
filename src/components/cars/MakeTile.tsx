import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { COMMON_RADIUS } from '../../constants/radius';

/** The photo panel's height. */
const PHOTO_H = 108;
/** How far each slice leans — the same as the site's tiles. */
const SKEW_DEG = 11;
/** How far, in points, each slice's top edge sits right of its bottom. */
const LEAN = PHOTO_H * Math.tan((SKEW_DEG * Math.PI) / 180);
/** The dark seam between slices. */
const SEAM = 4;
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
      style={[styles.card, fitName && styles.cardFit, { borderColor: colors.border }, style]}
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
          // Each slice is a skewed, clipping, rounded band; its photo is
          // skewed back inside it so the car stays upright. The outer two run
          // past the panel's edges, which the panel's own rounded clip trims.
          shots.map((uri, i) => {
            const n = shots.length;
            const left = i === 0 ? -LEAN : (i * width) / n + SEAM / 2;
            const right = i === n - 1 ? width + LEAN : ((i + 1) * width) / n - SEAM / 2;
            const w = right - left;
            return (
              <View key={uri} style={[styles.slice, { left, width: w, transform: [{ skewX: SKEW }] }]}>
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
    borderRadius: COMMON_RADIUS, borderWidth: 1,
    backgroundColor: '#111111',
    padding: 8, gap: 10,
  },
  // Sized by the name, but never narrower than a photo panel worth looking at.
  cardFit: { minWidth: 168 },
  photos: { height: PHOTO_H, width: '100%', borderRadius: 8, overflow: 'hidden' },
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#1A1A1A' },
  slice: { position: 'absolute', top: 0, height: PHOTO_H, overflow: 'hidden', borderRadius: 8 },
  sliceImage: { position: 'absolute', top: 0, height: PHOTO_H, backgroundColor: '#1A1A1A' },
  blank: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 14, right: 14, zIndex: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 4, paddingBottom: 4 },
  // In a row stretched to its tallest tile, the name centers in what's left.
  nameRowFill: { flex: 1 },
  nameText: { flexShrink: 1, alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '800', textAlign: 'center', letterSpacing: -0.2 },
  subtitle: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  countBubble: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: '#2E2E2E',
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 11.5, fontWeight: '800', color: '#D0D0D0' },
});
