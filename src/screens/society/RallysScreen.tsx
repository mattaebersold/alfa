import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useGetRallysQuery } from '../../api/apiService';
import RallyDetailSheet from '../../components/society/RallyDetailSheet';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Rally } from '../../types/api';
import { ss } from '../../styles/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** A past rally in the scroller — wide enough to read, narrow enough that the
 *  next one peeks in and announces the row is scrollable. */
const PAST_CARD_WIDTH = Math.min(220, SCREEN_WIDTH * 0.58);
/** Past rallys are a reference shelf, not a browsable list — one page is plenty. */
const PAST_LIMIT = 20;

const rallyHero = (rally: Rally) =>
  (rally.hero_image ? imageUrl(rally.hero_image) : null) ?? firstGalleryUrl(rally.gallery);

/** The full card for an upcoming rally: hero, date, title, and a way in. */
function UpcomingRallyCard({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const hero = rallyHero(rally);
  const date = rally.event_date ? format(new Date(rally.event_date), 'MMM d, yyyy') : null;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
        : <View style={[styles.cardImage, styles.cardPlaceholder]} />
      }
      <View style={styles.cardBody}>
        {date && <Text style={styles.date}>{date}</Text>}
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
  const date = rally.event_date ? format(new Date(rally.event_date), 'MMM yyyy') : null;

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
      const da = a.event_date ? new Date(a.event_date).getTime() : Infinity;
      const db = b.event_date ? new Date(b.event_date).getTime() : Infinity;
      return da - db;
    }),
    [upcoming],
  );

  const sortedPast = useMemo(
    () => [...(pastData?.entries ?? [])].sort((a, b) => {
      const da = a.event_date ? new Date(a.event_date).getTime() : 0;
      const db = b.event_date ? new Date(b.event_date).getTime() : 0;
      return db - da;
    }),
    [pastData],
  );

  const handleRefresh = useCallback(() => { setPage(0); setUpcoming([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && upcoming.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, upcoming.length]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
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
      <RallyDetailSheet rallyId={selectedRallyId} onClose={() => setSelectedRallyId(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:         { paddingBottom: 24 },
  sectionHeading: {
    fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 12, paddingTop: 18, paddingBottom: 2,
  },

  card:         {
    marginHorizontal: 12, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImage:    { width: '100%', aspectRatio: 16 / 9 },
  cardPlaceholder: { backgroundColor: colors.primaryAlt },
  cardBody:     { padding: 12 },
  date:         { fontSize: 12, fontWeight: '700', color: colors.primaryAlt, marginBottom: 4 },
  title:        { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  location:     { fontSize: 13, marginTop: 4 },
  slots:        { fontSize: 12, color: colors.primaryAlt, fontWeight: '700', marginTop: 6 },

  pastSection:  { marginTop: 6 },
  pastScroll:   { paddingHorizontal: 12, paddingTop: 10, gap: 10 },
  pastCard:     { width: PAST_CARD_WIDTH, borderRadius: 10, overflow: 'hidden' },
  pastImage:    { width: '100%', aspectRatio: 16 / 9 },
  pastBody:     { padding: 10 },
  pastDate:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  pastTitle:    { fontSize: 13, fontWeight: '700', lineHeight: 17, marginTop: 3 },
});
