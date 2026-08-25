import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';

/**
 * Where a member is, as a picture rather than as a string.
 *
 * "Victorville, CA" is a fact you either already know or don't; the map is the
 * same fact legible to everyone — the coast, the interstate, where the desert
 * starts. Deliberately zoomed out and unmarked: the region is public, the
 * address emphatically isn't.
 *
 * The image is rendered once server-side and cached in S3 (see horacio's
 * userRegionMap), so this is a plain image fetch, not a maps call.
 */
export default function RegionTile({
  filename,
  cityState,
  onPress,
}: {
  /** The stored map render. Without one there's nothing to show. */
  filename?: string | null;
  cityState?: string | null;
  /**
   * Opens the members list filtered to this region. Omitted where that would
   * lead nowhere — a member whose city never resolved belongs to no region.
   */
  onPress?: () => void;
}) {
  const colors = useColors();
  const uri = imageUrl(filename);

  // No map, but a place — most members are in exactly this state, since the
  // city and state come from a cheap geocode at signup while the tile is a
  // billed render that has to be backfilled separately. The location is the
  // fact worth showing; the map is the nicer way of showing it.
  if (!uri) {
    if (!cityState || cityState === 'USA') return null;
    return (
      <View style={[styles.plain, { borderColor: colors.borderDark, backgroundColor: colors.card }]}>
        <MapPin size={14} color={colors.grey} />
        <Text style={[styles.plainText, { color: colors.muted }]} numberOfLines={1}>{cityState}</Text>
      </View>
    );
  }

  return (
    // The margin and the rounding live on the container so the map itself stays
    // a plain rectangle — clipping is the wrapper's job, and an Image carrying
    // its own radius fights the parent's on Android.
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.tile}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.9}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Find members near ${cityState}` : undefined}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />

        {/* Only the strip the label sits on. Across the whole tile this was a
            second dimming on top of an already dark map, and the middle — the
            part actually worth looking at — took the worst of it. */}
        {/* <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.labelScrim}
          pointerEvents="none"
        /> */}

        {cityState ? (
          <View style={styles.label}>
            <MapPin size={13} color="#FFFFFF" />
            <Text style={styles.labelText} numberOfLines={1}>{cityState}</Text>
            {/* Only where there's somewhere to go — otherwise the chevron is a
                promise the tile can't keep. */}
            {onPress ? <ChevronRight size={15} color="rgba(255,255,255,0.75)" /> : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  plain: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    alignSelf: 'flex-start', marginTop: 12, marginHorizontal: 12,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  plainText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },

  // Everything positional: the inset from the page, the corners, and the clip
  // that keeps the map inside them.
  wrap: {
    marginTop: 4, marginBottom: 18, marginHorizontal: 12,
    borderRadius: 14, overflow: 'hidden',
  },
  tile: {
    aspectRatio: 2.4,
    backgroundColor: '#1D1D1D',
    justifyContent: 'flex-end',
  },
  // Just enough to carry the label. Any more and it dims the map twice, since
  // the map is already dark.
  labelScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' },
  label: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  labelText: {
    fontSize: 13, fontWeight: '800', color: '#FFFFFF', flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
});
