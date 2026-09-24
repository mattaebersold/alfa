import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Images } from 'lucide-react-native';
import type { PhotoSpot } from '@ors/kit';
import { spotTypeLabel, spotTypeColor } from '@ors/kit/src/photography/constants';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { COMMON_RADIUS } from '../../constants/radius';

/** As many as fit before "View all" is the better answer — same as PostStrip. */
export const PHOTO_SPOT_SHELF_COUNT = 6;
const CARD_WIDTH = 168;
const CARD_GAP = 10;
const ROW_PAD_LEFT = 16;
const MEDIA_RATIO = 4 / 3;
/** The profile shelves' card shade — see PostStrip and ListShelf. */
const CARD_BG = '#171717';

/**
 * The photography pins a member has dropped, as a shelf on their profile.
 *
 * The same shape as the Posts and Lists shelves beside it: a handful of cards
 * sideways, the rest behind "View all". Each card is the spot's first photo,
 * worn with its type the way the map colours its pin, and its name.
 *
 * Purely presentational, like PostStrip — the profile owns the fetch and what
 * a tap does. Renders nothing when there are none.
 */
export default function PhotoSpotShelf({ spots, total, onSpotPress, onViewAll }: {
  spots: PhotoSpot[];
  /** How many there are in all — "View all" only when there are more than shown. */
  total: number;
  onSpotPress: (spot: PhotoSpot) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();
  if (spots.length === 0) return null;
  const shown = spots.slice(0, PHOTO_SPOT_SHELF_COUNT);
  const hasMore = total > shown.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>Photo spots</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total} photo spots`}
          >
            <Text style={[styles.viewAllText, { color: colors.primaryAlt }]}>View all</Text>
            <ChevronRight size={14} color={colors.primaryAlt} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
      >
        {shown.map((spot) => {
          const cover = imageUrl(spot.gallery?.[0]?.filename);
          const type = spotTypeLabel(spot.type);
          const photos = spot.gallery?.length ?? 0;
          return (
            <TouchableOpacity
              key={spot.internal_id}
              style={[styles.card, { borderColor: colors.borderDark }]}
              onPress={() => onSpotPress(spot)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={spot.title || spot.location || 'Photo spot'}
            >
              <View>
                <Image
                  source={cover ? { uri: cover } : require('../../../assets/car-placeholder.jpg')}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                />
                {/* The pin's own colour, so the card and the map agree. */}
                {type ? (
                  <View style={[styles.typeBadge, { backgroundColor: spotTypeColor(spot.type) }]}>
                    <Text style={styles.typeText} numberOfLines={1}>{type}</Text>
                  </View>
                ) : null}
                {photos > 0 ? (
                  <View style={styles.photoBadge}>
                    <Images size={10} color="#FFFFFF" />
                    <Text style={styles.photoText}>{photos}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.body}>
                <Text style={[styles.name, { color: colors.fg }]} numberOfLines={2}>
                  {spot.title || spot.location || 'Photo spot'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title:       { fontSize: 17, fontWeight: '800' },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: {
    width: CARD_WIDTH, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, backgroundColor: CARD_BG,
  },
  image: { width: '100%', aspectRatio: MEDIA_RATIO, backgroundColor: '#111111' },
  typeBadge: {
    position: 'absolute', left: 8, bottom: 8, maxWidth: CARD_WIDTH - 60,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  typeText:  { fontSize: 11, fontWeight: '800', color: '#000000' },
  photoBadge: {
    position: 'absolute', right: 8, bottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  photoText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  body: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
});
