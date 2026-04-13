import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Zap, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import {
  useGetEventsQuery,
  useGetRallysQuery,
} from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Event, Rally } from '../../types/api';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;
type Tab = 'events' | 'rallys';

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const hero = firstGalleryUrl(event.gallery);
  const date = event.event_date ? format(new Date(event.event_date), 'MMM d, yyyy') : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
        : <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
      }
      <View style={styles.cardBody}>
        {date && <Text style={styles.cardDate}>{date}</Text>}
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        {event.location && (
          <Text style={styles.cardMeta} numberOfLines={1}>{event.location}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function RallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
  const date = rally.event_date ? format(new Date(rally.event_date), 'MMM d, yyyy') : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
        : <View style={[styles.cardImage, styles.cardImagePlaceholder]} />
      }
      <View style={styles.cardBody}>
        {date && <Text style={styles.cardDate}>{date}</Text>}
        <Text style={styles.cardTitle} numberOfLines={2}>{rally.title}</Text>
        {rally.location && (
          <Text style={styles.cardMeta} numberOfLines={1}>{rally.location}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function SocietyScreen() {
  const navigation = useNavigation<NavProp>();
  const [tab, setTab] = useState<Tab>('events');

  const {
    data: eventsData, isLoading: eventsLoading, refetch: refetchEvents,
  } = useGetEventsQuery({ limit: 20 }, { skip: tab !== 'events' });

  const {
    data: rallysData, isLoading: rallysLoading, refetch: refetchRallys,
  } = useGetRallysQuery({ limit: 20 }, { skip: tab !== 'rallys' });

  const events = eventsData?.entries ?? [];
  const rallys = rallysData?.entries ?? [];
  const isLoading = tab === 'events' ? eventsLoading : rallysLoading;
  const refetch = tab === 'events' ? refetchEvents : refetchRallys;

  const header = (
    <View>
      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Calendar')}
        >
          <Calendar size={18} color={Colors.brg} />
          <Text style={styles.quickBtnText}>Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Members')}
        >
          <Users size={18} color={Colors.brg} />
          <Text style={styles.quickBtnText}>Members</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => navigation.navigate('Rallys')}
        >
          <Zap size={18} color={Colors.brg} />
          <Text style={styles.quickBtnText}>Rallys</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['events', 'rallys'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (isLoading) return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {header}
      <Spinner fullScreen />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {tab === 'events' ? (
        <FlatList
          data={events}
          keyExtractor={(item) => item.internal_id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.internal_id })}
            />
          )}
          ListEmptyComponent={<EmptyState title="No events" />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.brg} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={rallys}
          keyExtractor={(item) => item.internal_id}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <RallyCard
              rally={item}
              onPress={() => navigation.navigate('RallyDetail', { rallyId: item.internal_id })}
            />
          )}
          ListEmptyComponent={<EmptyState title="No rallys" />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor={Colors.brg} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.cream },
  list:       { paddingBottom: 24 },
  quickActions: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  quickBtn:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.cream,
  },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: Colors.brg },
  tabBar:     {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabItem:    { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.brg },
  tabText:    { fontSize: 14, fontWeight: '600', color: Colors.grey },
  tabTextActive: { color: Colors.brg },
  card:       {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImage:          { width: '100%', aspectRatio: 16 / 9 },
  cardImagePlaceholder: { backgroundColor: Colors.brg },
  cardBody:   { padding: 12 },
  cardDate:   { fontSize: 12, fontWeight: '700', color: Colors.speed, marginBottom: 4 },
  cardTitle:  { fontSize: 16, fontWeight: '800', color: Colors.fg, lineHeight: 22 },
  cardMeta:   { fontSize: 13, color: Colors.grey, marginTop: 4 },
});
