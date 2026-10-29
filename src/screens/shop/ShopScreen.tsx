import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Text } from '@ors/kit';
import { ShoppingCart } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/ui/AppHeader';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import ProductSummaryModal, { ProductGallery, priceRange, directBuyUrl, presentCheckout } from '../../components/shop/ProductSummaryModal';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { stripHtml } from '../../utils/text';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useGetProductsQuery, useGetShopCollectionsQuery } from '../../api/apiService';
import MainTabs from '../../components/ui/MainTabs';
import { ss } from '../../styles/shared';
import type { ShopProduct } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_WHITE, COLOR_PRO, COLOR_GRAY_46, COLOR_GRAY_102 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * The merch shop.
 *
 * Products are Shopify's — managed in the Shopify admin, read here through
 * horacio (services/shopify.js there). A tap opens the product in a summary
 * panel over this list (ProductSummaryModal), and buying happens in Shopify's
 * native checkout sheet from there, so the buyer never leaves. See
 * ProductDetailScreen for the App Store reasoning; it stays as the deep-link
 * destination.
 */

/** The buy button's circle, on a full card and on a half one. */
const BUY_SIZE = 44;
const BUY_SIZE_COMPACT = 38;

function ProductCard({ product, onPress, onBuy, compact }: {
  product: ShopProduct;
  /** Half width, two to a row: a square photo, the price under the name, no blurb. */
  compact?: boolean;
  onPress: (origin: SummaryOrigin | null) => void;
  /** Buy from the card. Null when there's a choice to make first — then the button opens the panel. */
  onBuy: ((origin: SummaryOrigin | null) => void);
}) {
  const colors = useColors();
  // The card's width, for the pages of its gallery.
  const [cardW, setCardW] = useState(0);
  // Shopify works this out across variants; the card shouldn't re-derive it.
  const soldOut = product.inStock === false;
  const blurb = (product.description || stripHtml(product.body ?? '')).trim();
  return (
    // Hands its rect to the panel it opens, so the panel grows out of the card.
    <SummaryTouchable
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityLabel={`${product.title}, ${priceRange(product)}`}
    >
      {/* Rounded at the foot too, so the picture sits in the card rather
          than capping it. */}
      <View style={styles.cardImgWrap} onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
        {/* No dots: the card takes the touch, so its photos can't be swiped here. */}
        <ProductGallery images={product.gallery ?? []} width={cardW} aspectRatio={compact ? 1 : 4 / 3} dots={false} />
      </View>
      {/* Sold out on the photo's corner. */}
      {soldOut && (
        <View style={styles.badge}><Text style={styles.badgeText}>Sold out</Text></View>
      )}
      <View style={[styles.cardBody, compact && styles.cardBodyCompact]}>
        <Text style={[styles.cardTitle, compact && styles.cardTitleCompact, { color: colors.fg }]} numberOfLines={2}>{product.title}</Text>
        {blurb && !compact ? (
          <Text style={[styles.cardBlurb, { color: colors.muted }]} numberOfLines={2}>{blurb}</Text>
        ) : null}
        {/* The price, plain, at the left of the card's foot, and the buy
            button at its right. */}
        <View style={[styles.footRow, compact && styles.footRowCompact]}>
        <View style={styles.pricePill}>
          <Text style={[styles.price, compact && styles.priceCompact, { color: colors.fg }]} numberOfLines={1}>
            {priceRange(product)}
          </Text>
        </View>
        {/* Straight to checkout when there's nothing to choose; otherwise the
            panel, where the options are. */}
        {soldOut ? (
          // Still there, in grey, so the row keeps its shape — and dead: it
          // takes the touch so a tap on it doesn't open the card instead.
          <View
            style={[styles.buyBtn, compact && styles.buyBtnCompact, styles.buyBtnOff]}
            onStartShouldSetResponder={() => true}
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            accessibilityLabel={`${product.title} is sold out`}
          >
            <ShoppingCart size={compact ? 17 : 19} color={COLOR_GRAY_102} strokeWidth={2.3} />
          </View>
        ) : (
          // A gold circle with a cart, at the card's right: the colour the
          // app spends on paying for things.
          <SummaryTouchable
            style={[styles.buyBtn, compact && styles.buyBtnCompact]}
            onPress={onBuy}
            activeOpacity={0.85}
            accessibilityLabel={`Buy ${product.title}`}
          >
            <ShoppingCart size={compact ? 17 : 19} color={COLOR_BLACK} strokeWidth={2.3} />
          </SummaryTouchable>
        )}
        </View>
      </View>
    </SummaryTouchable>
  );
}

