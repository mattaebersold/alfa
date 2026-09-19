import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import RowEndSpacer from '../ui/RowEndSpacer';
import { priceLabel } from './listingFormat';
import { useGetListingsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { Listing, ListingKind } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

/** As many as fit before "View all" is the better answer — as PostStrip has it. */
export const LISTING_STRIP_PREVIEW_COUNT = 6;

const CARD_GAP = 12;
const ROW_PAD_LEFT = 12;
/** Narrow enough that the next one peeks out and says the row scrolls. */
const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.42, 190);

function ListingTile({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(listing.gallery);
  const price = priceLabel(listing);

  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={[listing.title, price].filter(Boolean).join(', ')}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.thumb}
          contentFit="cover"
        />
        {/* Sold is the state the picture can't show — and on a profile it's
            most of the shelf, so it has to read at a glance. */}
        {listing.sold && (
          <View style={styles.soldScrim}>
            <View style={styles.soldPill}><Text style={styles.soldText}>SOLD</Text></View>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
          {listing.title || 'Listing'}
        </Text>
        {!!price && (
          <Text style={[styles.price, { color: colors.primaryAlt }]} numberOfLines={1}>{price}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * What a member has on the marketplace, as a shelf on their profile.
 *
 * The same shape the Posts and Routes shelves take, for the same reason: a
 * count on a tile says far less than six of the things themselves. Renders
 * nothing at all when there are none — an empty shelf reads as something
 * failing to load rather than as an answer.
 *
 * Three of these make the profile's marketplace section: what they're selling,
 * what they're looking for, and what they've sold. Sold is public by decision —
 * a seller's history is the closest thing a marketplace has to a reputation.
 *
 * It fetches its own page, so a host only has to say whose and which. The pane
 * behind "View all" asks for a longer page off the same endpoint, which RTK
 * caches separately — the shelf isn't refetched when the pane opens.
 */
export default function MemberListingsShelf({
  userId,
  title,
  kind,
  sold,
  onViewAll,
  onListingPress,
}: {
  userId: string;
  title: string;
  /** Omit for both halves of the market; 'sale' or 'want' to pick one. */
  kind?: ListingKind;
  /** True asks for sold items only; the browse excludes them otherwise. */
  sold?: boolean;
  onViewAll: () => void;
  onListingPress: (listing: Listing) => void;
}) {
  const colors = useColors();

  const { data } = useGetListingsQuery(
    {
      user_id: userId,
      kind,
      ...(sold ? { sold: 'true' as const } : {}),
      // Newest first: on a profile "what have they got" is a chronology, not a
      // match — nothing here is being matched against the viewer's garage.
      sort: 'recent',
      limit: LISTING_STRIP_PREVIEW_COUNT,
    },
    { skip: !userId },
  );

  const listings = data?.entries ?? [];
  if (listings.length === 0) return null;

  const total = data?.total ?? listings.length;
  const hasMore = total > listings.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.heading, { color: colors.fg }]}>{title}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total} ${title.toLowerCase()}`}
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
        {listings.map((listing) => (
          <View key={listing.internal_id} style={styles.item}>
            <ListingTile listing={listing} onPress={() => onListingPress(listing)} />
          </View>
        ))}
        <RowEndSpacer width={ROW_PAD_LEFT} />
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
  heading:     { fontSize: 17, fontWeight: '800' },
  viewAll:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  item: { width: CARD_WIDTH },

  tile: {
    borderRadius: COMMON_RADIUS, borderWidth: 1, overflow: 'hidden',
  },
  thumbWrap: { width: '100%', aspectRatio: 1 },
  thumb:     { width: '100%', height: '100%', backgroundColor: '#161616' },
  soldScrim: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  soldPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS,
  },
  soldText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  info:  { padding: 10, gap: 3 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  price: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
});
