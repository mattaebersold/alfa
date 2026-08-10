import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import Avatar from '../ui/Avatar';
import EventCard from '../cards/EventCard';
import { useEventSheet } from '../../providers/EventSheetProvider';
import type { SocietyEvent } from '../../types/api';

/**
 * Feed row for an event someone you follow just added. The attribution line
 * carries the context; the card below is the same one used everywhere else.
 */
export default function NewEventCard({ event }: { event: SocietyEvent }) {
  const colors = useColors();
  const nav = useNavigation();
  const { openEventSheet } = useEventSheet();
  const { data: owner } = useGetUserByIdQuery(event.user_id, { skip: !event.user_id });

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.attribution}
        onPress={() => owner && (nav as any).navigate('UserDetail', { userId: owner.user_id, username: owner.username })}
        activeOpacity={0.7}
        disabled={!owner}
      >
        <Avatar filename={owner?.gallery?.[0]?.filename} name={owner?.username ?? '?'} size={30} />
        <Text style={[styles.line, { color: colors.fg }]} numberOfLines={2}>
          <Text style={styles.name}>@{owner?.username ?? 'Someone'}</Text>
          <Text style={{ color: colors.muted }}> added a new event</Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <EventCard
          event={event}
          onPress={() => openEventSheet({ eventId: event.internal_id })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { marginBottom: 6 },
  attribution: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  line:        { flex: 1, fontSize: 13.5, lineHeight: 18 },
  name:        { fontWeight: '800' },
  card:        { marginHorizontal: 12 },
});
