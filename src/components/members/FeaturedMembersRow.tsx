import React, { useMemo } from 'react';
import {
  View, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, Check } from 'lucide-react-native';
import OilSheen from '../ui/OilSheen';
import SteeringWheel from '../ui/SteeringWheel';
import { shuffle } from '../../utils/array';
import { useGetSiteSettingsQuery, useGetCarsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import RowEndSpacer from '../ui/RowEndSpacer';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_17,
  COLOR_GRAY_34,
  COLOR_PRO,
  COLOR_WHITE,
  GUTTER,
} from '../../constants/config';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { FONT_INTER } from '../../constants/fonts'

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.6;
const CARD_GAP = 10;
/** The row's inset — the app's gutter, as the heading and tools above and below it. */
const ROW_PAD = GUTTER;

interface Props {
  /** `origin` is the card's rect, so a summary can grow out of it. */
  onMemberPress: (userId: string, username: string, origin: SummaryOrigin | null) => void;
}

function MemberCard({ member, onPress }: { member: any; onPress: (origin: SummaryOrigin | null) => void }) {
  const { data: carsData } = useGetCarsQuery({ user_id: member.user_id, limit: 1 }, { skip: !member.user_id });
  const carCount = carsData?.total ?? 0;
  const photo = member.gallery?.[0]?.filename ? imageUrl(member.gallery[0].filename) : null;
  const isPro = member.accountType === 'pro' || member.accountType === 'admin';

  return (
    <SummaryTouchable style={styles.card} onPress={onPress} activeOpacity={0.88} accessibilityLabel={`@${member.username}`}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLOR_GRAY_34 }]} />
      )}
      <View style={styles.overlay} />
      {/* Gold with the oil-slick film, as on the featured car cards. */}
      <View style={styles.featuredBadge} pointerEvents="none">
        <OilSheen tone="warm" radius={999} />
        <Check size={9} color={COLOR_BLACK} strokeWidth={3} />
        <Text style={styles.featuredBadgeText}>Featured</Text>
      </View>
      {/* Near-black at the foot, fading to nothing well up the photo, so the
          name reads on any picture without a hard band across it. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.5, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />
      <View style={styles.info}>
        {/* The one pro marker on the card: a thick gold frame around the photo
            read as a selection state. */}
        {isPro && (
          <View style={styles.proWheelBadge}>
            <SteeringWheel size={12} color={COLOR_BLACK} strokeWidth={2.5} />
          </View>
        )}
        <Text style={styles.username} numberOfLines={1}>@{member.username}</Text>
        {carCount > 0 && (
          <View style={styles.carRow}>
            <Car size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.carCount}>{carCount}</Text>
          </View>
        )}
      </View>
    </SummaryTouchable>
  );
}

export default function FeaturedMembersRow({ onMemberPress }: Props) {
  const { data } = useGetSiteSettingsQuery();
  // Shuffled per mount, for the same reason as the featured cars row — see
  // FeaturedCarsRow. Memoised on the data so it holds still while you scroll.
  const featured = data?.featured_users;
  const members = useMemo(() => shuffle(featured ?? []), [featured]);

  if (!members.length) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        pagingEnabled={false}
      >
        {members.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            onPress={(origin) => onMemberPress(member.user_id, member.username, origin)}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: on the page's own ground, not a black band across it.
  container:  { paddingTop: 2, paddingBottom: 4 },
  scroll:     { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:       {
    width: CARD_WIDTH,
    // A little wider than tall — the car grid's landscape shape.
    aspectRatio: 3 / 2.5,
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
    backgroundColor: COLOR_GRAY_17,
  },
  overlay:    {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  info:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: 10,
  },
  // A point past the foot, so no hairline of photo shows under it.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: -1, height: '60%' },
  username:   { flex: 1, fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  carRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  carCount:   { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontFamily: FONT_INTER.bold },
  featuredBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
    backgroundColor: COLOR_PRO, overflow: 'hidden',
  },
  featuredBadgeText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  proWheelBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLOR_PRO,
    alignItems: 'center', justifyContent: 'center',
  },
});
