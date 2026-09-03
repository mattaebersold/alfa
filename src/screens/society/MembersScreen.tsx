import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {Search, MapPin} from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {useGetUsersQuery, useGetFollowStatusesQuery} from '../../api/apiService';
import FeaturedMembersRow from '../../components/members/FeaturedMembersRow';
import Avatar from '../../components/ui/Avatar';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { REGIONS } from '../../constants/regions';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';
import { ss } from '../../styles/shared';
import MemberRow from '../../components/members/MemberRow';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const LIMIT = 20;

export default function MembersScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const route = useRoute<RouteProp<{ Members: { region?: string } }, 'Members'>>();
  const onAccent = contrastText(colors.primaryAlt);
  const [query, setQuery] = useState('');
  // Arrives preset when opened from a member's region tile.
  const [region, setRegion] = useState<string | null>(route?.params?.region ?? null);
  const [page, setPage] = useState(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const { data, isLoading, isFetching } = useGetUsersQuery({
    page, limit: LIMIT, q: query || undefined, region: region ?? undefined,
  });

  React.useEffect(() => {
    if (data?.entries) {
      if (page === 0) setAllUsers(data.entries);
      else setAllUsers((prev) => {
        const ids = new Set(prev.map((u) => u.user_id));
        return [...prev, ...data.entries.filter((u) => !ids.has(u.user_id))];
      });
    }
  }, [data, page]);

  /**
   * Follow state for everyone on screen, in one request.
   *
   * Each row used to ask for its own, so a page of twenty fired twenty of these
   * alongside the two per-row queries they already make — sixty requests at
   * once, and any that failed left their button reading "Follow" for someone
   * you follow. Refetches as the list grows, and the mutations invalidate it.
   */
  const usernames = useMemo(
    () => allUsers.map((u) => u.username).filter(Boolean) as string[],
    [allUsers],
  );
  const { data: followData } = useGetFollowStatusesQuery(usernames, { skip: usernames.length === 0 });
  const followStatuses = followData?.statuses;

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    setPage(0);
    setAllUsers([]);
  }, []);

  // Tapping the region you're already on clears it — the chips are a filter,
  // not a required choice, and there's no other way back to everyone.
  const handleRegionPress = useCallback((key: string) => {
    setRegion((prev) => (prev === key ? null : key));
    setPage(0);
    setAllUsers([]);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allUsers.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allUsers.length]);

  const handleRefresh = useCallback(() => {
    setPage(0);
    setAllUsers([]);
  }, []);

  const ListHeader = (
    <>
      {/* Heading rides in the list so it scrolls away with the content. */}
      <ScreenHeading title="Members" />
      <FeaturedMembersRow
        onMemberPress={(userId, username) => navigation.navigate('UserDetail', { userId, username })}
      />
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Search size={16} color={colors.grey} />
        <TextInput
          style={[styles.searchInput, { color: colors.fg }]}
          value={query}
          onChangeText={handleQueryChange}
          placeholder="Search members..."
          placeholderTextColor={colors.grey}
          autoCapitalize="none"
        />
      </View>

      {/* Region — members carry a city and state, so this is the one bit of
          "near me" the data can actually answer. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.regionRow}
        keyboardShouldPersistTaps="handled"
      >
        {REGIONS.map((r) => {
          const active = region === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[
                styles.regionChip,
                { backgroundColor: colors.card, borderColor: colors.border },
                active && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt },
              ]}
              onPress={() => handleRegionPress(r.key)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <MapPin size={12} color={active ? onAccent : colors.grey} />
              <Text style={[styles.regionChipText, { color: active ? onAccent : colors.grey }]}>
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <RowEndSpacer />
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        data={allUsers}
        keyExtractor={(u) => u.user_id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <MemberRow
            user={item}
            isFollowing={item.username ? followStatuses?.[item.username] : undefined}
            onPress={() => navigation.navigate('UserDetail', { userId: item.user_id, username: item.username })}
          />
        )}
        ListEmptyComponent={
          isLoading ? <Spinner fullScreen /> : (
            <EmptyState
              title={region
                ? `No members in the ${REGIONS.find((r) => r.key === region)?.label}`
                : 'No members found'}
            />
          )
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingTop: headerPad }]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onRefresh={handleRefresh}
        refreshing={false}
      />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content:     { flex: 1 },
  searchBar:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },

  regionRow:  { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  regionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  regionChipText: { fontSize: 13, fontWeight: '700' },
  list:        { paddingBottom: 80, flexGrow: 1 },
});
