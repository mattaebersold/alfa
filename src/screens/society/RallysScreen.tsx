import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetRallysQuery } from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { SocietyStackParamList } from '../../navigation/types';
import type { Rally } from '../../types/api';

type NavProp = NativeStackNavigationProp<SocietyStackParamList>;

function RallyRow({ rally, onPress }: { rally: Rally; onPress: () => void }) {
  const hero = rally.hero_image ? imageUrl(rally.hero_image) : firstGalleryUrl(rally.gallery);
  const date = rally.event_date ? format(new Date(rally.event_date), 'MMM d, yyyy') : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.cardImage} contentFit="cover" />
        : <View style={[styles.cardImage, styles.cardPlaceholder]} />
      }
      <View style={styles.cardBody}>
        {date && <Text style={styles.date}>{date}</Text>}
        <Text style={styles.title} numberOfLines={2}>{rally.title}</Text>
        {rally.location && <Text style={styles.location} numberOfLines={1}>{rally.location}</Text>}
        {rally.slots_available != null && (
          <Text style={styles.slots}>{rally.slots_available} slots available</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function RallysScreen() {
  const navigation = useNavigation<NavProp>();
  const [page, setPage] = useState(0);
  const [allRallys, setAllRallys] = useState<Rally[]>([]);

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

  const handleRefresh = useCallback(() => { setPage(0); setAllRallys([]); }, []);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allRallys.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allRallys.length]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={allRallys}
        keyExtractor={(item) => item.internal_id}
        renderItem={({ item }) => (
          <RallyRow
            rally={item}
            onPress={() => navigation.navigate('RallyDetail', { rallyId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No rallys yet" />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.brg} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.cream },
  list:         { paddingBottom: 24 },
  card:         {
    backgroundColor: '#FFFFFF', marginHorizontal: 12, marginTop: 12,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardImage:    { width: '100%', aspectRatio: 16 / 9 },
  cardPlaceholder: { backgroundColor: Colors.brg },
  cardBody:     { padding: 12 },
  date:         { fontSize: 12, fontWeight: '700', color: Colors.speed, marginBottom: 4 },
  title:        { fontSize: 16, fontWeight: '800', color: Colors.fg, lineHeight: 22 },
  location:     { fontSize: 13, color: Colors.grey, marginTop: 4 },
  slots:        { fontSize: 12, color: Colors.brg, fontWeight: '700', marginTop: 6 },
});
