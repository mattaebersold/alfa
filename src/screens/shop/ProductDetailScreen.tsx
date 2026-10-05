import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, FlatList, TouchableOpacity, Alert, Linking, useWindowDimensions,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShopifyCheckoutSheet } from '@shopify/checkout-sheet-kit';
import AppHeader from '../../components/ui/AppHeader';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import RichText from '../../components/ui/RichText';
import ImageLightbox from '../../components/ui/ImageLightbox';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useGetProductQuery } from '../../api/apiService';
import { ss } from '../../styles/shared';
import type { AppScreenProps } from '../../navigation/types';
import type { ShopImage, ShopVariant } from '../../types/api';
import { PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/**
 * One product, and the way to buy it — without leaving the app.
 *
 * The product is Shopify's, read through horacio. Buying is Shopify's too, but
 * presented here: "Buy now" opens Shopify's native checkout sheet
 * (`@shopify/checkout-sheet-kit`) on top of this screen, with the chosen
 * variant already in the cart. Shopify takes the payment, the address, the
 * receipt and the inventory; this screen only hands it a URL and listens for
 * the result.
 *
 * ## The URL
 *
 * Each variant carries a `checkout_url`, a Shopify cart permalink
 * (`/cart/<variant>:1`) built server-side. The kit accepts a permalink
 * directly, so there's no Storefront cart mutation and no cart state anywhere
 * on our side. Preloading it as soon as a variant is picked is what makes the
 * sheet open instantly rather than loading in front of the buyer.
 *
 * ## Apple
 *
 * Physical goods must *not* go through in-app purchase (guideline 3.1.3(e)),
 * and Shopify's sheet is a web checkout — Apple Pay, card entry — which is the
 * method the rule asks for. Nothing here touches StoreKit.
 *
 * ## Without the native module
 *
 * A dev client built before the kit was added has no native side for it, and
 * `present` throws. The catch falls back to the system browser at the same URL,
 * so the shop still sells in the meantime; a rebuild makes it in-app.
 */

const money = (n: number | null | undefined, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 0 }).format(Number(n) || 0);

/** A Shopify CDN image at a given width; Shopify resizes on the fly. */
const shopImage = (img: ShopImage | undefined, width: number): string | null =>
  img?.url ? `${img.url}${img.url.includes('?') ? '&' : '?'}width=${width}` : null;