export default function ShopScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();

  /**
   * The filter under the heading: "All", then the store's collections as
   * set up in the Shopify admin. A collection is asked of Shopify rather than
   * filtered here — it keeps the order the admin gave it.
   */
  const [collection, setCollection] = useState('all');
  const { data: collections, refetch: refetchCollections } = useGetShopCollectionsQuery();
  const options = useMemo(
    () => [{ key: 'all', label: 'All' }, ...(collections ?? []).map((c) => ({ key: c.handle, label: c.title }))],
    [collections],
  );

  const { data, currentData, isLoading, isFetching, isError, refetch } = useGetProductsQuery(
    collection === 'all' ? undefined : { collection },
  );
  // This filter's own answer, not the last one's: switching shows the
  // spinner rather than the previous collection's products under a new chip.
  const products = currentData?.entries ?? [];
  const switching = !currentData && isFetching;
  // Two across once there's more than one; a lone product keeps the full width.
  const columns = products.length > 1 ? 2 : 1;

  const onRefresh = useCallback(() => { refetch(); refetchCollections(); }, [refetch, refetchCollections]);

  /** The product open in the panel, and the card it grew out of. */
  const [open, setOpen] = useState<{ handle: string; origin: SummaryOrigin | null } | null>(null);
  const checkout = useShopifyCheckoutSheet();
  const buyFromCard = (p: ShopProduct, origin: SummaryOrigin | null) => {
    const url = directBuyUrl(p);
    if (url) presentCheckout(checkout, url);
    else setOpen({ handle: p.handle, origin });
  };

  if (isLoading && !data) {
    return (
      <SafeAreaView style={ss.fill} edges={[]}>
        <AppHeader spacer />
        <View style={styles.content}><Spinner fullScreen /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader spacer />
      <View style={styles.content}>
        <FlatList
          ref={scrollRef}
          // numColumns can't change on a mounted list; a new key remounts it.
          key={`cols-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
          data={products}
          keyExtractor={(p) => p.handle}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !switching && !isLoading} onRefresh={onRefresh} tintColor={colors.primaryAlt} />}
          ListHeaderComponent={
            <View>
              <View style={styles.intro}>
                <Text style={[styles.introTitle, { color: colors.fg }]}>Shop</Text>
              </View>
              {options.length > 1 && (
                // The app's main tabs, run to the screen edges — the list pads
                // 12, so the first tab starts in line with the cards.
                <View style={styles.filter}>
                  <MainTabs tabs={options} value={collection} onChange={setCollection} inset={12} />
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              compact={columns > 1}
              product={item}
              onPress={(origin) => setOpen({ handle: item.handle, origin })}
              onBuy={(origin) => buyFromCard(item, origin)}
            />
          )}
          ListEmptyComponent={switching ? (
            <View style={styles.emptyWrap}><Spinner /></View>
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={isError ? "Couldn't load the shop" : 'No products available'}
                message={isError ? 'Check your connection and pull to refresh.' : undefined}
              />
            </View>
          )}
        />
      </View>

      <ProductSummaryModal
        handle={open?.handle ?? null}
        origin={open?.origin}
        onClose={() => setOpen(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:   { flex: 1 },
  list:      { paddingHorizontal: 12, paddingBottom: 32 },
  intro:     {
    // The list already pads 12; 4 more lands the heading on the 16 the rest
    // of the app uses without pushing the cards in with it.
    paddingHorizontal: 4, paddingTop: 14, paddingBottom: 10, gap: 2,
  },
  introTitle:{ fontSize: 22, fontFamily: FONT_INTER.bold },
  card:      {
    // Full width when it's the only one; two to a row otherwise (cardCompact).
    width: '100%', marginBottom: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  badge:     {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  badgeText: { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.bold },
  // Capped so an odd one out on the last row stays a half, not a whole.
  cardCompact: { width: undefined, flex: 1, maxWidth: '48.5%' },
  gridRow:   { gap: 10 },
  filter:    { marginHorizontal: -12, paddingBottom: 10 },
  cardBody:  { padding: 14, gap: 8 },
  // Fills the card, so the buy buttons line up along a row.
  cardBodyCompact: { flex: 1, padding: 10, gap: 6 },
  cardTitleCompact: { fontSize: 14, lineHeight: 18 },
  cardTitle: { fontSize: 17, fontFamily: FONT_INTER.bold, lineHeight: 22 },
  cardBlurb: { fontSize: 13, lineHeight: 18 },
  cardImgWrap: { borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  // The price and the buy button, at the foot; on a half card, pinned there
  // so the rows line up across the grid.
  footRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  footRowCompact: { marginTop: 'auto' },
  // Sunk into the card: a half-black pill, the price in white on it.
  pricePill: {
    flexShrink: 1, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: PILL_RADIUS, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  price:     { fontSize: 15, fontFamily: FONT_INTER.bold },
  priceCompact: { fontSize: 13 },
  buyBtn:    {
    width: BUY_SIZE, height: BUY_SIZE, borderRadius: BUY_SIZE / 2,
    backgroundColor: COLOR_PRO, alignItems: 'center', justifyContent: 'center',
  },
  // At the card's foot, so the buttons line up along a row.
  buyBtnOff: { backgroundColor: COLOR_GRAY_46 },
  buyBtnCompact: { width: BUY_SIZE_COMPACT, height: BUY_SIZE_COMPACT, borderRadius: BUY_SIZE_COMPACT / 2 },
  emptyWrap: { paddingTop: 40 },
});
