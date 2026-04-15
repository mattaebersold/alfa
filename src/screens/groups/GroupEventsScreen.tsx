import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetEventsQuery } from '../../api/apiService';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl } from '../../utils/image';
import type { GroupsScreenProps, AppStackParamList } from '../../navigation/types';
import type { Event } from '../../types/api';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

function EventRow({ event, onPress }: { event: Event; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(event.gallery);
  const date = event.event_date ? format(new Date(event.event_date), 'MMM d') : null;
  return (
    <TouchableOpacity style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.thumb} contentFit="cover" />
        : <View style={[styles.thumb, styles.thumbPlaceholder]} />
      }
      <View style={styles.info}>
        {date && <Text style={styles.date}>{date}</Text>}
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{event.title}</Text>
        {event.location && <Text style={[styles.location, { color: colors.grey }]} numberOfLines={1}>{event.location}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupEventsScreen({ route }: GroupsScreenProps<'GroupEvents'>) {
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const colors = useColors();
  const { data, isLoading } = useGetEventsQuery({ group_id: groupId, limit: 20 });
  const events = data?.entries ?? [];

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.internal_id}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            onPress={() => navigation.navigate('EventDetailModal', { eventId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No events for this group" />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  list:             { flexGrow: 1, paddingBottom: 24 },
  row:              {
    flexDirection: 'row', gap: 12, alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  thumb:            { width: 72, height: 54, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: Colors.brg },
  info:             { flex: 1 },
  date:             { fontSize: 11, fontWeight: '700', color: Colors.speed, marginBottom: 2 },
  title:            { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  location:         { fontSize: 12, marginTop: 2 },
});
