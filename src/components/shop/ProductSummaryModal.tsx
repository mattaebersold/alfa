import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Linking, useWindowDimensions } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import { ShoppingBag } from 'lucide-react-native';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import Spinner from '../ui/Spinner';
import EmptyState from '../ui/EmptyState';
import RichText from '../ui/RichText';
import ImageLightbox from '../ui/ImageLightbox';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useGetProductQuery } from '../../api/apiService';
import type { ShopImage, ShopProduct, ShopVariant } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_GREEN, COLOR_PRO } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A product, answered in place: the photos, the price, the options, the
 * description, and Buy — over the shop you were scrolling, the way a listing
 * or a car is summarised, rather than a screen of its own.
 *
 * Buying is Shopify's, as it was on the product screen this replaces (see
 * ProductDetailScreen for the checkout URL, the Apple reasoning and the
 * no-native-module fallback — all of it holds here). The panel's own bottom
 * button is the Buy: it runs once the panel has closed, which is also the
 * moment a native sheet can be presented cleanly on iOS. While there's no
 * buyable choice yet — an option to pick, or sold out — the button stays
 * out, and the body says what's wanted instead.
 */

const money = (n: number | null | undefined, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0 }).format(Number(n) || 0);

/** A Shopify CDN image at a given width; Shopify resizes on the fly. */
const shopImage = (img: ShopImage | undefined, width: number): string | null =>
  img?.url ? `${img.url}${img.url.includes('?') ? '&' : '?'}width=${width}` : null;