export default function ProductDetailScreen({ navigation, route }: AppScreenProps<'ProductDetail'>) {
  const { handle } = route.params;
  const colors = useColors();
  const brand = useBrandColor();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const checkout = useShopifyCheckoutSheet();

  const { data: product, isLoading, isError, refetch } = useGetProductQuery(handle);

  const [variantId, setVariantId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [presenting, setPresenting] = useState(false);

  const variants = product?.variants ?? [];
  const selected: ShopVariant | null = variants.find((v) => v.id === variantId) ?? null;
  const needsVariant = variants.length > 0 && !selected;
  const price = selected?.price ?? product?.price ?? null;
  const compareAt = selected ? selected.compare_at_price : product?.compare_at_price;
  const inStock = selected ? selected.inStock : product?.inStock !== false;
  const buyUrl = selected?.checkout_url ?? product?.checkout_url ?? null;

  // A product with one real variant has nothing to pick; preselect it so the
  // first thing the buyer sees is a working button.
  useEffect(() => {
    if (variants.length === 1 && variants[0].inStock) setVariantId(variants[0].id);
  }, [variants]);

  // Warm the sheet the moment there's something to buy. A hint, not a
  // guarantee — present() works either way, this just makes it fast.
  useEffect(() => {
    if (buyUrl && inStock) {
      try { checkout.preload(buyUrl); } catch { /* no native module yet; see header */ }
    }
  }, [buyUrl, inStock, checkout]);

  // The result comes back as events, not a return value.
  useEffect(() => {
    const done = checkout.addEventListener('completed', () => {
      setPresenting(false);
      Alert.alert('Order placed', 'Thanks — your receipt is on its way from Shopify.', [
        { text: 'Back to the shop', onPress: () => navigation.goBack() },
      ]);
    });
    const closed = checkout.addEventListener('close', () => setPresenting(false));
    const failed = checkout.addEventListener('error', (e: { message?: string }) => {
      setPresenting(false);
      Alert.alert("Checkout couldn't open", e?.message || 'Try again in a moment.');
    });
    return () => { done?.remove(); closed?.remove(); failed?.remove(); };
  }, [checkout, navigation]);

  const buy = useCallback(() => {
    if (!buyUrl) return;
    setPresenting(true);
    try {
      checkout.present(buyUrl);
    } catch {
      // Older build without the native module: the browser still sells it.
      setPresenting(false);
      Linking.openURL(buyUrl).catch(() => Alert.alert("Couldn't open checkout", 'Try again in a moment.'));
    }
  }, [buyUrl, checkout]);

  const images = product?.gallery ?? [];
  const lightboxUrls = useMemo(() => images.map((g) => shopImage(g, 1600)).filter(Boolean) as string[], [images]);
  const galleryRef = useRef<FlatList<ShopImage>>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
        <AppHeader spacer />
        <Spinner fullScreen />
      </SafeAreaView>
    );
  }

  if (isError || !product) {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
        <AppHeader spacer />
        <View style={styles.emptyWrap}>
          <EmptyState title="That product isn't available" message="It may have been removed from the shop." />
          <View style={styles.emptyBtn}><Button label="Try again" variant="outline" onPress={() => refetch()} /></View>
        </View>
      </SafeAreaView>
    );
  }

  const footerLabel = !inStock ? 'Sold out' : needsVariant ? `Pick ${product.options?.[0]?.name?.toLowerCase() || 'an option'}` : `Buy now · ${money(price, product.currency)}`;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader spacer />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* ── Photos: swipe through, tap to zoom ── */}
        {images.length > 0 ? (
          <View>
            <FlatList
              ref={galleryRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(g, i) => g.url ?? String(i)}
              onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.95} onPress={() => { setImageIndex(index); setLightbox(true); }}>
                  <Image
                    source={{ uri: shopImage(item, 1200)! }}
                    style={{ width, aspectRatio: 1, backgroundColor: colors.segment }}
                    contentFit="cover"
                    transition={150}
                  />
                </TouchableOpacity>
              )}
            />
            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((g, i) => (
                  <View key={g.url ?? i} style={[styles.dot, { backgroundColor: i === imageIndex ? colors.fg : colors.grey, opacity: i === imageIndex ? 1 : 0.45 }]} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={{ width, aspectRatio: 1, backgroundColor: colors.segment }} />
        )}

        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.fg }]}>{product.title}</Text>
          {product.subtitle ? <Text style={[styles.subtitle, { color: colors.grey }]}>{product.subtitle}</Text> : null}

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.fg }]}>{money(price, product.currency)}</Text>
            {compareAt != null && price != null && compareAt > price && (
              <Text style={[styles.compareAt, { color: colors.grey }]}>{money(compareAt, product.currency)}</Text>
            )}
            {!inStock && <View style={[styles.soldOutPill, { borderColor: colors.border }]}><Text style={[styles.soldOutText, { color: colors.grey }]}>Sold out</Text></View>}
          </View>

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
                      <Text style={[styles.chipText, { color: on ? '#000' : colors.fg, textDecorationLine: out ? 'line-through' : 'none' }]}>
                        {v.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Description, as written in the Shopify admin ── */}
          {product.body ? (
            <View style={[styles.description, { borderTopColor: colors.border }]}>
              <RichText html={product.body} size={15} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Buy, pinned to the foot ── */}
      <View style={[styles.footer, { backgroundColor: colors.cream, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <Button
          label={footerLabel}
          size="full"
          onPress={buy}
          disabled={!inStock || needsVariant || !buyUrl}
          loading={presenting}
        />
        <Text style={[styles.footerNote, { color: colors.grey }]}>Secure checkout by Shopify · Apple Pay and cards accepted</Text>
      </View>

      <ImageLightbox images={lightboxUrls} initialIndex={imageIndex} visible={lightbox} onClose={() => setLightbox(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body:        { paddingHorizontal: 16, paddingTop: 16 },
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot:         { width: 6, height: 6, borderRadius: 3 },
  title:       { fontSize: 24, fontFamily: FONT_INTER.bold, lineHeight: 30 },
  subtitle:    { fontSize: 14, marginTop: 2 },
  priceRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  price:       { fontSize: 22, fontFamily: FONT_INTER.extrabold },
  compareAt:   { fontSize: 16, textDecorationLine: 'line-through' },
  soldOutPill: { borderWidth: 1, borderRadius: PILL_RADIUS, paddingHorizontal: 8, paddingVertical: 2 },
  soldOutText: { fontSize: 11, fontFamily: FONT_INTER.bold },
  options:     { marginTop: 20 },
  optionsLabel:{ fontSize: 11, fontFamily: FONT_INTER.bold, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { borderWidth: 1.5, borderRadius: PILL_RADIUS, paddingHorizontal: 16, paddingVertical: 9 },
  chipText:    { fontSize: 14, fontFamily: FONT_INTER.bold },
  description: { marginTop: 22, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  footer:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 12, gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerNote:  { fontSize: 11, textAlign: 'center' },
  emptyWrap:   { flex: 1, paddingTop: 60, alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  emptyBtn:    { alignSelf: 'center' },
});
