import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupsQuery } from '../../api/apiService';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import type { GroupsStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';

type NavProp = NativeStackNavigationProp<GroupsStackParamList>;

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {banner
        ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
        : <View style={[styles.cardBanner, styles.cardBannerPlaceholder]} />
      }
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={styles.cardSub} numberOfLines={1}>{group.subtitle}</Text>}
        {group.region && <Text style={styles.cardRegion}>{group.region}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  const navigation = useNavigation<NavProp>();
  const [page, setPage] = useState(0);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  const { data, isFetching, isLoading, refetch } = useGetGroupsQuery({ page, limit: 12 });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllGroups(data.entries);
      else setAllGroups((prev) => {
        const ids = new Set(prev.map((g) => g.internal_id));
        return [...prev, ...data.entries.filter((g) => !ids.has(g.internal_id))];
      });
    }
  }, [data, page]);

  const handleRefresh = useCallback(() => { setPage(0); setAllGroups([]); }, []);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allGroups.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allGroups.length]);

  if (isLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <FlatList
        data={allGroups}
        keyExtractor={(g) => g.internal_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => navigation.navigate('GroupDetail', { groupId: item.internal_id })}
          />
        )}
        ListEmptyComponent={<EmptyState title="No groups yet" />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={Colors.brg} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.cream },
  list: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 24 },
  row:  { gap: 8, marginBottom: 8 },
  card: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  cardBanner:            { width: '100%', aspectRatio: 3 / 2 },
  cardBannerPlaceholder: { backgroundColor: Colors.brg },
  cardBody:    { padding: 8 },
  cardTitle:   { fontSize: 13, fontWeight: '700', color: Colors.fg },
  cardSub:     { fontSize: 12, color: Colors.muted, marginTop: 2 },
  cardRegion:  { fontSize: 11, color: Colors.grey, marginTop: 2 },
});