/** The range a product spans across its variants, as the shop's cards show it. */
export function priceRange(p: ShopProduct): string {
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
  const min = Number(p.price) || 0;
  const max = Number(p.price_max ?? p.price) || min;
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

/**
 * The product's photos, one at a time, swiped through — with dots when there
 * is more than one, and nothing extra when there's one. The shop's card and
 * the panel both draw this, at their own widths; the width has to be given,
 * since a paging list can't size its pages from a parent it's inside.
 *
 * Taps go to whoever is around it: the card, which opens the panel, or the
 * panel's zoom. A paging list only claims a touch that moves.
 */
export function ProductGallery({ images, width, aspectRatio = 1, onPressImage, index, onIndexChange, dots = true }: {
  images: ShopImage[];
  width: number;
  aspectRatio?: number;
  onPressImage?: (index: number) => void;
  /** The page shown, when the host keeps it (the panel's zoom opens on it). */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Off for a host drawing its own page marker (the concierge rows' feed-style pill). */
  dots?: boolean;
}) {
  const colors = useColors();
  const [own, setOwn] = useState(0);
  const current = index ?? own;
  const setCurrent = (i: number) => { setOwn(i); onIndexChange?.(i); };

  if (images.length === 0 || width <= 0) {
    return <View style={{ width: width || '100%', aspectRatio, backgroundColor: colors.segment }} />;
  }
  const frame = (item: ShopImage) => (
    <Image
      source={{ uri: shopImage(item, 1200)! }}
      style={{ width, aspectRatio, backgroundColor: colors.segment }}
      contentFit="cover"
      transition={150}
    />
  );
  return (
    <View>
      {images.length === 1 ? (
        onPressImage
          ? <TouchableOpacity activeOpacity={0.95} onPress={() => onPressImage(0)}>{frame(images[0])}</TouchableOpacity>
          : frame(images[0])
      ) : (
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          keyExtractor={(g, i) => g.url ?? String(i)}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item, index: i }) => (
            onPressImage
              ? <TouchableOpacity activeOpacity={0.95} onPress={() => onPressImage(i)}>{frame(item)}</TouchableOpacity>
              : frame(item)
          )}
        />
      )}
      {dots && images.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {images.map((g, i) => (
            <View
              key={g.url ?? i}
              style={[styles.dot, { backgroundColor: i === current ? colors.fg : colors.grey, opacity: i === current ? 1 : 0.45 }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

/** The price as a green pill — beside a title on the card and in the panel. */
export function PricePill({ label, size = 'md' }: { label: string; size?: 'sm' | 'md' }) {
  return (
    <View style={[styles.pill, size === 'sm' && styles.pillSm]}>
      <Text style={[styles.pillText, size === 'sm' && styles.pillTextSm]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/**
 * The one checkout URL a product can go straight to, or null when a choice
 * has to be made first: a product with no options carries its own, one with
 * a single in-stock variant carries that one's, and anything with more needs
 * the panel's option chips.
 */
export function directBuyUrl(p: ShopProduct): string | null {
  if (p.inStock === false) return null;
  const variants = p.variants ?? [];
  if (variants.length === 0) return p.checkout_url ?? null;
  const live = variants.filter((v) => v.inStock);
  return live.length === 1 && variants.length === 1 ? live[0].checkout_url ?? null : null;
}

/** Shopify's sheet, or the browser on a build without the native module. */
export function presentCheckout(checkout: ReturnType<typeof useShopifyCheckoutSheet>, url: string) {
  try {
    checkout.present(url);
  } catch {
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open checkout", 'Try again in a moment.'));
  }
}

export default function ProductSummaryModal({ handle, origin, onClose }: {
  /** The product to show; null while closed. */
  handle: string | null;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const { width: screenW } = useWindowDimensions();
  // The panel is 90% of the screen, less its border — see SummaryModal.
  const panelW = Math.round(screenW * 0.9) - 2;
  const checkout = useShopifyCheckoutSheet();

  const { data: product, isLoading, isError } = useGetProductQuery(handle ?? '', { skip: !handle });

  const [variantId, setVariantId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  // A fresh product starts unpicked.
  useEffect(() => { setVariantId(null); setImageIndex(0); }, [handle]);

  const variants = product?.variants ?? [];
  const selected: ShopVariant | null = variants.find((v) => v.id === variantId) ?? null;
  const needsVariant = variants.length > 0 && !selected;
  const price = selected?.price ?? product?.price ?? null;
  const compareAt = selected ? selected.compare_at_price : product?.compare_at_price;
  const inStock = selected ? selected.inStock : product?.inStock !== false;
  const buyUrl = selected?.checkout_url ?? product?.checkout_url ?? null;

  // One real variant: nothing to pick, so it's picked.
  useEffect(() => {
    if (variants.length === 1 && variants[0].inStock) setVariantId(variants[0].id);
  }, [variants]);

  // Warm the sheet as soon as there's something to buy.
  useEffect(() => {
    if (buyUrl && inStock) {
      try { checkout.preload(buyUrl); } catch { /* no native module yet */ }
    }
  }, [buyUrl, inStock, checkout]);

  useEffect(() => {
    const done = checkout.addEventListener('completed', () => {
      Alert.alert('Order placed', 'Thanks — your receipt is on its way from Shopify.');
    });
    const failed = checkout.addEventListener('error', (e: { message?: string }) => {
      Alert.alert("Checkout couldn't open", e?.message || 'Try again in a moment.');
    });
    return () => { done?.remove(); failed?.remove(); };
  }, [checkout]);

  const buy = useCallback(() => { if (buyUrl) presentCheckout(checkout, buyUrl); }, [buyUrl, checkout]);

  const images = product?.gallery ?? [];
  const lightboxUrls = useMemo(() => images.map((g) => shopImage(g, 1600)).filter(Boolean) as string[], [images]);

  const canBuy = !!product && inStock && !needsVariant && !!buyUrl;
  const optionName = product?.options?.[0]?.name?.toLowerCase() || 'an option';

  return (
    <SummaryModal
      visible={!!handle}
      onClose={onClose}
      origin={origin}
      actionLabel={canBuy ? `Buy now · ${money(price, product?.currency)}` : undefined}
      actionIcon={ShoppingBag}
      actionColor={COLOR_PRO}
      onAction={canBuy ? buy : undefined}
    >
      {isLoading || !product ? (
        <View style={styles.loading}>
          {isError
            ? <EmptyState title="That product isn't available" message="It may have been removed from the shop." />
            : <Spinner />}
        </View>
      ) : (
        <View>
          {/* ── Photos: swipe through, tap to zoom. Rounded at the foot too,
              as on the card, so the picture sits in the panel. ── */}
          <View style={styles.galleryWrap}>
            <ProductGallery
              images={images}
              width={panelW}
              index={imageIndex}
              onIndexChange={setImageIndex}
              onPressImage={(i) => { setImageIndex(i); setLightbox(true); }}
            />
          </View>

          <View style={styles.body}>
            {/* The name, with the price beside it. */}
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.fg }]}>{product.title}</Text>
              <PricePill label={money(price, product.currency)} />
            </View>
            {product.subtitle ? <Text style={[styles.subtitle, { color: colors.grey }]}>{product.subtitle}</Text> : null}
            {(compareAt != null && price != null && compareAt > price) || !inStock ? (
              <View style={styles.metaRow}>
                {compareAt != null && price != null && compareAt > price && (
                  <Text style={[styles.compareAt, { color: colors.grey }]}>{money(compareAt, product.currency)}</Text>
                )}
                {!inStock && (
                  <View style={[styles.soldOutPill, { borderColor: colors.border }]}>
                    <Text style={[styles.soldOutText, { color: colors.grey }]}>Sold out</Text>
                  </View>
                )}
              </View>
            ) : null}

            {/* ── Options ── */}
            {variants.length > 0 && (
              <View style={styles.options}>
                <Text style={[styles.optionsLabel, { color: colors.grey }]}>
                  {product.options?.length === 1 ? product.options[0].name : 'Options'}
                </Text>
                <View style={styles.chips}>
                  {variants.map((v) => {
                    const on = v.id === variantId;
                    const out = !v.inStock;
                    return (
                      <TouchableOpacity
                        key={v.id}
                        disabled={out}
                        onPress={() => setVariantId(on ? null : v.id)}
                        activeOpacity={0.8}
                        style={[
                          styles.chip,
                          { borderColor: on ? brand : colors.border, backgroundColor: on ? brand : 'transparent', opacity: out ? 0.4 : 1 },
                        ]}
                        accessibilityState={{ selected: on, disabled: out }}
                      >
                        <Text style={[styles.chipText, { color: on ? COLOR_BLACK : colors.fg, textDecorationLine: out ? 'line-through' : 'none' }]}>
                          {v.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* What's between the buyer and the button, while there is something. */}
                {!canBuy && (
                  <Text style={[styles.hint, { color: colors.grey }]}>
                    {!inStock ? 'Sold out' : `Pick ${optionName} to buy`}
                  </Text>
                )}
              </View>
            )}

            {/* ── Description, as written in the Shopify admin ── */}
            {product.body ? (
              <View style={[styles.description, { borderTopColor: colors.border }]}>
                <RichText html={product.body} size={14} />
              </View>
            ) : null}
          </View>
        </View>
      )}

      <ImageLightbox images={lightboxUrls} initialIndex={imageIndex} visible={lightbox} onClose={() => setLightbox(false)} />
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  loading:     { minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: 24 },
  galleryWrap: { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  body:        { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  dots:        { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot:         { width: 6, height: 6, borderRadius: 3, shadowColor: COLOR_BLACK, shadowOpacity: 0.6, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  titleRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:       { flex: 1, minWidth: 0, fontSize: 20, fontFamily: FONT_INTER.bold, lineHeight: 26 },
  subtitle:    { fontSize: 13, marginTop: 2 },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  compareAt:   { fontSize: 14, textDecorationLine: 'line-through' },
  soldOutPill: { borderWidth: 1, borderRadius: PILL_RADIUS, paddingHorizontal: 8, paddingVertical: 2 },
  soldOutText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  options:     { marginTop: 16 },
  optionsLabel:{ fontSize: 11, fontFamily: FONT_INTER.bold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { borderWidth: 1.5, borderRadius: PILL_RADIUS, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:    { fontSize: 13, fontFamily: FONT_INTER.bold },
  hint:        { fontSize: 12, fontFamily: FONT_INTER.medium, marginTop: 10 },
  description: { marginTop: 18, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },

  // Green, black on it, like the listing badges: the one number worth a colour.
  pill:        { backgroundColor: COLOR_GREEN, borderRadius: PILL_RADIUS, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0, marginTop: 2 },
  pillSm:      { paddingHorizontal: 8, paddingVertical: 3, marginTop: 1 },
  pillText:    { color: COLOR_BLACK, fontSize: 14, fontFamily: FONT_INTER.extrabold },
  pillTextSm:  { fontSize: 12 },
});
