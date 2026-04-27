import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar as CalendarIcon, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useGetEventsQuery } from '../../api/apiService';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Event } from '../../types/api';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_WIDTH = SCREEN_WIDTH - 48;

function FeaturedCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const hero = firstGalleryUrl(event.gallery);
  const date = event.event_date ? format(new Date(event.event_date), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity style={styles.featuredCard} onPress={onPress} activeOpacity={0.88}>
      {hero ? (
        <Image source={{ uri: hero }} style={styles.featuredImage} contentFit="cover" />
      ) : (
        <View style={[styles.featuredImage, { backgroundColor: Colors.brg }]} />
      )}
      <View style={styles.featuredOverlay}>
        {date && <Text style={styles.featuredDate}>{date}</Text>}
        <Text style={styles.featuredTitle} numberOfLines={2}>{event.title}</Text>
        {event.location && (
          <Text style={styles.featuredLocation} numberOfLines={1}>{event.location}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EventRow({ event, onPress }: { event: Event; onPress: () => void }) {
  const colors = useColors();
  const date = event.event_date ? format(new Date(event.event_date), 'MMM d') : null;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowDateBadge}>
        {date ? (
          <>
            <Text style={styles.rowDateDay}>{date.split(' ')[1]}</Text>
            <Text style={[styles.rowDateMon, { color: colors.grey }]}>{date.split(' ')[0]}</Text>
          </>
        ) : (
          <Text style={[styles.rowDateDay, { color: colors.grey }]}>—</Text>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{event.title}</Text>
        {event.location && (
          <Text style={[styles.rowLocation, { color: colors.grey }]} numberOfLines={1}>{event.location}</Text>
        )}
      </View>
      <ChevronRight size={16} color={colors.grey} />
    </TouchableOpacity>
  );
}

export default function SocietyScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();

  const { data: eventsData, isLoading } = useGetEventsQuery({ limit: 50 });
  const allEvents = eventsData?.entries ?? [];

  const featured = useMemo(() => allEvents.filter((e) => e.featured), [allEvents]);
  const upcoming = useMemo(() => allEvents.filter((e) => !e.featured), [allEvents]);

  const listHeader = (
    <View>
      {/* Featured slider */}
      {featured.length > 0 && (
        <View style={styles.featuredSection}>
          <Text style={[styles.sectionLabel, { color: colors.grey }]}>FEATURED EVENTS</Text>
          <FlatList
            data={featured}
            keyExtractor={(e) => e.internal_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            snapToInterval={FEATURED_WIDTH + 12}
            decelerationRate="fast"
            renderItem={({ item }) => (
              <FeaturedCard
                event={item}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.internal_id })}
              />
            )}
          />
        </View>
      )}

      {/* Calendar quick link */}
      <TouchableOpacity
        style={[styles.calendarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Calendar')}
        activeOpacity={0.8}
      >
        <CalendarIcon size={18} color={Colors.brg} />
        <Text style={[styles.calendarBtnText, { color: colors.fg }]}>View Calendar</Text>
        <ChevronRight size={16} color={colors.grey} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* Section header */}
      {upcoming.length > 0 && (
        <View style={[styles.upcomingHeader, { backgroundColor: colors.segment, borderColor: colors.border }]}>
          <Text style={[styles.upcomingLabel, { color: colors.grey }]}>UPCOMING EVENTS</Text>
        </View>
      )}
    </View>
  );

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={[]}>
      <FlatList
        data={upcoming}
        keyExtractor={(e) => e.internal_id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            onPress={() => navigation.navigate('EventDetail', { eventId: item.internal_id })}
          />
        )}
        ListEmptyComponent={
          featured.length === 0 ? <EmptyState title="No events" /> : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1 },
  list:             { paddingBottom: 24 },

  // Featured
  featuredSection:  { paddingTop: 16 },
  sectionLabel:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 10 },
  featuredList:     { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  featuredCard:     {
    width: FEATURED_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
    height: 200,
  },
  featuredImage:    { width: '100%', height: '100%', position: 'absolute' },
  featuredOverlay:  {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  featuredDate:     { fontSize: 11, fontWeight: '700', color: Colors.speed, marginBottom: 4 },
  featuredTitle:    { fontSize: 17, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 },
  featuredLocation: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  // Calendar link
  calendarBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, padding: 14, borderRadius: 12, borderWidth: 1,
  },
  calendarBtnText:  { fontSize: 15, fontWeight: '600' },

  // Upcoming header
  upcomingHeader:   {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  upcomingLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  // Row
  row:              {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rowDateBadge:     { width: 36, alignItems: 'center' },
  rowDateDay:       { fontSize: 20, fontWeight: '800', color: Colors.brg },
  rowDateMon:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  rowInfo:          { flex: 1 },
  rowTitle:         { fontSize: 15, fontWeight: '600' },
  rowLocation:      { fontSize: 13, marginTop: 2 },
});
