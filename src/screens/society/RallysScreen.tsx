import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetRallysQuery } from '../../api/apiService';
import RallyDetailSheet from '../../components/society/RallyDetailSheet';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Rally } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;

function RallyRow({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const colors = useColors();
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
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

export default function RallysScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [page, setPage] = useState(0);
  const [allRallys, setAllRallys] = useState<Rally[]>([]);
  const [selectedRallyId, setSelectedRallyId] = useState<string | null>(null);

  const { data, isFetching, isLoading, refetch } = useGetRallysQuery({ page, limit: 12 });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllRallys(data.entries);
      else setAllRallys((prev) => {
        const ids = new Set(prev.map((r) => r.internal_id));
        return [...prev, ...data.entries.filter((r) => !ids.has(r.internal_id))];
      });
    }
  }, [data, page]);

  // Newest/latest dates on top, past rallys sink to the bottom.
  const sortedRallys = useMemo(() => {
    return [...allRallys].sort((a, b) => {
      const da = a.event_date ? new Date(a.event_date).getTime() : 0;
      const db = b.event_date ? new Date(b.event_date).getTime() : 0;
      return db - da;
    });
  }, [allRallys]);

  const handleRefresh = useCallback(() => { setPage(0); setAllRallys([]); }, []);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allRallys.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allRallys.length]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        data={sortedRallys}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <RallyRow
            rally={item}
            onPress={() => setSelectedRallyId(item.internal_id)}
          />
        )}
        ListEmptyComponent={<EmptyState title="No rallys yet" />}
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
});
