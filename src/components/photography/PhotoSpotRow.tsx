import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Camera, MapPin, Images } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { spotTypeLabel, spotTypeColor } from '../../constants/photoSpots';
import type { PhotoSpot } from '../../types/api';

/** The thumbnail's edge, and so the row's height. */
const THUMB = 64;

/**
 * One photo spot, in a list of them.
 *
 * The map is still the feature; this is the same pins as rows, for when you
 * want to read what's out there rather than pan for it. Each row says what a
 * pin on the map can't fit: the place's name, what kind of place it is, who
 * pinned it and how many photos have been taken there. Tapping one opens the
 * same summary a pin tap does — it's a different way in, not a different
 * destination.
 */
export default function PhotoSpotRow({ spot, onPress }: {
  spot: PhotoSpot;
  onPress: (spot: PhotoSpot) => void;
}) {
  const colors = useColors();
  const cover = imageUrl(spot.gallery?.[0]?.filename);
  const typeLabel = spotTypeLabel(spot.type);
  const typeColor = spotTypeColor(spot.type);
  const photos = spot.gallery?.length ?? 0;
  const by = spot.user?.username;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onPress(spot)}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${spot.title || 'Photo spot'}${by ? `, pinned by ${by}` : ''}`}
    >
      {/* The first photo taken there, or a placeholder in the type's colour
          so a row without photos still reads as that kind of place. */}
      <View style={[styles.thumb, { backgroundColor: colors.segment }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Camera size={20} color={typeColor} />
        )}
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
          {spot.title || 'Photo spot'}
        </Text>

        {/* What it is, and where — the two things you'd scan a list for. */}
        <View style={styles.meta}>
          {typeLabel && (
            <View style={styles.type}>
              <View style={[styles.dot, { backgroundColor: typeColor }]} />
              <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>{typeLabel}</Text>
            </View>
          )}
          {spot.location ? (
            <View style={styles.place}>
              <MapPin size={11} color={colors.grey} />
              <Text style={[styles.metaText, { color: colors.grey }]} numberOfLines={1}>{spot.location}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.byline}>
          <Avatar
            size={18}
            filename={spot.user?.profile?.[0] ?? spot.user?.gallery?.[0]?.filename}
            name={by}
          />
          <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>
            {by ? `Pinned by ${by}` : 'Pinned'}
          </Text>
          {photos > 0 && (
            <View style={styles.count}>
              <Images size={11} color={colors.grey} />
              <Text style={[styles.countText, { color: colors.grey }]}>{photos}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  copy:  { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 19 },

  meta:     { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  type:     { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 0 },
  dot:      { width: 7, height: 7, borderRadius: 3.5 },
  place:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 },
  metaText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  byline:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  bylineText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  count:      { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 'auto', paddingLeft: 8 },
  countText:  { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
