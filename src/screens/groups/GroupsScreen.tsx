import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupsQuery, useGetUserGroupsQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader from '../../components/ui/AppHeader';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      {banner
        ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
        : <View style={[styles.cardBanner, { backgroundColor: colors.cyan + '55' }]} />
      }
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
        {group.region && <Text style={[styles.cardRegion, { color: colors.grey }]}>{group.region}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  return (
    <TouchableOpacity style={[styles.groupRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      {banner
        ? <Image source={{ uri: banner }} style={styles.rowThumb} contentFit="cover" />
        : <View style={[styles.rowThumb, { backgroundColor: colors.cyan + '55' }]} />
      }
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.rowSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
        {group.region && <Text style={[styles.rowRegion, { color: colors.grey }]}>{group.region}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.segment, borderBottomColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.grey }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

export default function GroupsScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  const { data: rawUserGroups, isLoading: userGroupsLoading } = useGetUserGroupsQuery(
    userInfo?.user_id ?? '',
    { skip: !userInfo?.user_id },
  );
  // API may return Group[] or { entries: Group[] } depending on backend
  const userGroups: Group[] = Array.isArray(rawUserGroups)
    ? rawUserGroups
    : (rawUserGroups as any)?.entries ?? [];

  const { data, isFetching, isLoading: allGroupsLoading, refetch } = useGetGroupsQuery({ page, limit: 20 });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllGroups(data.entries);
      else setAllGroups((prev) => {
        const ids = new Set(prev.map((g) => g.internal_id));
        return [...prev, ...data.entries.filter((g) => !ids.has(g.internal_id))];
      });
    }
  }, [data, page]);

  const adminGroups = userGroups.filter((g) => g.membership?.member_type === 'admin');
  const memberGroups = userGroups.filter((g) => g.membership?.member_type === 'basic');
  const userGroupIds = new Set(userGroups.map((g) => g.internal_id));

  const searchLower = search.trim().toLowerCase();
  const publicGroups = allGroups
    .filter((g) => !userGroupIds.has(g.internal_id))
    .filter((g) => !searchLower || (
      (g.title ?? '').toLowerCase().includes(searchLower) ||
      (g.subtitle ?? '').toLowerCase().includes(searchLower) ||
      (g.region ?? '').toLowerCase().includes(searchLower)
    ));

  const handleRefresh = useCallback(() => { setPage(0); setAllGroups([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allGroups.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allGroups.length]);

  const goToGroup = useCallback((groupId: string) => {
    navigation.navigate('GroupDetailModal', { groupId });
  }, [navigation]);

  if (userGroupsLoading || allGroupsLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.brg }]} edges={['top']}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        <FlatList
          data={publicGroups}
          keyExtractor={(g) => g.internal_id}
          numColumns={2}
          columnWrapperStyle={styles.cardRow}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.cyan} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {adminGroups.length > 0 && (
                <View>
                  <SectionHeader title="Groups You Manage" colors={colors} />
                  {adminGroups.map((g) => (
                    <GroupRow key={g.internal_id} group={g} onPress={() => goToGroup(g.internal_id)} />
                  ))}
                </View>
              )}

              {memberGroups.length > 0 && (
                <View>
                  <SectionHeader title="Member Of" colors={colors} />
                  {memberGroups.map((g) => (
                    <GroupRow key={g.internal_id} group={g} onPress={() => goToGroup(g.internal_id)} />
                  ))}
                </View>
              )}

              <SectionHeader title="All Groups" colors={colors} />

              {/* Search bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.searchInput, { color: colors.fg }]}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search groups..."
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                    <Text style={{ color: colors.grey, fontSize: 14 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => goToGroup(item.internal_id)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState title={search ? 'No groups match your search' : 'No groups yet'} />
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  content: { flex: 1 },
  list:    { paddingBottom: 32 },

  sectionHeader: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  groupRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowThumb:  { width: 52, height: 36, borderRadius: 6, overflow: 'hidden' },
  rowBody:   { flex: 1 },
  rowTitle:  { fontSize: 14, fontWeight: '700' },
  rowSub:    { fontSize: 12, marginTop: 1 },
  rowRegion: { fontSize: 11, marginTop: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginVertical: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  cardRow:  { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  card: {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  cardBody:   { padding: 8 },
  cardTitle:  { fontSize: 13, fontWeight: '700' },
  cardSub:    { fontSize: 12, marginTop: 2 },
  cardRegion: { fontSize: 11, marginTop: 2 },

  emptyWrap: { paddingTop: 20 },
});
