import React, { useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useGetRallysQuery } from '../../api/apiService';
import RallyDetailSheet from '../../components/society/RallyDetailSheet';
import EventImage from '../../components/society/EventImage';
import { useNaturalRatio } from '../../hooks/useNaturalRatio';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Rally } from '../../types/api';
import { ss } from '../../styles/shared';
import { calendarDate, calendarTime } from '../../utils/calendarDate';
import { RALLY_DATE_TBA } from '../../utils/rally';
import { COMMON_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** A past rally in the scroller — wide enough to read, narrow enough that the
 *  next one peeks in and announces the row is scrollable. */
const PAST_CARD_WIDTH = Math.min(220, SCREEN_WIDTH * 0.58);
/** Past rallys are a reference shelf, not a browsable list — one page is plenty. */
const PAST_LIMIT = 20;

const rallyHero = (rally: Rally) =>
  (rally.hero_image ? imageUrl(rally.hero_image) : null) ?? firstGalleryUrl(rally.gallery);

/**
 * The full card for an upcoming rally: hero, pill, date, title, and a way in.
 *
 * The card takes the photo's own shape rather than cropping it to 16/9. These
 * are the club's own posters and route maps as often as they are photographs,
 * and a fixed frame cut the tops off them. The bounds are the event cards' —
 * see `clampCardRatio` — so a rally and an event photo are the same shape.
 */
function UpcomingRallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const hero = rallyHero(rally);
  // 16/9 until the photo reports its shape, and for rallies without one.
  const { ratio, onAspectRatio } = useNaturalRatio(16 / 9);
  const eventDay = calendarDate(rally.event_date);
  // Never null: an unscheduled rally says so rather than losing the line.
  const date = eventDay ? format(eventDay, 'EEE, MMM d, yyyy') : RALLY_DATE_TBA;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.cardImage, { aspectRatio: ratio }]}>
        <EventImage uri={hero} style={StyleSheet.absoluteFill} onAspectRatio={onAspectRatio} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.date}>{date}</Text>
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
        {rally.location && <Text style={[styles.location, { color: colors.grey }]} numberOfLines={1}>{rally.location}</Text>}
        {rally.slots_available != null && (
          <Text style={styles.slots}>{rally.slots_available} slots available</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** The compact card for a past rally — an archive entry, so image and title only. */
function PastRallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const hero = rallyHero(rally);
  const eventDay = calendarDate(rally.event_date);
  const date = eventDay ? format(eventDay, 'MMM yyyy') : null;

  return (
    <TouchableOpacity style={[styles.pastCard, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.85}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.pastImage} contentFit="cover" />
        : <View style={[styles.pastImage, styles.cardPlaceholder]} />
      }
      <View style={styles.pastBody}>
        {date && <Text style={[styles.pastDate, { color: colors.grey }]}>{date}</Text>}
        <Text style={[styles.pastTitle, { color: colors.fg }]} numberOfLines={2}>{rally.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RallysScreen() {
  const colors = useColors();
  const headerPad = useHeaderPad();
  const [page, setPage] = useState(0);
  const [upcoming, setUpcoming] = useState<Rally[]>([]);
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);

  // Split at the source rather than in memory: the two halves are shown in
  // completely different shapes, and only the upcoming half is worth paging.
  const { data, isFetching, isLoading, refetch } = useGetRallysQuery({
    page, limit: 12, time_filter: 'upcoming',
  });
  const { data: pastData } = useGetRallysQuery({ page: 0, limit: PAST_LIMIT, time_filter: 'past' });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setUpcoming(data.entries);
      else setUpcoming((prev) => {
        const ids = new Set(prev.map((r) => r.internal_id));
        return [...prev, ...data.entries.filter((r) => !ids.has(r.internal_id))];
      });
    }
  }, [data, page]);

  // Soonest first — the opposite of the archive below, where the most recent
  // event is the one you're most likely looking for.
  const sortedUpcoming = useMemo(
    () => [...upcoming].sort((a, b) => {
      const da = calendarTime(a.event_date, Infinity);
      const db = calendarTime(b.event_date, Infinity);
      return da - db;
    }),
    [upcoming],
  );

  const sortedPast = useMemo(
    () => [...(pastData?.entries ?? [])].sort((a, b) => {
      const da = calendarTime(a.event_date);
      const db = calendarTime(b.event_date);
      return db - da;
    }),
    [pastData],
  );

  const handleRefresh = useCallback(() => { setPage(0); setUpcoming([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && upcoming.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, upcoming.length]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* The app header floats over the content, so the heading below starts
          clear of it via useHeaderPad() — the same arrangement as Routes. */}
      <AppHeader />
      <View style={[styles.header, { paddingTop: headerPad }]}>
        <ScreenHeading title="Rallys" inline />
      </View>
      {isLoading ? <Spinner fullScreen /> : (
      <FlatList
        data={sortedUpcoming}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <UpcomingRallyCard rally={item} onPress={() => setSelectedRallyId(item.internal_id)} />
        )}
        ListHeaderComponent={
          sortedUpcoming.length > 0
            ? <Text style={[styles.sectionHeading, { color: colors.fg }]}>Upcoming</Text>
            : null
        }
        ListEmptyComponent={
          sortedPast.length === 0 ? <EmptyState title="No rallys yet" /> : null
        }
        ListFooterComponent={
          sortedPast.length > 0 ? (
            <View style={styles.pastSection}>
              <Text style={[styles.sectionHeading, { color: colors.fg }]}>Past Rallys</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pastScroll}
                snapToInterval={PAST_CARD_WIDTH + 10}
                decelerationRate="fast"
              >
                {sortedPast.map((rally) => (
                  <PastRallyCard
                    key={rally.internal_id}
                    rally={rally}
                    onPress={() => setSelectedRallyId(rally.internal_id)}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null
        }
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
      )}
      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:       { paddingHorizontal: 12, paddingBottom: 2 },
  list:         { paddingBottom: 24 },
  sectionHeading: {
    fontSize: 17, fontFamily: FONT_INTER.bold,
    paddingHorizontal: 12, paddingTop: 18, paddingBottom: 2,
  },

  card:         {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardPlaceholder: { backgroundColor: colors.primaryAlt },
  // Rounded at the foot too, so the photo sits in the card rather than capping it.
  cardImage:    { borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden' },
  cardBody:     { padding: 12 },
  date:         { fontSize: 12, fontFamily: FONT_INTER.bold, color: colors.primaryAlt, marginBottom: 4 },
  title:        { fontSize: 16, fontFamily: FONT_INTER.bold, lineHeight: 22 },
  location:     { fontSize: 13, marginTop: 4 },
  slots:        { fontSize: 12, color: colors.primaryAlt, fontFamily: FONT_INTER.bold, marginTop: 6 },

  pastSection:  { marginTop: 6 },
  pastScroll:   { paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  pastCard:     { width: PAST_CARD_WIDTH, borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  pastImage:    { width: '100%', aspectRatio: 16 / 9, borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS },
  pastBody:     { padding: 10 },
  pastDate:     { fontSize: 11, fontFamily: FONT_INTER.bold },
  pastTitle:    { fontSize: 13, fontFamily: FONT_INTER.bold, lineHeight: 17, marginTop: 3 },
});
