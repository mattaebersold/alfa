import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { REGIONS } from '../../constants/regions';
import { useLocationFilter } from '../../hooks/useLocationFilter';
import LocationFilterRow, { NO_ZIP_NOTE, locationPill } from '../../components/ui/LocationFilterRow';
import FilterSummaryRow from '../../components/ui/FilterSummaryRow';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import type { AppStackParamList } from '../../navigation/types';
import type { User } from '../../types/api';
import { ss } from '../../styles/shared';
import MemberRow from '../../components/members/MemberRow';
import UserSummaryModal from '../../components/members/UserSummaryModal';
import { type SummaryOrigin } from '../../components/ui/SummaryModal';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const LIMIT = 20;

export default function MembersScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const route = useRoute<RouteProp<{ Members: { region?: string } }, 'Members'>>();
  const onAccent = contrastText(colors.primaryAlt);
  const [query, setQuery] = useState('');
  // Near me by default — measured from the zip on your profile. A region tile
  // on a member's profile opens this preset to that region instead.
  const location = useLocationFilter(route?.params?.region ?? 'near');
  const [page, setPage] = useState(0);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);

  const { data, isLoading, isFetching } = useGetUsersQuery({
    page, limit: LIMIT, q: query || undefined, ...location.params,
  });

  // Near me with no zip to measure from falls back to everyone, saying why.
  const { fallBack } = location;
  useEffect(() => {
    if (data?.near_unavailable) fallBack();
  }, [data?.near_unavailable, fallBack]);

  /**
   * Any filter change starts the list again — page 2 of the old filter isn't
   * page 2 of the new one.
   *
   * Only a *change*, though. Apply with nothing different would clear the list
   * and ask for a page the cache already holds, and with the same data coming
   * back the effect that refills the list never runs — an empty screen.
   */
  const applyLocation = useCallback((next: { choice: string; radius: number }) => {
    const choiceChanged = next.choice !== location.choice;
    const radiusChanged = next.radius !== location.radius;
    if (!choiceChanged && !radiusChanged) return;
    if (choiceChanged) location.choose(next.choice);
    if (radiusChanged) location.setRadius(next.radius);
    setPage(0);
    setAllUsers([]);
  }, [location]);

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

      {/* Folded into one row that opens a panel, as on events — the chips
          took a line and a half above the list for a choice made once. */}
      <FilterSummaryRow
        value={{ choice: location.choice, radius: location.radius }}
        onApply={applyLocation}
        pills={[locationPill(location.choice, location.radius)]}
        style={styles.filterRow}
      >
        {(draft, setDraft) => (
          <LocationFilterRow
            choice={draft.choice}
            onChoose={(choice) => setDraft((d) => ({ ...d, choice }))}
            radius={draft.radius}
            onRadius={(radius) => setDraft((d) => ({ ...d, radius }))}
          />
        )}
      </FilterSummaryRow>
      {/* Stays on the screen rather than in the panel: it explains the list
          you're looking at, not an option you're choosing. */}
      {location.fellBack && (
        <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
      )}
    </>
  );

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        ref={scrollRef}
        data={allUsers}
        keyExtractor={(u) => u.user_id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <MemberRow
            user={item}
            isFollowing={item.username ? followStatuses?.[item.username] : undefined}
            // A summary first, as the home feed's suggestions do — the
            // profile is one button inside the panel.
            onPress={(origin) => setSummary({ userId: item.user_id, origin: origin ?? null })}
          />
        )}
        ListEmptyComponent={
          isLoading ? <Spinner fullScreen /> : (
            <EmptyState
              title={location.choice !== 'all'
                ? `No members ${location.choice === 'near' ? `within ${location.radius} miles` : `in the ${REGIONS.find((r) => r.key === location.choice)?.label}`}`
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

      <UserSummaryModal
        userId={summary?.userId ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />
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
  // The search bar above already leaves 12 under itself.
  filterRow:   { marginTop: 0, marginBottom: 10 },
  note:        { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginBottom: 10 },

  regionRow:  { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  regionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  regionChipText: { fontSize: 13, fontWeight: '700' },
  list:        { paddingBottom: 80, flexGrow: 1 },
});
