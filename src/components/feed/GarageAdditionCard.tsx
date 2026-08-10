import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import CarCard from '../cards/CarCard';
import type { GarageCar } from '../../types/api';

/**
 * Feed row for a car someone you follow added to their garage. The attribution
 * line carries the context ("@user added X to their garage"); the card below is
 * the same CarCard used everywhere else, so it behaves identically on tap.
 */
export default function GarageAdditionCard({ car }: { car: GarageCar }) {
  const colors = useColors();
  const nav = useNavigation();
  const { data: owner } = useGetUserByIdQuery(car.user_id, { skip: !car.user_id });

  const carName = car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'a car';
  const timeAgo = car.created_at
    ? formatDistanceToNow(new Date(car.created_at), { addSuffix: true })
    : '';

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.attribution}
        onPress={() => owner && (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
        activeOpacity={0.7}
        disabled={!owner}
      >
        <Avatar filename={owner?.gallery?.[0]?.filename} name={owner?.username ?? '?'} size={30} />
        <View style={styles.attributionText}>
          <Text style={[styles.line, { color: colors.fg }]} numberOfLines={2}>
            <Text style={styles.name}>@{owner?.username ?? 'Someone'}</Text>
            <Text style={{ color: colors.muted }}> added </Text>
            <Text style={styles.name}>{carName}</Text>
            <Text style={{ color: colors.muted }}> to their garage</Text>
          </Text>
          {timeAgo ? <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text> : null}
        </View>
      </TouchableOpacity>

      <CarCard car={car} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { marginBottom: 6 },
  attribution: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2,
  },
  attributionText: { flex: 1 },
  line: { fontSize: 13.5, lineHeight: 18 },
  name: { fontWeight: '800' },
  time: { fontSize: 11, marginTop: 2 },
});
