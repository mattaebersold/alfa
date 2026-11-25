import React, { useCallback, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, ActivityIndicator, Alert, Linking, TouchableOpacity,
  type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { formatDistanceToNowStrict } from 'date-fns';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import EmptyState from '../ui/EmptyState';
import { SkeletonGrid } from '../ui/Skeleton';
import SolidMapPin from '../ui/SolidMapPin';
import { useColors } from '../../hooks/useColors';
import { useIsAdmin } from '../../theme/useColors';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { useGetMarketplaceFindsInfiniteQuery, useDeleteMarketplaceFindMutation } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { LISTING_GRID_ROW } from './ListingCard';
import {
  COLOR_BLACK, COLOR_GRAY_40, GUTTER, PILL_RADIUS, SURFACE_DARK, SURFACE_MID,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import type { MarketplaceFind } from '../../types/finds';

/**
 * PRO › Finds — Facebook Marketplace listings shared in from a phone or a
 * script (see horacio's controllers/marketplaceFindController).
 *
 * Not ORS listings: there's no summary panel or message thread to open. A
 * card goes straight to the listing on Facebook — the Facebook app, when it's
 * installed — and says who sent it and when, since a find is only as fresh
 * as its share. What we read is a snapshot; the listing may have sold since.
 *
 * Admins take one down with a long press.
 */
export default function FindsFeed({ header, onScroll, contentContainerStyle, refreshOffset }: {
  /** Above the cards, scrolling away with them — who presents them. */
  header?: React.ReactNode;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Where the pull-to-refresh spinner sits, under a floating header. */
  refreshOffset?: number;
}) {
  const colors = useColors();
  const isAdmin = useIsAdmin();
  const list = useGetMarketplaceFindsInfiniteQuery(undefined, { refetchOnMountOrArgChange: 60 });
  const [deleteFind] = useDeleteMarketplaceFindMutation();
  const refreshControl = useRefreshControl(() => list.refetch(), refreshOffset);

  const finds = useMemo(() => {
    const seen = new Set<string>();
    const out: MarketplaceFind[] = [];
    for (const page of list.data?.pages ?? []) {
      for (const f of page.entries ?? []) {
        if (seen.has(f.internal_id)) continue;
        seen.add(f.internal_id);
        out.push(f);
      }
    }
    return out;
  }, [list.data]);

  const open = useCallback((f: MarketplaceFind) => {
    Linking.openURL(f.url).catch(() => Alert.alert('Couldn’t open that listing'));
  }, []);

  const confirmDelete = useCallback((f: MarketplaceFind) => {
    Alert.alert('Remove this find?', f.title ?? f.url, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => { deleteFind(f.internal_id).unwrap().catch(() => Alert.alert('Couldn’t remove it')); },
      },
    ]);
  }, [deleteFind]);

  const loadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
  }, [list]);

  return (
    <FlatList
      style={[styles.fill, { backgroundColor: SURFACE_DARK }]}
      data={finds}
      keyExtractor={(f) => f.internal_id}
      numColumns={2}
      columnWrapperStyle={LISTING_GRID_ROW}
      renderItem={({ item }) => (
        <FindCard
          find={item}
          onPress={() => open(item)}
          onLongPress={isAdmin ? () => confirmDelete(item) : undefined}
        />
      )}
      onScroll={onScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={header ? <>{header}</> : null}
      ListEmptyComponent={
        list.isLoading
          ? <SkeletonGrid count={6} ratio={1} style={{ paddingHorizontal: GUTTER, paddingTop: 8 }} />
          : <EmptyState title="Nothing here yet" />
      }
      ListFooterComponent={
        list.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.grey} style={{ padding: 20 }} /> : null
      }
      refreshControl={refreshControl}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
    />
  );
}

/** "$3,369"; "Free"; Facebook's own text when it isn't a number. */
const priceLabel = (f: MarketplaceFind) => {
  if (f.price === 0) return 'Free';
  if (f.price != null) return `$${f.price.toLocaleString('en-US')}`;
  return f.price_text;
};

function FindCard({ find, onPress, onLongPress }: {
  find: MarketplaceFind;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  // Half the screen wide.
  const photo = imageUrl(find.image, 'small');
  const price = priceLabel(find);
  const when = formatDistanceToNowStrict(new Date(find.shared_at), { addSuffix: true });
  const byline = [find.shared_by, when].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={[find.title ?? 'Facebook listing', price, find.location, `shared by ${byline}`].filter(Boolean).join(', ')}
    >
      <View style={styles.thumbWrap}>
        <Image
          source={photo ? { uri: photo } : require('../../../assets/car-placeholder.jpg')}
          style={styles.thumb}
          contentFit="cover"
          transition={150}
        />
        {price ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText} numberOfLines={1}>{price}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>
          {find.title || 'Facebook Marketplace listing'}
        </Text>
        {find.location ? (
          <View style={styles.row}>
            <SolidMapPin size={11} color={colors.grey} />
            <Text style={[styles.meta, { color: colors.grey }]} numberOfLines={1}>{find.location}</Text>
          </View>
        ) : null}
        {find.note ? (
          <Text style={[styles.note, { color: colors.fg }]} numberOfLines={2}>“{find.note}”</Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.grey }]} numberOfLines={1}>{byline}</Text>
      </View>
    </TouchableOpacity>
  );
}

// The listing card's price green, so a find's price reads like a listing's.
const PRICE_GREEN = '#76CD6A';
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  fill: { flex: 1 },

  card: { flex: 1, borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden', backgroundColor: COLOR_GRAY_40 },
  // Facebook's preview photo is a 600px square, so the tiles are too.
  thumbWrap: { width: '100%', aspectRatio: 1, borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%', backgroundColor: SURFACE_MID },
  priceBadge: {
    position: 'absolute', left: 4, bottom: 4, maxWidth: '90%',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: PILL_RADIUS,
    backgroundColor: PRICE_GREEN,
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  priceBadgeText: { color: COLOR_BLACK, fontSize: 10, fontFamily: FONT_INTER.semibold, letterSpacing: 0.3 },

  info: { flexGrow: 1, gap: 3, paddingTop: 8, paddingHorizontal: 10, paddingBottom: 10 },
  title: { fontSize: 11.5, fontFamily: FONT_INTER.bold, lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  meta: { fontSize: 10.5, fontFamily: FONT_INTER.medium, flexShrink: 1 },
  note: { fontSize: 10.5, fontFamily: FONT_INTER.medium, fontStyle: 'italic', lineHeight: 14 },
});
