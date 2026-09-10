import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ExternalLink, Plus, Pencil } from 'lucide-react-native';
import AppHeader from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { useGetProductsQuery, useGetAdminProductsQuery } from '../../api/apiService';
import { ss } from '../../styles/shared';
import { firstGalleryUrl } from '../../utils/image';
import type { ShopProduct } from '../../types/api';

/**
 * Where a product is bought.
 *
 * The listing comes from our own API, but the *purchase* happens on the web —
 * a tap opens the phone's browser at the product page rather than paying
 * in-app. Two reasons, and only one of them is Apple:
 *
 * Venmo and PayPal both hand off to their own apps or web flows, and driving
 * that from inside a React Native screen means owning a webview, its cookies,
 * and its return trip. The system browser already does all of that properly.
 *
 * And Apple requires anything that isn't a digital good to be paid for outside
 * IAP — physical merch qualifies — so leaving the app is the unambiguous
 * reading of the rule rather than an interpretation of it.
 */
const WEB_BASE = 'https://openroadsociety.co';


function formatPrice(p: ShopProduct): string {
  // Variants can each carry their own price, so the card shows the range the
  // product actually spans rather than a number that might not be buyable.
  const prices = (p.variants ?? [])
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  const all = prices.length ? prices : [Number(p.price) || 0];
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
  const min = Math.min(...all);
  const max = Math.max(...all);
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

function ProductCard({ product, onPress, onEdit }: {
  product: ShopProduct;
  onPress: () => void;
  /** Admins only — a pencil in the corner, straight to the edit form. */
  onEdit?: () => void;
}) {
  const colors = useColors();
  const img = firstGalleryUrl(product.gallery);
  // The server works this out across variants and quantity tracking; the card
  // shouldn't try to re-derive it from a partial view of the same data.
  const soldOut = product.inStock === false;
  const isDraft = product.status === 'draft';
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.88}>
      {img
        ? <Image source={{ uri: img }} style={styles.cardImg} contentFit="cover" />
        : <View style={[styles.cardImg, { backgroundColor: colors.segment }]} />}
      {/* A draft is in this list only because an admin is looking at it, so it
          has to say so — otherwise it reads as live merch. */}
      {isDraft ? (
        <View style={styles.badge}><Text style={styles.badgeText}>Draft</Text></View>
      ) : soldOut ? (
        <View style={styles.badge}><Text style={styles.badgeText}>Sold out</Text></View>
      ) : null}
      {onEdit && (
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} hitSlop={8} accessibilityLabel={`Edit ${product.title}`}>
          <Pencil size={13} color="#FFFFFF" />
        </TouchableOpacity>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={2}>{product.title}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardPrice, { color: colors.fg }]}>{formatPrice(product)}</Text>
          <ExternalLink size={13} color={colors.grey} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ShopScreen() {
  const colors = useColors();
  const brand = useBrandColor();
  const nav = useNavigation<any>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const isAdmin = userInfo?.accountType === 'admin';

  // Two listings, one screen. An admin reads the endpoint that includes drafts
  // — otherwise a product they just added as a draft is invisible to the person
  // who added it — and everyone else reads the public one.
  const publicQuery = useGetProductsQuery(undefined, { skip: isAdmin });
  const adminQuery = useGetAdminProductsQuery(undefined, { skip: !isAdmin });
  const { data, isLoading, isFetching, isError, refetch } = isAdmin ? adminQuery : publicQuery;

  const products = data?.entries ?? [];
  const loading = isLoading;
  const error = isError;

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const openProduct = (p: ShopProduct) => Linking.openURL(`${WEB_BASE}/shop/${p.handle}`);

  if (loading) {
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
          data={products}
          keyExtractor={(p) => p.internal_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={onRefresh} tintColor={colors.primaryAlt} />}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={[styles.introTitle, { color: colors.fg }]}>Shop</Text>
              {/* Admin-only, and the server enforces the same rule on the
                  write — this only decides whether to offer it. */}
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: brand }]}
                  onPress={() => nav.navigate('ProductCreate')}
                  activeOpacity={0.85}
                >
                  <Plus size={15} color="#000000" />
                  <Text style={styles.addBtnText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => openProduct(item)}
              onEdit={isAdmin ? () => nav.navigate('ProductCreate', { productId: item.internal_id }) : undefined}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title={error ? "Couldn't load the shop" : 'No products available'}
                message={error ? 'Check your connection and pull to refresh.' : undefined}
              />
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:   { flex: 1 },
  list:      { paddingHorizontal: 12, paddingBottom: 32 },
  intro:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    // The list already pads 12; 4 more lands the heading on the 16 the rest
    // of the app uses without pushing the cards in with it.
    paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6,
  },
  introTitle:{ fontSize: 22, fontWeight: '800' },
  introSub:  { fontSize: 13, marginTop: 4, lineHeight: 18 },
  card:      {
    // One product per row: at full width the photo is the pitch, so the grid's
    // two-up crop was costing the merch more than the density was worth.
    width: '100%', marginBottom: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg:   { width: '100%', aspectRatio: 4 / 3 },
  badge:     {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  editBtn:   {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  addBtnText:{ fontSize: 13, fontWeight: '800', color: '#000000' },
  cardBody:  { padding: 14, gap: 6 },
  cardTitle: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 16, fontWeight: '800' },
  emptyWrap: { paddingTop: 40 },
});
