import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { Check, Truck } from 'lucide-react-native';
import SolidMapPin from '../ui/SolidMapPin';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import {
  COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_DANGER, COLOR_GRAY_22, COLOR_WHITE, GUTTER, COLOR_PRO, COLOR_GRAY_40,
} from '../../constants/config';
import OilSheen from '../ui/OilSheen';
import {
  conditionLabel, distanceLabel, matchLabel,
  previousPriceLabel, priceLabel, shippingLabel,
} from './listingFormat';
import type { Listing } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

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
export default function ListingCard({ listing, onPress, conditions, natural }: {
  listing: Listing;
  /** The rect the summary panel grows out of — see SummaryTouchable. */
  onPress: (origin: SummaryOrigin | null) => void;
  /** Condition labels from /meta, when the screen has them. */
  conditions?: string[];
  /**
   * The photo at its own shape, for a column of cards (the marketplace's
   * mosaic) rather than a row of them. Off, it's cropped to 16:9 so a grid's
   * rows line up.
   */
  natural?: boolean;
}) {
  const colors = useColors();
  // Width over height, once the photo has said; a landscape guess until then.
  const [ratio, setRatio] = useState(NATURAL_GUESS);

  const hero = firstGalleryUrl(listing.gallery);
  const price = priceLabel(listing);
  const wasPrice = previousPriceLabel(listing);
  const condition = conditionLabel(listing.condition, conditions);
  const distance = distanceLabel(listing.distance_miles);
  // "Ships" or "Ships or pickup" — either way it can come to you.
  const ships = listing.shipping === 'ship' || listing.shipping === 'both';
  // Just the car it fits — the checkmark already says "matches your garage".
  // (The summary panel keeps the full sentence; see matchLabel.)
  const match = matchLabel(listing)
    ? ([listing.make, listing.model].filter(Boolean).join(' ') || 'Your garage')
    : null;

  return (
    <SummaryTouchable
      // One ground for the whole card — the words' panel colour, so it shows
      // the same around the picture's rounded corners as under it.
      style={[styles.card, natural && styles.cardNatural, { backgroundColor: COLOR_GRAY_40, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={[listing.title, price, condition, distance, ships ? shippingLabel(listing.shipping) : null].filter(Boolean).join(', ')}
    >
      <View style={[styles.thumbWrap, natural && { aspectRatio: ratio }]}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
          onLoad={natural ? (e) => {
            const { width, height } = e.source;
            if (width > 0 && height > 0) setRatio(clampRatio(width / height));
          } : undefined}
        />
        {/* A car of yours it fits, on the photo's top left — the first thing
            to catch the eye. */}
        {match ? (
          // Gold with the oil-slick film, whatever the account — a match is
          // the marketplace's highlight, not the member's brand colour.
          <View style={[styles.matchPill, styles.matchOnPhoto, { backgroundColor: COLOR_PRO }]}>
            <OilSheen tone="warm" radius={PILL_RADIUS} scale={2.5} />
            <Check size={10} color={COLOR_BLACK} strokeWidth={3} />
            <Text style={styles.matchText} numberOfLines={1}>{match}</Text>
          </View>
        ) : null}
        {/* The price, on the photo's bottom left — light green, like the price on a
            feed card, with a cut shown struck through after it. Under the
            sold scrim, which covers it once there's nothing left to pay. */}
        {price ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText} numberOfLines={1}>{price}</Text>
            {wasPrice ? <Text style={styles.priceBadgeWas} numberOfLines={1}>{wasPrice}</Text> : null}
          </View>
        ) : null}
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

        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={1}>
          {listing.title || 'Untitled listing'}
        </Text>

        <View style={styles.meta}>
          {/* Only when the browse was measured from somewhere — an absent
              distance means we don't know where you are, not "nearby". */}
          {distance ? (
            // Plain, not a badge: no ground or padding, so the pin sits on
            // the same left edge as the title above it.
            <View style={[styles.tagIcon, styles.distance]}>
              <SolidMapPin size={11} color={colors.grey} />
              <Text style={[styles.tagText, { color: colors.grey }]}>{distance}</Text>
            </View>
          ) : null}
          {/* Willing to ship: just the truck, after the distance — the
              distance says where it is, this says it needn't matter. */}
          {ships ? <Truck size={12} color={colors.grey} strokeWidth={2.2} /> : null}
        </View>
      </View>
    </SummaryTouchable>
  );
}

// COLOR_GREEN (#85C27D) with more saturation, for the price on the photo.
const PRICE_GREEN = '#76CD6A';

/** A natural-shape card's photo before it loads: landscape, the usual case. */
const NATURAL_GUESS = 4 / 3;
/**
 * Natural, within reason: a panorama or a tall screenshot would make a sliver
 * or a tower of one card, so the shape is held between 9:16-ish and 2:1.
 */
const clampRatio = (r: number) => Math.min(2, Math.max(0.6, r));

/**
 * The grid the card is made for: two across, one gap.
 *
 * On the FlatList's `columnWrapperStyle`, so every host that shows listings
 * lays them out the same way and a lone last item still sits at half width
 * rather than stretching across the row.
 */
export const LISTING_GRID_ROW = { gap: 10, paddingHorizontal: GUTTER, marginBottom: 10 } as const;

/** A card's corners, and its picture's — a touch tighter than the app's radius at this size. */
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  // No padding: the photo runs to the card's edges, and the words below
  // bring their own. Clipped, so the photo takes the card's top corners.
  card: {
    flex: 1,
    borderRadius: CARD_RADIUS, borderWidth: 1,
    overflow: 'hidden',
  },  // In a column: sized by its photo, not stretched to fill the column.
  cardNatural: { flex: 0 },

  // Rounded at the foot too, where it meets the words — the card's radius, so
  // the photo reads as a tile set into the card.
  thumbWrap: { width: '100%', aspectRatio: 16 / 9, borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden' },
  thumb:     { width: '100%', height: '100%', backgroundColor: COLOR_GRAY_22 },
  soldScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  soldPill: { backgroundColor: COLOR_DANGER, paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS },
  soldText: { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6 },

  // A step lighter than the card, so the words read as their own panel under the photo.
  info: { flexGrow: 1, minWidth: 0, gap: 1, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10, backgroundColor: COLOR_GRAY_40 },
  // On the photo, top left, lifted off it like the price.
  matchOnPhoto: {
    position: 'absolute', left: 4, top: 4, maxWidth: '90%',
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  // Clipped, so the sheen stays inside the pill's round ends.
  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
    overflow: 'hidden',
  },
  // Black on the gold, as every other filled pill in the app.
  matchText: { fontSize: 9, fontFamily: FONT_INTER.semibold, color: COLOR_BLACK, flexShrink: 1 },

  // One line, always — every tile the same height beside its neighbour.
  title: { fontSize: 11.5, fontFamily: FONT_INTER.bold, lineHeight: 16 },

  // On the photo, bottom left.
  priceBadge: {
    position: 'absolute', left: 4, bottom: 4, maxWidth: '90%',
    flexDirection: 'row', alignItems: 'baseline', gap: 5,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: PILL_RADIUS,
    // The app's lighter green, pushed a little more saturated so it holds
    // up over a photo; black on it, as the brand-filled pills are.
    backgroundColor: PRICE_GREEN,
    // Lifted off the photo, so it reads over a bright one.
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  priceBadgeText: { color: COLOR_BLACK, fontSize: 10, fontFamily: FONT_INTER.semibold, letterSpacing: 0.3 },
  priceBadgeWas: {
    color: 'rgba(0,0,0,0.6)', fontSize: 8.5, fontFamily: FONT_INTER.semibold,
    textDecorationLine: 'line-through',
  },

  meta:    { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tagIcon: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  distance: { paddingHorizontal: 0, paddingVertical: 0 },
  tagText: { fontSize: 10.5, fontFamily: FONT_INTER.medium },
});
