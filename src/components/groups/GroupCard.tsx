import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { Users, MapPin } from 'lucide-react-native';
import { firstGalleryUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';
import type { Group } from '../../types/api';
import { regionLabel } from '../../constants/regions';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import OilSheen, { WARM_SHEEN_FILL } from '../ui/OilSheen';
import SteeringWheel from '../ui/SteeringWheel';
import { colors as palette } from '../../constants/colors';
import {
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_MEMBER_BLUE,
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
 * The Pro-only group, by the name the server finds it by (proHomeController's
 * PRO_GROUP_TITLE) — groups carry no flag of their own. Its card wears the
 * Pro red under its picture, lettered black, with the wheel.
 */
const PRO_GROUP_TITLE = /^\s*pro drivers\s*$/i;
export const isProGroup = (group: Pick<Group, 'title'>) => PRO_GROUP_TITLE.test(group.title ?? '');

/** Your part in a group of your own — the badge GroupsView's My Groups shelf wears. */
const ROLE_BADGES = {
  admin:  { label: 'ADMIN',  bg: WARM_SHEEN_FILL,   fg: COLOR_BLACK },
  member: { label: 'MEMBER', bg: COLOR_MEMBER_BLUE, fg: COLOR_WHITE },
} as const;

/**
 * A group you're not in — or, given a `role`, one you are (the home screen's
 * Groups › My Groups list).
 *
 * Opens a summary rather than the group itself. Everything in this grid is
 * somewhere you haven't joined — the list is filtered to exclude your own — so
 * the question a card raises is "what is this and do I want in", not "take me
 * there". Pushing the whole group screen to answer it cost you the browse
 * position you'd scrolled to, and the panel carries a View Group button for
 * when the answer is yes.
 */
export default function GroupCard({ group, onPress, role, bannerRatio, pro, hideSubtitle = false }: {
  group: Group;
  onPress: (origin: SummaryOrigin | null) => void;
  /**
   * A group you're in: your part in it as a badge top left — the gold with
   * the oil-slick film for one you run, the member blue otherwise — and no
   * region, as on the My Groups shelf: you know where your own groups are.
   */
  role?: 'admin' | 'member';
  /** The picture's shape — wider and shallower for a card on a row of its own. Default 3:2. */
  bannerRatio?: number;
  /** Draw it as the Pro group — red bar, black lettering, the wheel. Found by name when not given. */
  pro?: boolean;
  /** Just the name under the picture. */
  hideSubtitle?: boolean;
}) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const region = role ? null : regionLabel(group.region);
  const badge = role ? ROLE_BADGES[role] : null;
  const bannerStyle = [styles.cardBanner, bannerRatio ? { aspectRatio: bannerRatio } : null];
  const isPro = pro ?? isProGroup(group);
  const ground = isPro ? palette.pro : COLOR_GRAY_40;
  return (
    // Built like a marketplace card: a bordered card, its picture rounded
    // all round, and the words on a lighter panel under it.
    <SummaryTouchable
      // One ground for the whole card — the words' panel colour, so it shows
      // the same around the picture's rounded corners as under it.
      style={[styles.card, { backgroundColor: ground, borderColor: isPro ? palette.pro : colors.border }, isPro && styles.cardPro]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={badge ? `${group.title ?? 'Group'}, ${badge.label.toLowerCase()}` : (group.title ?? 'Group')}
    >
      <View style={[styles.cardBannerWrap, isPro && styles.cardBannerWrapPro]}>
        {banner
          ? <Image source={{ uri: banner }} style={bannerStyle} contentFit="cover" />
          : <View style={[bannerStyle, { backgroundColor: colors.primaryAlt + '55' }]} />
        }
        {badge ? (
          <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
            {role === 'admin' ? <OilSheen tone="warm" radius={PILL_RADIUS} /> : null}
            <Text style={[styles.roleBadgeText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        ) : null}
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
      <View style={[styles.cardBody, isPro && styles.cardBodyPro, { backgroundColor: ground }]}>
        <View style={styles.titleRow}>
          {isPro ? <SteeringWheel size={15} color={COLOR_BLACK} strokeWidth={2.4} /> : null}
          <Text style={[styles.cardTitle, { color: isPro ? COLOR_BLACK : colors.fg }]} numberOfLines={1}>{group.title}</Text>
        </View>
        {group.subtitle && !hideSubtitle
          ? <Text style={[styles.cardSub, { color: isPro ? 'rgba(0,0,0,0.65)' : colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>
          : null}
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
  // Pro Drivers: a heavier frame in the Pro red.
  cardPro: { borderWidth: 3 },
  // Rounded all round, the card's radius — a tile set into the card.
  cardBannerWrap: { borderRadius: CARD_RADIUS, overflow: 'hidden' },
  // Inside Pro Drivers' thicker frame: a little less round, to sit in it.
  cardBannerWrapPro: { borderRadius: CARD_RADIUS - 3 },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  // The lighter panel the words sit on, filling to the card's foot.
  cardBody:   { flexGrow: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, backgroundColor: COLOR_GRAY_40 },
  // Pro Drivers: tighter under its title.
  cardBodyPro: { paddingBottom: 5 },
  titleRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle:  { flexShrink: 1, fontSize: 13, fontFamily: FONT_INTER.bold },
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
  // Top left — the My Groups shelf's badge.
  roleBadge: {
    position: 'absolute', top: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: PILL_RADIUS, overflow: 'hidden',
  },
  roleBadgeText: { fontSize: 9, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.5 },
});
