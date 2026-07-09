import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Calendar as CalendarIcon, ChevronRight, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { useGetEventsQuery, useGetRallysQuery } from '../../api/apiService';
import AppHeader from '../../components/ui/AppHeader';
import EventDetailSheet from '../../components/society/EventDetailSheet';
import RallyDetailSheet from '../../components/society/RallyDetailSheet';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Event, Rally } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURED_WIDTH = Math.round(SCREEN_WIDTH * (2 / 3));
const RALLY_WIDTH = Math.round(SCREEN_WIDTH * 0.8);

// Guard against duplicate ids from the API (would cause duplicate-key warnings).
function dedupeById<T extends { internal_id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => it.internal_id && !seen.has(it.internal_id) && seen.add(it.internal_id));
}

function FeaturedCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const [ratio, setRatio] = useState(16 / 9);
  const hero = firstGalleryUrl(event.gallery);
  const date = event.event_date ? format(new Date(event.event_date), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity style={styles.featuredCard} onPress={onPress} activeOpacity={0.88}>
      {hero ? (
        <Image
          source={{ uri: hero }}
          style={[styles.featuredImage, { aspectRatio: ratio }]}
          contentFit="cover"
          onLoad={(e) => setRatio(e.source.width / e.source.height)}
        />
      ) : (
        <View style={[styles.featuredImage, { aspectRatio: ratio, backgroundColor: colors.primaryAlt }]} />
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

function RallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const [ratio, setRatio] = useState(16 / 9);
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
  const date = rally.event_date ? format(new Date(rally.event_date), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity style={[styles.rallyCard, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.88}>
      {hero ? (
        <Image
          source={{ uri: hero }}
          style={[styles.rallyImage, { aspectRatio: ratio }]}
          contentFit="cover"
          onLoad={(e) => e.source && setRatio(e.source.width / e.source.height)}
        />
      ) : (
        <View style={[styles.rallyImage, { aspectRatio: ratio, backgroundColor: colors.primaryAlt }]} />
      )}
      <View style={styles.rallyBody}>
        {date && <Text style={styles.rallyDate}>{date}</Text>}
        <Text style={[styles.rallyTitle, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        {rally.location && <Text style={[styles.rallyLocation, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SocietyScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);

  const { data: eventsData, isLoading } = useGetEventsQuery({ limit: 50 });
  const allEvents = useMemo(() => dedupeById(eventsData?.entries ?? []), [eventsData]);
  const { data: rallysData } = useGetRallysQuery({ limit: 20 });
  const rallys = useMemo(() => dedupeById(rallysData?.entries ?? []), [rallysData]);

  const featured = useMemo(() => allEvents.filter((e) => e.featured), [allEvents]);
  // Upcoming = non-featured events dated today or later, soonest first (past events hidden).
  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allEvents
      .filter((e) => !e.featured && e.event_date && new Date(e.event_date) >= today)
      .sort((a, b) => new Date(a.event_date!).getTime() - new Date(b.event_date!).getTime());
  }, [allEvents]);

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
                onPress={() => setSelectedEventId(item.internal_id)}
              />
            )}
          />
        </View>
      )}

      {/* ORS Rallys — horizontal scroller */}
      {rallys.length > 0 && (
        <View style={styles.rallySection}>
          <Text style={[styles.sectionLabel, { color: colors.grey }]}>ORS RALLYS</Text>
          <FlatList
            data={rallys}
            keyExtractor={(r) => r.internal_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredList}
            snapToInterval={RALLY_WIDTH + 12}
            decelerationRate="fast"
            renderItem={({ item }) => (
              <RallyCard
                rally={item}
                onPress={() => setSelectedRallyId(item.internal_id)}
              />
            )}
          />
        </View>
      )}

      {/* Calendar quick link + Create Event */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.calendarBtn, { backgroundColor: colors.card, borderColor: colors.border, flex: 1 }]}
          onPress={() => navigation.navigate('Calendar')}
          activeOpacity={0.8}
        >
          <CalendarIcon size={18} color={colors.primaryAlt} />
          <Text style={[styles.calendarBtnText, { color: colors.fg }]}>View Calendar</Text>
          <ChevronRight size={16} color={colors.grey} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createEventBtn}
          onPress={() => (navigation as any).navigate('EventCreate')}
          activeOpacity={0.8}
        >
          <Plus size={15} color="#FFFFFF" />
          <Text style={styles.createEventBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

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
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        data={upcoming}
        keyExtractor={(e) => e.internal_id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            onPress={() => setSelectedEventId(item.internal_id)}
          />
        )}
        ListEmptyComponent={
          featured.length === 0 ? <EmptyState title="No events" /> : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight }]}
      />
      </View>

      <EventDetailSheet eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:          { flex: 1 },
  list:             { paddingBottom: 24 },

  // Featured
  featuredSection:  { paddingTop: 16 },
  sectionLabel:     { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 10 },
  featuredList:     { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  featuredCard:     {
    width: FEATURED_WIDTH,
    borderRadius: 14,
    overflow: 'hidden',
  },
  featuredImage:    { width: '100%' },
  featuredOverlay:  {
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  featuredDate:     { fontSize: 11, fontWeight: '700', color: colors.primaryAlt, marginBottom: 4 },
  featuredTitle:    { fontSize: 17, fontWeight: '800', color: '#FFFFFF', lineHeight: 22 },
  featuredLocation: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },

  // ORS Rallys
  rallySection:     { paddingTop: 16 },
  rallyCard:        { width: RALLY_WIDTH, borderRadius: 14, overflow: 'hidden' },
  rallyImage:       { width: '100%' },
  rallyBody:        { padding: 12 },
  rallyDate:        { fontSize: 11, fontWeight: '700', color: colors.primaryAlt, marginBottom: 3 },
  rallyTitle:       { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  rallyLocation:    { fontSize: 12, marginTop: 2 },

  // Calendar / create row
  quickActions:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginVertical: 12 },
  calendarBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  calendarBtnText:  { fontSize: 15, fontWeight: '600' },
  createEventBtn:   {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primaryAlt, paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 12,
  },
  createEventBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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
  rowDateDay:       { fontSize: 20, fontWeight: '800', color: colors.primaryAlt },
  rowDateMon:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  rowInfo:          { flex: 1 },
  rowTitle:         { fontSize: 15, fontWeight: '600' },
  rowLocation:      { fontSize: 13, marginTop: 2 },
});
