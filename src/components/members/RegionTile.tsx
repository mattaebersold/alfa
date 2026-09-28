import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import RegionBadge from '../ui/RegionBadge';
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_23, COLOR_GRAY_29, COLOR_WHITE } from '../../constants/config';

/** Both tiles' height: a band under the bio, not a panel. */
const TILE_HEIGHT = 92;
const TILE_GAP = 8;
const PAGE_INSET = 12;
/**
 * The country map's width inside its quarter-width tile. Worked out from the
 * window rather than measured, so it's drawn at size on the first frame.
 */
const US_MAP_SIZE = ((Dimensions.get('window').width - PAGE_INSET * 2 - TILE_GAP) * 0.25) - 20;

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
  region,
  regionColor,
  onPress,
}: {
  /** The stored map render. Without one there's nothing to show. */
  filename?: string | null;
  cityState?: string | null;
  /**
   * The member's region key. Given one, a second tile beside the map shows the
   * whole country with that region lit — the map is the neighbourhood, this is
   * where the neighbourhood is.
   */
  region?: string | null;
  /** The lit region's colour — the member's own, gold or blue. */
  regionColor?: string;
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
    <View style={styles.row}>
    <View style={[styles.wrap, region ? styles.wrapBeside : styles.wrapFull]}>
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
            <MapPin size={13} color={COLOR_WHITE} />
            <Text style={styles.labelText} numberOfLines={1}>{cityState}</Text>
            {/* Only where there's somewhere to go — otherwise the chevron is a
                promise the tile can't keep. */}
            {onPress ? <ChevronRight size={15} color="rgba(255,255,255,0.75)" /> : null}
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
      {region ? (
        <View style={[styles.wrap, styles.usTile]}>
          <RegionBadge
            region={region}
            size={US_MAP_SIZE}
            color={regionColor}
            backdrop={false}
            // A soft coastline, as in the member rows: the lit region is the point.
            outline="rgba(255,255,255,0.14)"
          />
        </View>
      ) : null}
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
  plainText: { fontSize: 13, fontFamily: FONT_INTER.semibold, flexShrink: 1 },

  // Everything positional: the inset from the page, the corners, and the clip
  // that keeps the map inside them.
  // The page inset and the spacing live on the row; each tile only rounds and
  // clips itself.
  row: {
    flexDirection: 'row', gap: TILE_GAP,
    marginTop: 4, marginBottom: 18, marginHorizontal: PAGE_INSET,
  },
  wrap: { borderRadius: 14, overflow: 'hidden', height: TILE_HEIGHT },
  wrapFull:   { flex: 1 },
  wrapBeside: { flex: 3 },
  usTile: {
    flex: 1,
    // The profile's tile shade — the white outline and lit region carry it.
    backgroundColor: COLOR_GRAY_23,
    alignItems: 'center', justifyContent: 'center',
  },
  tile: {
    flex: 1,
    backgroundColor: COLOR_GRAY_29,
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
    fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE, flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
});
