import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Car, Check } from 'lucide-react-native';
import OilSheen, { WARM_SHEEN_FILL } from '../ui/OilSheen';
import SteeringWheel from '../ui/SteeringWheel';
import { useGetCarsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_17,
  COLOR_GRAY_34,
  COLOR_PRO,
  COLOR_WHITE,
} from '../../constants/config';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { FONT_INTER } from '../../constants/fonts'

/**
 * A member as a photo card: their picture, @handle and car count, the Pro
 * wheel when they have it. The featured row's card, and search's.
 */
export default function MemberCard({ member, onPress, featured = false, style }: {
  member: any;
  onPress: (origin: SummaryOrigin | null) => void;
  /** The gold "Featured" badge — the featured row's cards only. */
  featured?: boolean;
  /** The card's width (or a stretch) — it has none of its own. */
  style?: StyleProp<ViewStyle>;
}) {
  const { data: carsData } = useGetCarsQuery({ user_id: member.user_id, limit: 1 }, { skip: !member.user_id });
  const carCount = carsData?.total ?? 0;
  const photo = member.gallery?.[0]?.filename ? imageUrl(member.gallery[0].filename) : null;
  const isPro = member.accountType === 'pro' || member.accountType === 'admin';

  return (
    <SummaryTouchable style={[styles.card, style]} onPress={onPress} activeOpacity={0.88} accessibilityLabel={`@${member.username}`}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COLOR_GRAY_34 }]} />
      )}
      <View style={styles.overlay} />
      {/* Gold with the oil-slick film, as on the featured car cards. */}
      {featured && (
        <View style={styles.featuredBadge} pointerEvents="none">
          <OilSheen tone="warm" radius={999} />
          <Check size={9} color={COLOR_BLACK} strokeWidth={3} />
          <Text style={styles.featuredBadgeText}>Featured</Text>
        </View>
      )}
      {/* Near-black at the foot, fading to nothing well up the photo, so the
          name reads on any picture without a hard band across it. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.39)', 'rgba(0,0,0,0.63)']}
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

const styles = StyleSheet.create({
  card:       {
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
    backgroundColor: WARM_SHEEN_FILL, overflow: 'hidden',
  },
  featuredBadgeText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  proWheelBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLOR_PRO,
    alignItems: 'center', justifyContent: 'center',
  },
});
