import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { Users, MapPin } from 'lucide-react-native';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import type { Group } from '../../types/api';
import { regionLabel } from '../../constants/regions';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import {
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_WHITE,
  COLOR_GRAY_40,
  COLOR_HUE_SEAFOAM,
  COLOR_HUE_CORNFLOWER,
  COLOR_HUE_CLAY,
  COLOR_HUE_ORCHID,
  COLOR_HUE_LAVENDER,
  COLOR_HUE_ROSE,
  COLOR_HUE_STEEL,
  COLOR_HUE_RASPBERRY,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A region's badge colour — steady per region, from the app's hue palette,
 * hashed from the key so a region added later still gets one.
 */
const REGION_HUES = [
  COLOR_HUE_SEAFOAM, COLOR_HUE_CORNFLOWER, COLOR_HUE_CLAY, COLOR_HUE_ORCHID,
  COLOR_HUE_LAVENDER, COLOR_HUE_ROSE, COLOR_HUE_STEEL, COLOR_HUE_RASPBERRY,
];

function regionColor(key?: string | null): string {
  if (!key) return COLOR_HUE_STEEL;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return REGION_HUES[h % REGION_HUES.length];
}

/**
 * A group you're not in.
 *
 * Opens a summary rather than the group itself. Everything in this grid is
 * somewhere you haven't joined — the list is filtered to exclude your own — so
 * the question a card raises is "what is this and do I want in", not "take me
 * there". Pushing the whole group screen to answer it cost you the browse
 * position you'd scrolled to, and the panel carries a View Group button for
 * when the answer is yes.
 */
export default function GroupCard({ group, onPress }: {
  group: Group;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const region = regionLabel(group.region);
  return (
    // Built like a marketplace card: a bordered card, its picture rounded
    // all round, and the words on a lighter panel under it.
    <SummaryTouchable
      // One ground for the whole card — the words' panel colour, so it shows
      // the same around the picture's rounded corners as under it.
      style={[styles.card, { backgroundColor: COLOR_GRAY_40, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={group.title ?? 'Group'}
    >
      <View style={styles.cardBannerWrap}>
        {banner
          ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
          : <View style={[styles.cardBanner, { backgroundColor: colors.primaryAlt + '55' }]} />
        }
        {/* Where it is, on the picture's bottom left — each region its own
            colour, as a listing's category is. */}
        {region ? (
          <View style={[styles.cardRegion, { backgroundColor: regionColor(group.region) }]}>
            <MapPin size={10} color={COLOR_BLACK} strokeWidth={2.4} />
            <Text style={styles.cardRegionText} numberOfLines={1}>{region}</Text>
          </View>
        ) : null}
        {/* How many are in it, bottom right — as on your own groups' cards. */}
        {typeof group.member_count === 'number' ? (
          <View style={styles.cardMembers}>
            <Users size={11} color={COLOR_WHITE} />
            <Text style={styles.cardMembersText}>{group.member_count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
      </View>
    </SummaryTouchable>
  );
}

/** A card's corners, and its picture's — a touch tighter than the app's radius at this size. */
export const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  // The marketplace card's frame.
  card: {
    flex: 1, borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden',
  },
  // Rounded all round, the card's radius — a tile set into the card.
  cardBannerWrap: { borderRadius: CARD_RADIUS, overflow: 'hidden' },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  // The lighter panel the words sit on, filling to the card's foot.
  cardBody:   { flexGrow: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, backgroundColor: COLOR_GRAY_40 },
  cardTitle:  { fontSize: 13, fontFamily: FONT_INTER.bold },
  cardSub:    { fontSize: 12, marginTop: 2 },
  // On the picture's bottom left, lifted off it like the marketplace's price.
  cardRegion: {
    position: 'absolute', left: 6, bottom: 6, maxWidth: '62%',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: PILL_RADIUS,
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  cardRegionText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_BLACK, flexShrink: 1 },
  // Bottom right, on a dark disc so it reads over any picture.
  cardMembers: {
    position: 'absolute', right: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardMembersText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
});
