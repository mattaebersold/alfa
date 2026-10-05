import React, { useCallback, useRef, useState } from 'react';
import {
  View, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Text } from '@ors/kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '../../components/ui/AppHeader';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import ProductSummaryModal, { PricePill, ProductGallery, priceRange, directBuyUrl, presentCheckout } from '../../components/shop/ProductSummaryModal';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { stripHtml } from '../../utils/text';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useGetProductsQuery } from '../../api/apiService';
import { ss } from '../../styles/shared';
import type { ShopProduct } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_WHITE, COLOR_PRO } from '../../constants/config';
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

function ProductCard({ product, onPress, onBuy }: {
  product: ShopProduct;
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
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityLabel={`${product.title}, ${priceRange(product)}`}
    >
      {/* Rounded at the foot too, so the picture sits in the card rather
          than capping it. */}
      <View style={styles.cardImgWrap} onLayout={(e) => setCardW(e.nativeEvent.layout.width)}>
        <ProductGallery images={product.gallery ?? []} width={cardW} aspectRatio={4 / 3} />
      </View>
      {soldOut && (
        <View style={styles.badge}><Text style={styles.badgeText}>Sold out</Text></View>
      )}
      <View style={styles.cardBody}>
        {/* The name, with the price as a pill at its right. */}
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={2}>{product.title}</Text>
          <PricePill label={priceRange(product)} size="sm" />
        </View>
        {blurb ? (
          <Text style={[styles.cardBlurb, { color: colors.muted }]} numberOfLines={2}>{blurb}</Text>
        ) : null}
        {/* Straight to checkout when there's nothing to choose; otherwise the
            panel, where the options are. */}
        {!soldOut && (
          // Gold, full width: the one thing to do with a product, and the
          // colour the app spends on paying for things.
          <SummaryTouchable
            style={styles.buyBtn}
            onPress={onBuy}
            activeOpacity={0.85}
            accessibilityLabel={`Buy ${product.title}`}
          >
            <Text style={styles.buyText}>Buy now</Text>
          </SummaryTouchable>
        )}
      </View>
    </SummaryTouchable>
  );
}

export default function ShopScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const colors = useColors();

  const { data, isLoading, isFetching, isError, refetch } = useGetProductsQuery();
  const products = data?.entries ?? [];

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  /** The product open in the panel, and the card it grew out of. */
  const [open, setOpen] = useState<{ handle: string; origin: SummaryOrigin | null } | null>(null);
  const checkout = useShopifyCheckoutSheet();
  const buyFromCard = (p: ShopProduct, origin: SummaryOrigin | null) => {
    const url = directBuyUrl(p);
    if (url) presentCheckout(checkout, url);
    else setOpen({ handle: p.handle, origin });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
        <AppHeader spacer />
        <View style={[styles.content, { backgroundColor: colors.cream }]}><Spinner fullScreen /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader spacer />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        <FlatList
          ref={scrollRef}
          data={products}
          keyExtractor={(p) => p.handle}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primaryAlt} />}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={[styles.introTitle, { color: colors.fg }]}>Shop</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={(origin) => setOpen({ handle: item.handle, origin })}
              onBuy={(origin) => buyFromCard(item, origin)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title={isError ? "Couldn't load the shop" : 'No products available'}
                message={isError ? 'Check your connection and pull to refresh.' : undefined}
              />
            </View>
          }
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
    // One product per row: at full width the photo is the pitch, so the grid's
    // two-up crop was costing the merch more than the density was worth.
    width: '100%', marginBottom: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  badge:     {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS,
  },
  badgeText: { color: COLOR_WHITE, fontSize: 11, fontFamily: FONT_INTER.bold },
  cardBody:  { padding: 14, gap: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, minWidth: 0, fontSize: 17, fontFamily: FONT_INTER.bold, lineHeight: 22 },
  cardBlurb: { fontSize: 13, lineHeight: 18 },
  cardImgWrap: { borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  buyBtn:    {
    marginTop: 4, height: 44, borderRadius: COMMON_RADIUS,
    backgroundColor: COLOR_PRO, alignItems: 'center', justifyContent: 'center',
  },
  buyText:   { color: COLOR_BLACK, fontSize: 15, fontFamily: FONT_INTER.bold },
  emptyWrap: { paddingTop: 40 },
});
