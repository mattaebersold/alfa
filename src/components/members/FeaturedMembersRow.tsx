import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';
import SteeringWheel from '../ui/SteeringWheel';
import RegionBadge from '../ui/RegionBadge';
import { shuffle } from '../../utils/array';
import { regionForCityState } from '../../constants/regions';
import { useGetSiteSettingsQuery, useGetCarsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import RowEndSpacer from '../ui/RowEndSpacer';
import { COMMON_RADIUS } from '../../constants/radius';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.40;
const CARD_GAP = 10;
const ROW_PAD = 14; // matches the section heading's inset

interface Props {
  onMemberPress: (userId: string, username: string) => void;
}

function MemberCard({ member, onPress }: { member: any; onPress: () => void }) {
  const { data: carsData } = useGetCarsQuery({ user_id: member.user_id, limit: 1 }, { skip: !member.user_id });
  const carCount = carsData?.total ?? 0;
  const photo = member.gallery?.[0]?.filename ? imageUrl(member.gallery[0].filename) : null;
  const isPro = member.accountType === 'pro' || member.accountType === 'admin';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#222' }]} />
      )}
      <View style={styles.overlay} />
      {/* Where in the country they are — the same map the member rows and
          summary panels use. Top right, clear of the pro wheel and the name
          along the bottom. */}
      <View style={styles.regionBadge}>
        <RegionBadge region={regionForCityState(member.cityState)?.key} size={32} />
      </View>
      <View style={styles.info}>
        {/* The one pro marker on the card: a thick gold frame around the photo
            read as a selection state and fought with the map badge. */}
        {isPro && (
          <View style={styles.proWheelBadge}>
            <SteeringWheel size={12} color="#000000" strokeWidth={2.5} />
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
    </TouchableOpacity>
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
      <Text style={styles.heading}>Featured Members</Text>
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
            onPress={() => onMemberPress(member.user_id, member.username)}
          />
        ))}
        <RowEndSpacer width={ROW_PAD} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { backgroundColor: '#000', paddingTop: 14, paddingBottom: 14 },
  heading:    { fontSize: 16, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 14, marginBottom: 10, color: '#FFFFFF' },
  scroll:     { gap: CARD_GAP, paddingLeft: ROW_PAD },
  card:       {
    width: CARD_WIDTH,
    aspectRatio: 1,
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  overlay:    {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  regionBadge: { position: 'absolute', top: 8, right: 8 },
  info:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  username:   { flex: 1, fontSize: 12, fontWeight: '700', color: '#fff' },
  carRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  carCount:   { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  proWheelBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#CDA96F',
    alignItems: 'center', justifyContent: 'center',
  },
});
