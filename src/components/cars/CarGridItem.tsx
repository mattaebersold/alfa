import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import { useGetUserByIdQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import { usePosterRatio } from '../../hooks/usePosterRatio';
import type { GarageCar } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_GRAY_23, COLOR_WHITE } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * The overlay card's two shapes, from its photo: a little wider or a little
 * taller than square (6:5 and 5:6). The poster's 3:2 / 2:3 made the mosaic's
 * columns lurch between slabs and slivers.
 */
const OVERLAY_SHAPES = { landscape: 3 / 2.5, portrait: 2.5 / 3 };

/** The grid cards' fill — the darker shade the profile's shelves use. */
const CARD_BG = COLOR_GRAY_23;

/**
 * One car in a two-up grid: its photo (or the dimmed stand-in), its name with
 * year, make and model beneath when the owner named it, and the owner.
 *
 * Shared by the Cars screen and a brand's page, so a car looks the same in
 * both. The owner is looked up by id rather than read off the car, because not
 * every list that feeds this sends the owner along.
 */
export default function CarGridItem({ item, onPress, overlay = false }: {
  item: GarageCar;
  onPress: (origin: SummaryOrigin | null) => void;
  /**
   * The name, model and owner laid over the foot of the photo, on a gradient,
   * instead of in a row beneath it — a square card that's all picture. The
   * brand page's grid, where every card is the same make and the photo is
   * what tells them apart. Shaped by the photo — 6:5 wide, 5:6 tall — for a
   * mosaic, so the host lays these in columns rather than rows.
   */
  overlay?: boolean;
}) {
  const { ratio, onLoad } = usePosterRatio(undefined, OVERLAY_SHAPES);
  const colors = useColors();
  const hero = firstGalleryUrl(item.gallery) ?? (item.profile_image ? `https://partstash-ghia-images.s3.us-west-2.amazonaws.com/${item.profile_image}` : null);
  const { data: owner } = useGetUserByIdQuery(item.user_id, { skip: !item.user_id });
  const ymm = [item.year, item.make, item.model].filter(Boolean).join(' ');
  // The owner's name for it leads, with what it is underneath. A car with no
  // name of its own is its year, make and model — said once, not twice.
  const title = item.title || ymm || 'Car';
  const subtitle = item.title ? ymm : '';
  const info = overlay ? (
    // Over the photo: the words on the left, and the owner as just a face on
    // the right — the name would be a third line on a card with no room for it.
    <View style={[styles.cardInfo, styles.cardInfoOverlay]} pointerEvents="none">
      <View style={styles.overlayText}>
        <Text style={[styles.carTitle, { color: COLOR_WHITE }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.carSubtitle, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      {owner && <Avatar user={owner} size={26} />}
    </View>
  ) : (
    <View style={styles.cardInfo}>
      <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.carSubtitle, { color: colors.grey }]} numberOfLines={1}>{subtitle}</Text>
      ) : null}
      {owner && (
        <View style={styles.ownerRow}>
          <Avatar user={owner} size={20} />
          <Text style={[styles.ownerName, { color: colors.grey }]} numberOfLines={1}>@{owner.username}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SummaryTouchable style={[styles.card, overlay && styles.cardMosaic, { backgroundColor: CARD_BG }]} onPress={onPress}>
      <View style={[styles.cardImageContainer, overlay ? { aspectRatio: ratio } : styles.cardImageTile]}>
        <Image
          source={hero ? { uri: hero } : require('../../../assets/car-placeholder.jpg')}
          style={styles.cardImage}
          contentFit="cover"
          onLoad={overlay ? onLoad : undefined}
        />
        {/* The stand-in, dimmed — the same as a profile with no cover. A
            placeholder shouldn't outshine the real photos around it. */}
        {!hero && <View style={styles.placeholderDim} pointerEvents="none" />}
        {overlay && (
          <>
            {/* Near-black at the foot, fading out most of the way up: the
                words read on any photo, however bright. */}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.5, 1]}
              style={styles.overlayScrim}
              pointerEvents="none"
            />
            {info}
          </>
        )}
      </View>
      {!overlay && info}
    </SummaryTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImageContainer: { width: '100%', aspectRatio: 4 / 3 },
  cardImage: { width: '100%', height: '100%' },
  // Written out: RN 0.86 dropped `StyleSheet.absoluteFillObject`.
  placeholderDim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  // Laid out as the make and model tiles are: the photo full-bleed across the
  // top, rounded at its foot to the card's radius, and the words under it on
  // the left.
  cardImageTile: { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  cardInfo: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  // In a column rather than a row: full column width, no stretching to a
  // neighbour, and the gap below instead of beside.
  cardMosaic: { flex: 0, marginBottom: 8 },
  // A point past the foot: the photo's box rounds a sub-pixel short of the
  // card's, and flush, the card's own grey showed as a hairline beneath it.
  overlayScrim: { position: 'absolute', left: 0, right: 0, bottom: -1, height: '75%' },
  cardInfoOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10,
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  overlayText: { flex: 1, minWidth: 0 },
  // The car's own name leads, a clear step above the year/make/model under it.
  carTitle: { fontSize: 16, fontFamily: FONT_INTER.bold, letterSpacing: -0.2 },
  carSubtitle: { fontSize: 11.5, fontFamily: FONT_INTER.semibold, marginTop: 1 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ownerName: { fontSize: 11, flex: 1 },
});
