import React from 'react';
import { View, StyleSheet, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { ListOrdered } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { List } from '../../types/api';

/** The most tiles a preview shows; past three they're too small to read. */
export const LIST_PREVIEW_MAX = 3;

/**
 * The pictures that stand for a list on a card: what it ranks, before what it
 * wears.
 *
 * A list is its items — "Top 5 designers" is five faces, not the cover the
 * author happened to pick — so the preview is the first photo of each of the
 * first few items that have one. Only a list whose items are all text falls
 * back to its own cover, and one with neither gets nothing, which the mosaic
 * draws as a placeholder rather than an empty box.
 */
export function listPreviewPhotos(list: List): string[] {
  const photos: string[] = [];
  for (const item of list.items ?? []) {
    if (item.deleted) continue;
    const url = firstGalleryUrl(item.gallery);
    if (url) photos.push(url);
    if (photos.length >= LIST_PREVIEW_MAX) break;
  }
  if (photos.length > 0) return photos;
  const cover = firstGalleryUrl(list.gallery);
  return cover ? [cover] : [];
}

/**
 * Two or three item photos in the space a single cover used to take.
 *
 * One photo fills the box. Two split it side by side. Three go hero-and-pair:
 * a wide tile on the left, two stacked on the right — the shape a photo app
 * uses for an album, and the one that keeps every tile a readable size at the
 * shelf card's 168 points as well as at a full-width row.
 *
 * Square-cornered on purpose: it sits flush inside a card that clips to
 * COMMON_RADIUS, so the card's corners are its corners.
 */
export default function ListPreviewMosaic({ list, height, style }: {
  list: List;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const photos = listPreviewPhotos(list);

  // Keyed by slot, not URL: two items can share a photo.
  const tile = (uri: string, slot: number, flexStyle: ImageStyle) => (
    <Image
      key={slot}
      source={{ uri }}
      style={[styles.tile, flexStyle]}
      contentFit="cover"
      transition={150}
    />
  );

  if (photos.length === 0) {
    return (
      <View style={[styles.box, styles.blank, { height, backgroundColor: colors.segment }, style]}>
        <ListOrdered size={22} color={colors.grey} />
      </View>
    );
  }

  return (
    // The gaps show the card's surface through them — a seam, not a border.
    <View style={[styles.box, styles.row, { height, backgroundColor: colors.card }, style]}>
      {photos.length < 3 ? (
        photos.map((uri, i) => tile(uri, i, styles.fill))
      ) : (
        <>
          {tile(photos[0], 0, styles.hero)}
          <View style={styles.pair}>
            {tile(photos[1], 1, styles.fill)}
            {tile(photos[2], 2, styles.fill)}
          </View>
        </>
      )}
    </View>
  );
}

const SEAM = 2;

const styles = StyleSheet.create({
  box:   { width: '100%', overflow: 'hidden' },
  blank: { alignItems: 'center', justifyContent: 'center' },
  row:   { flexDirection: 'row', gap: SEAM },
  tile:  { backgroundColor: '#161616' },
  fill:  { flex: 1 },
  // Wider than tall on the left so the pair on the right stays near square.
  hero:  { flex: 2 },
  pair:  { flex: 1, gap: SEAM },
});
