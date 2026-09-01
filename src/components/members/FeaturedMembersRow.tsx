import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';
import SteeringWheel from '../ui/SteeringWheel';
import { useGetSiteSettingsQuery, useGetCarsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import RowEndSpacer from '../ui/RowEndSpacer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.40;
const CARD_GAP = 10;
const ROW_PAD = 14; // matches the section heading's inset

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
      {isPro && <View style={styles.proBorder} pointerEvents="none" />}
      <View style={styles.info}>
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
  const raw = data?.featured_users ?? [];
  const members = useMemo(() => shuffle(raw), [raw.length]);

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
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  overlay:    {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  info:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  username:   { flex: 1, fontSize: 12, fontWeight: '700', color: '#fff' },
  carRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  carCount:   { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  proBorder:  {
    ...StyleSheet.absoluteFill,
    borderWidth: 5, borderColor: '#CDA96F', borderRadius: 14,
  },
  proWheelBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#CDA96F',
    alignItems: 'center', justifyContent: 'center',
  },
});
