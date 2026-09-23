import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Sparkles, Truck } from 'lucide-react-native';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { firstGalleryUrl } from '../../utils/image';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import {
  categoryLabel, conditionLabel, distanceLabel, matchLabel,
  previousPriceLabel, priceLabel, shippingLabel,
} from './listingFormat';
import type { Listing } from '../../types/api';

/**
 * One thing for sale, or one thing wanted.
 *
 * A tile for a two-up grid: the photo across the top, the copy beneath it.
 * It was a row, on the theory that the numbers — price, condition, how far
 * away — needed the width; in practice the photo is what you scan a market
 * by, and a grid puts twice as many on screen. The copy keeps its budget by
 * stacking: two lines of title, the price on its own line, then the tags
 * wrapping. The host lays the grid out (`numColumns={2}` with a gap in the
 * row style); the card only fills the cell it's given.
 *
 * The match pill is the card's reason for existing where it is. The default
 * browse floats listings that fit a car in your garage, and a list reordered
 * without saying why reads as a list in a random order — so a card that was
 * lifted says what lifted it.
 */
export default function ListingCard({ listing, onPress, conditions }: {
  listing: Listing;
  /** The rect the summary panel grows out of — see SummaryTouchable. */
  onPress: (origin: SummaryOrigin | null) => void;
  /** Condition labels from /meta, when the screen has them. */
  conditions?: string[];
}) {
  const colors = useColors();
  const brand = useBrandColor();

  const hero = firstGalleryUrl(listing.gallery);
  const price = priceLabel(listing);
  const wasPrice = previousPriceLabel(listing);
  const condition = conditionLabel(listing.condition, conditions);
  const distance = distanceLabel(listing.distance_miles);
  const match = matchLabel(listing);
  const shipping = shippingLabel(listing.shipping);
  const category = categoryLabel(listing.category);

  return (
    <SummaryTouchable
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={[listing.title, price, condition, distance].filter(Boolean).join(', ')}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
        {/* Over the photo, not beside the title: sold is a fact about the whole
            listing, and a row of pills is where it would be missed. */}
        {listing.sold ? (
          <View style={styles.soldScrim}>
            <View style={styles.soldPill}>
              <Text style={styles.soldText}>SOLD</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        {match ? (
          <View style={[styles.matchPill, { backgroundColor: brand }]}>
            <Sparkles size={10} color="#000000" strokeWidth={2.6} />
            <Text style={styles.matchText} numberOfLines={1}>{match}</Text>
          </View>
        ) : null}

        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
          {listing.title || 'Untitled listing'}
        </Text>

        {price ? (
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.fg }]} numberOfLines={1}>{price}</Text>
            {/* A price cut is the reason to look again — only ever shown beside
                the number that replaced it. */}
            {wasPrice ? (
              <Text style={[styles.wasPrice, { color: colors.grey }]}>{wasPrice}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.meta}>
          {category ? (
            <View style={[styles.tag, { backgroundColor: colors.segment }]}>
              <Text style={[styles.tagText, { color: colors.grey }]}>{category}</Text>
            </View>
          ) : null}
          {condition ? (
            <View style={[styles.tag, { backgroundColor: colors.segment }]}>
              <Text style={[styles.tagText, { color: colors.grey }]}>{condition}</Text>
            </View>
          ) : null}
          {shipping ? (
            <View style={[styles.tag, styles.tagIcon, { backgroundColor: colors.segment }]}>
              <Truck size={10} color={colors.grey} />
              <Text style={[styles.tagText, { color: colors.grey }]}>{shipping}</Text>
            </View>
          ) : null}
          {/* Only when the browse was measured from somewhere — an absent
              distance means we don't know where you are, not "nearby". */}
          {distance ? (
            <View style={[styles.tag, styles.tagIcon, { backgroundColor: colors.segment }]}>
              <MapPin size={10} color={colors.grey} />
              <Text style={[styles.tagText, { color: colors.grey }]}>{distance}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </SummaryTouchable>
  );
}

/**
 * The grid the card is made for: two across, one gap.
 *
 * On the FlatList's `columnWrapperStyle`, so every host that shows listings
 * lays them out the same way and a lone last item still sits at half width
 * rather than stretching across the row.
 */
export const LISTING_GRID_ROW = { gap: 10, paddingHorizontal: 12, marginBottom: 10 } as const;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 8,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  thumbWrap: { width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  thumb:     { width: '100%', height: '100%', backgroundColor: '#161616' },
  soldScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  soldPill: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS },
  soldText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  info: { minWidth: 0, gap: 4, paddingTop: 8, paddingHorizontal: 2 },
  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  // Black on the brand fill, as every other filled pill in the app.
  matchText: { fontSize: 10, fontWeight: '800', color: '#000000', flexShrink: 1 },

  // Two lines' worth of room always, so a one-line title doesn't leave its
  // tile shorter than the one beside it.
  title: { fontSize: 13.5, fontWeight: '700', lineHeight: 18, minHeight: 36 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  price:    { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  wasPrice: { fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' },

  meta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
  tag:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: PILL_RADIUS },
  tagIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tagText: { fontSize: 10.5, fontWeight: '700' },
});
