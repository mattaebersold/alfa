import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, TextInput, Alert, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupsQuery, useGetUserGroupsQuery } from '../../api/apiService';
import { useBrandTextColor } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MY_CARD_WIDTH = SCREEN_WIDTH * 0.62;
const MY_CARD_GAP = 10;

const ADMIN_BADGE = { label: 'ADMIN', bg: '#CDA96F', fg: '#000000' };
const MEMBER_BADGE = { label: 'MEMBER', bg: '#2F6FED', fg: '#FFFFFF' };

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      {banner
        ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
        : <View style={[styles.cardBanner, { backgroundColor: colors.primaryAlt + '55' }]} />
      }
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
        {group.region && <Text style={[styles.cardRegion, { color: colors.grey }]}>{group.region}</Text>}
      </View>
    </TouchableOpacity>
  );
}

function MyGroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const isAdmin = group.membership?.member_type === 'admin';
  const badge = isAdmin ? ADMIN_BADGE : MEMBER_BADGE;
  return (
    <TouchableOpacity style={styles.myCard} onPress={onPress} activeOpacity={0.95}>
      {banner
        ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryAlt }]} />
      }
      <View style={styles.myCardOverlay} />
      <View style={[styles.myCardBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.myCardBadgeText, { color: badge.fg }]}>{badge.label}</Text>
      </View>
      <View style={styles.myCardInfo}>
        <Text style={styles.myCardTitle} numberOfLines={1}>{group.title}</Text>
        {typeof group.member_count === 'number' && (
          <View style={styles.myCardMembers}>
            <Users size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.myCardMembersText}>{group.member_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const { userInfo } = useAppSelector((s) => s.auth);
  const brandTextColor = useBrandTextColor();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  const isAdmin = userInfo?.accountType === 'admin';

  const { data: rawUserGroups, isLoading: userGroupsLoading } = useGetUserGroupsQuery(
    userInfo?.user_id ?? '',
    { skip: !userInfo?.user_id },
  );
  const userGroups: Group[] = rawUserGroups ?? [];

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
    (navigation as any).navigate('GroupDetail', { groupId });
  }, [navigation]);

  if (userGroupsLoading || allGroupsLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        <FlatList
          data={publicGroups}
          keyExtractor={(g) => g.internal_id}
          numColumns={2}
          columnWrapperStyle={styles.cardRow}
          contentContainerStyle={[styles.list, { paddingTop: headerPad, paddingBottom: tabBarHeight + 32 }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Heading rides in the list so it scrolls away with the content. */}
              <ScreenHeading title="Groups" />
              {userGroups.length > 0 && (
                <View style={styles.myGroupsSection}>
                  <Text style={[styles.myGroupsHeading, { color: colors.fg }]}>My Groups</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.myGroupsList}
                    snapToInterval={MY_CARD_WIDTH + MY_CARD_GAP}
                    decelerationRate="fast"
                  >
                    {userGroups.map((item) => (
                      <MyGroupCard key={item.internal_id} group={item} onPress={() => goToGroup(item.internal_id)} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {isAdmin && (
                <View style={styles.createGroupRow}>
                  <TouchableOpacity
                    style={[styles.createGroupBtn, { backgroundColor: colors.primaryAlt }]}
                    onPress={() => Alert.alert('Coming soon', 'Group creation will be available in a future update.')}
                    activeOpacity={0.8}
                  >
                    <Plus size={16} color={brandTextColor} />
                    <Text style={[styles.createGroupText, { color: brandTextColor }]}>Create Group</Text>
                  </TouchableOpacity>
                </View>
              )}

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
              <EmptyState title={search ? 'No groups match your search' : 'No groups'} />
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  list:    { paddingBottom: 32 },

  screenTitleBar: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 20, fontWeight: '800', letterSpacing: 0.3 },

  myGroupsSection: { paddingTop: 14, paddingBottom: 6 },
  myGroupsHeading: {
    fontSize: 16, fontWeight: '800', letterSpacing: 0.4,
    paddingHorizontal: 14, marginBottom: 10,
  },
  myGroupsList: { paddingHorizontal: 12, gap: MY_CARD_GAP },
  myCard: {
    width: MY_CARD_WIDTH,
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  myCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  myCardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  myCardTitle:  { flex: 1, fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  myCardMembers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  myCardMembersText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  myCardBadge:  {
    position: 'absolute', top: 10, left: 10,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6,
  },
  myCardBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  cardBody:   { padding: 8 },
  cardTitle:  { fontSize: 13, fontWeight: '700' },
  cardSub:    { fontSize: 12, marginTop: 2 },
  cardRegion: { fontSize: 11, marginTop: 2 },

  emptyWrap: { paddingTop: 20 },

  createGroupRow: {
    paddingHorizontal: 12, paddingVertical: 12,
  },
  createGroupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createGroupText: { fontWeight: '800', fontSize: 15 },
});
