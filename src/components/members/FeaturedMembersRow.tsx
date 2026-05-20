import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { useGetSiteSettingsQuery } from '../../api/apiService';
import { imageUrl } from '../../utils/image';
import { useColors } from '../../hooks/useColors';

const CARD_SIZE = 140;

interface Props {
  onMemberPress: (userId: string, username: string) => void;
}

export default function FeaturedMembersRow({ onMemberPress }: Props) {
  const colors = useColors();
  const { data } = useGetSiteSettingsQuery();
  const members = data?.featured_users ?? [];

  if (!members.length) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      <Text style={[styles.heading, { color: colors.fg }]}>Featured Members</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {members.map((member) => {
          const photo = member.gallery?.[0]?.filename ? imageUrl(member.gallery[0].filename) : null;
          return (
            <TouchableOpacity
              key={member.user_id}
              style={styles.card}
              onPress={() => onMemberPress(member.user_id, member.username)}
              activeOpacity={0.88}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
              ) : (
                <View style={[styles.photo, { backgroundColor: colors.border }]} />
              )}
              <View style={styles.gradient} />
              <View style={styles.info}>
                <Text style={styles.username} numberOfLines={1}>@{member.username}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { paddingTop: 14, paddingBottom: 4, borderBottomWidth: 1 },
  heading:    { fontSize: 13, fontWeight: '800', letterSpacing: 0.4, paddingHorizontal: 12, marginBottom: 10 },
  scroll:     { paddingHorizontal: 12, gap: 10, paddingBottom: 12 },
  card:       {
    width: CARD_SIZE, height: CARD_SIZE,
    borderRadius: 10, overflow: 'hidden',
    position: 'relative',
  },
  photo:      { ...StyleSheet.absoluteFillObject },
  gradient:   {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  info:       {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 7,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  username:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  name:       { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
});
