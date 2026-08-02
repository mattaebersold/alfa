import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, RefreshControl, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink } from 'lucide-react-native';
import AppHeader from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';

const SHOP_BASE = 'https://shop.openroadsociety.co';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 12 * 3) / 2;

interface ShopProduct {
  id: number;
  title: string;
  handle: string;
  vendor?: string;
  images?: { src: string }[];
  variants?: { price: string; available: boolean }[];
}

function formatPrice(p: ShopProduct): string {
  const prices = (p.variants ?? []).map((v) => parseFloat(v.price)).filter((n) => !Number.isNaN(n));
  if (prices.length === 0) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const fmt = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`;
  return min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
}

function ProductCard({ product, onPress }: { product: ShopProduct; onPress: () => void }) {
  const colors = useColors();
  const img = product.images?.[0]?.src ?? null;
  const soldOut = (product.variants ?? []).length > 0 && (product.variants ?? []).every((v) => v.available === false);
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.88}>
      {img
        ? <Image source={{ uri: img }} style={styles.cardImg} contentFit="cover" />
        : <View style={[styles.cardImg, { backgroundColor: colors.segment }]} />}
      {soldOut && (
        <View style={styles.soldOut}><Text style={styles.soldOutText}>Sold out</Text></View>
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
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const res = await fetch(`${SHOP_BASE}/products.json?limit=250`);
      const data = await res.json();
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const openProduct = (p: ShopProduct) => Linking.openURL(`${SHOP_BASE}/products/${p.handle}`);

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
          keyExtractor={(p) => String(p.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryAlt} />}
          ListHeaderComponent={
            <View style={styles.intro}>
              <Text style={[styles.introTitle, { color: colors.fg }]}>Shop</Text>
              <Text style={[styles.introSub, { color: colors.grey }]}>
                Official Open Road Society gear. Tap a product to view and buy on our store.
              </Text>
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} onPress={() => openProduct(item)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title={error ? "Couldn't load the shop" : 'No products available'}
                message={error ? 'Check your connection and pull to refresh.' : undefined}
                actionLabel="Open store in browser"
                onAction={() => Linking.openURL(SHOP_BASE)}
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
  list:      { paddingBottom: 32 },
  intro:     { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  introTitle:{ fontSize: 22, fontWeight: '800' },
  introSub:  { fontSize: 13, marginTop: 4, lineHeight: 18 },
  row:       { gap: 12, paddingHorizontal: 12, marginBottom: 12 },
  card:      {
    width: CARD_WIDTH, borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImg:   { width: '100%', aspectRatio: 1 },
  soldOut:   {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  soldOutText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  cardBody:  { padding: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', lineHeight: 18 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardPrice: { fontSize: 14, fontWeight: '800' },
  emptyWrap: { paddingTop: 40 },
});
