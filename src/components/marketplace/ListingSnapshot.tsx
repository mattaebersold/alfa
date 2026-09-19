import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import type { GalleryItem, ListingPriceMode } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * What a listing costs, in words.
 *
 * `price_mode` is the question, not `price`: a want ad with no number is not
 * free, and a swap is not £0. Only 'amount' looks at the number at all.
 */
export function priceLabel(
  price?: number | null,
  mode?: ListingPriceMode | '',
  currency = 'USD',
): string {
  if (mode === 'free') return 'Free';
  if (mode === 'trade') return 'Trade';
  if (price == null) return '';
  // Whole units, as the server stores them. Non-dollar currencies fall back to
  // their code rather than an invented symbol.
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${Number(price).toLocaleString()}`;
}

/** The first photo of a listing or a thread's snapshot, as a URL. */
export function listingThumb(photo?: GalleryItem | GalleryItem[] | null): string | null {
  const first = Array.isArray(photo) ? photo[0] : photo;
  return first?.filename ? imageUrl(first.filename) : null;
}

/**
 * The item a conversation is about: thumbnail, title, price.
 *
 * Shared by the conversation list and the conversation's own header so the
 * thing being discussed looks the same in both places. It renders from a
 * *snapshot* — the fields a thread carries — rather than from a live listing,
 * which is what lets a conversation about a deleted listing still say what it
 * was about. `unavailable` greys it and says so.
 */
export default function ListingSnapshot({
  title,
  photo,
  price,
  priceMode,
  currency,
  priceText,
  sold,
  deleted,
  size = 46,
  onPress,
  style,
}: {
  title: string;
  photo?: GalleryItem | null;
  price?: number | null;
  priceMode?: ListingPriceMode | '';
  currency?: string;
  /**
   * The price already in words, for a caller holding a whole listing — that's
   * `listingFormat.priceLabel`, which knows about OBO and about a want ad
   * naming what the buyer will pay. A thread's snapshot carries none of that,
   * which is why the plain fields above exist at all.
   */
  priceText?: string | null;
  sold?: boolean;
  deleted?: boolean;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const thumb = listingThumb(photo);
  const money = priceText ?? priceLabel(price, priceMode, currency);
  // A deleted listing can't be opened, so it isn't offered as a button.
  const Wrapper: any = onPress && !deleted ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[styles.wrap, style]}
      onPress={onPress && !deleted ? onPress : undefined}
      activeOpacity={0.8}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={[styles.thumb, { width: size, height: size }, deleted && styles.faded]}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.thumb, { width: size, height: size, backgroundColor: colors.segment }]} />
      )}
      <View style={styles.text}>
        <Text
          style={[styles.title, { color: deleted ? colors.grey : colors.fg }]}
          numberOfLines={1}
        >
          {title || 'Listing'}
        </Text>
        <View style={styles.metaRow}>
          {!!money && (
            <Text style={[styles.price, { color: colors.primaryAlt }]}>{money}</Text>
          )}
          {deleted ? (
            <Text style={[styles.state, { color: colors.grey }]}>Removed</Text>
          ) : sold ? (
            <Text style={[styles.state, { color: colors.grey }]}>Sold</Text>
          ) : null}
        </View>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  thumb:   { borderRadius: COMMON_RADIUS },
  faded:   { opacity: 0.45 },
  text:    { flex: 1, minWidth: 0 },
  title:   { fontSize: 14, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  price:   { fontSize: 13, fontWeight: '800' },
  state:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
});
