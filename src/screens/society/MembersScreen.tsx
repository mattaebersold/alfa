import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ScrollView, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text, TextInput } from '@ors/kit';
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
import { FONT_INTER } from '../../constants/fonts';
import { COLOR_GRAY_17, GUTTER } from '../../constants/config';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const LIMIT = 20;

export default function MembersScreen() {
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const route = useRoute<RouteProp<{ Members: { region?: string } }, 'Members'>>();
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <MembersView headerPad={headerPad} onScroll={onScroll} region={route?.params?.region} />
    </SafeAreaView>
  );
}

/**
 * Everything on the Members screen below the header, for any screen that
 * brings its own — the home screen's Members tab: `headerPad` is the space
 * its header takes, `onScroll` its header's hide-on-scroll handler.
 */
export function MembersView({ headerPad, onScroll, scrollRef: givenRef, region }: {
  headerPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** For a host that needs to move the scroll itself — the home screen's jump to the top. */
  scrollRef?: React.RefObject<FlatList<any> | null>;
  /** Start filtered to this region — a region tile on a member's profile. */
  region?: string;
}) {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const ownRef = useRef<FlatList<any>>(null);
  const scrollRef = givenRef ?? ownRef;
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const onAccent = contrastText(colors.primaryAlt);
  const [query, setQuery] = useState('');
  // Near me by default — measured from the zip on your profile. A region tile
  // on a member's profile opens this preset to that region instead.
  const location = useLocationFilter(region ?? 'near');
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
  const applyLocation = useCallback((next: string) => {
    if (next === location.choice) return;
    location.choose(next);
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
      <View style={styles.heading}>
        <ScreenHeading title="Members" />
      </View>
      <FeaturedMembersRow
        // The same summary a row opens — a preview first, with the profile
        // one button inside it.
        onMemberPress={(userId, _username, origin) => setSummary({ userId, origin })}
      />
      {/* Search on the left, the filter on the right — the pattern events,
          the marketplace, groups and cars share. */}
      <View style={styles.toolsRow}>
        <View style={[styles.searchBar, { backgroundColor: CONTROL_BG, borderColor: colors.border }]}>
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
        <FilterSummaryRow<string>
          value={location.choice}
          onApply={applyLocation}
          pills={[locationPill(location.choice)]}
          compact
        >
          {(choice, setDraft) => (
            <LocationFilterRow choice={choice} onChoose={setDraft} />
          )}
        </FilterSummaryRow>
      </View>
      {/* Stays on the screen rather than in the panel: it explains the list
          you're looking at, not an option you're choosing. */}
      {location.fellBack && (
        <Text style={[styles.note, { color: colors.grey }]}>{NO_ZIP_NOTE}</Text>
      )}
    </>
  );

  return (
    <>
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
      <FlatList
        ref={scrollRef}
        data={allUsers}
        keyExtractor={(u) => u.user_id}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <MemberRow
            user={item}
            plain
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
    </>
  );
}

/**
 * The search box and the filter row, a shade under the card colour — with the
 * member rows now unfilled, the full-brightness controls were the loudest
 * thing on the screen.
 */
const CONTROL_BG = COLOR_GRAY_17;

const styles = StyleSheet.create({
  content:     { flex: 1 },
  // The search and the filter pill, side by side.
  // On the gutter, and nudged up a little under the header.
  heading:     { paddingHorizontal: GUTTER, marginTop: -6 },
  toolsRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, margin: GUTTER },
  // A pill, the filter's height, taking the rest of the row.
  searchBar:   {
    flex: 1, minWidth: 0, height: 44,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15 },
  note:        { fontSize: 12, lineHeight: 17, paddingHorizontal: 12, marginBottom: 10 },

  regionRow:  { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  regionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
  },
  regionChipText: { fontSize: 13, fontFamily: FONT_INTER.bold },
  list:        { paddingBottom: 80, flexGrow: 1 },
});
