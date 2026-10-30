import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../../components/ui/AppImage';
import OilSheen, { WARM_SHEEN_FILL } from '../../components/ui/OilSheen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Plus } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupsQuery, useGetUserGroupsQuery, useGetUsageQuery } from '../../api/apiService';
import { useBrandTextColor, useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl } from '../../utils/image';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import SharedButton from '../../components/ui/SharedButton';
import NewGroupSheet from '../../components/groups/NewGroupSheet';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';
import { REGIONS, regionKey, regionLabel } from '../../constants/regions';
import { GROUP_TYPES } from '../../constants/groupTypes';
import FilterSummaryRow, { FilterChoiceRow, FilterDivider } from '../../components/ui/FilterSummaryRow';
import SearchPill from '../../components/ui/SearchPill';
import GroupSummaryModal from '../../components/groups/GroupSummaryModal';
import { type SummaryOrigin } from '../../components/ui/SummaryModal';
import { ss } from '../../styles/shared';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_MEMBER_BLUE,
  COLOR_WHITE,
  GUTTER,
  COLOR_GRAY_40, MAIN_SCREEN_TOP_GAP} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'
import { SkeletonGrid, SkeletonRow } from '../../components/ui/Skeleton';
import GroupCard, { CARD_RADIUS } from '../../components/groups/GroupCard';

/** What the filter row says is applied. */
function regionButtonLabel(key: string | null) {
  if (!key) return 'All regions';
  if (key === 'none') return 'No region';
  return REGIONS.find((r) => r.key === key)?.label ?? key;
}

/** Every choice the filter offers, in the order it offers them. */
const REGION_CHOICES: { key: string | null; label: string }[] = [
  { key: null,   label: 'All regions' },
  ...REGIONS.map((r) => ({ key: r.key, label: r.label })),
  { key: 'none', label: 'No region' },
];

function typeButtonLabel(key: string | null) {
  if (!key) return 'All types';
  if (key === 'none') return 'No type';
  return GROUP_TYPES.find((t) => t.key === key)?.label ?? key;
}

/**
 * The kinds of group, plus the two answers that aren't kinds.
 *
 * `'none'` is here for the same reason it is on regions, and with more cause:
 * groups predating the type picker carry an empty string, so without a bucket
 * for them they'd answer no type filter at all and be reachable only through
 * All types.
 */
const TYPE_CHOICES: { key: string | null; label: string }[] = [
  { key: null,   label: 'All types' },
  ...GROUP_TYPES.map((t) => ({ key: t.key, label: t.label })),
  { key: 'none', label: 'No type' },
];

/** What the groups list filters by — see FilterSummaryRow. */
interface GroupFilterValue {
  region: string | null;
  type: string | null;
}

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** The shelf's side inset — the app's GUTTER, as every section here sits on. */
const MY_SECTION_MARGIN = GUTTER;
const MY_CARD_GAP = 8;
// 70% of the screen: one card to look at, and the edge of the next saying
// the row goes on.
const MY_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.7);
/** The row's whole width — a lone group has nothing to share it with. */
const MY_CARD_WIDTH_SOLO = SCREEN_WIDTH - MY_SECTION_MARGIN * 2;

/** Your groups' cards — the grid's own grey, now the shelf has no box of its own. */
const MY_CARD_BG = COLOR_GRAY_40;

const ADMIN_BADGE = { label: 'ADMIN', bg: WARM_SHEEN_FILL, fg: COLOR_BLACK };
const MEMBER_BADGE = { label: 'MEMBER', bg: COLOR_MEMBER_BLUE, fg: COLOR_WHITE };

function MyGroupCard({ group, onPress, solo = false }: { group: Group; onPress: () => void; solo?: boolean }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const isAdmin = group.membership?.member_type === 'admin';
  const badge = isAdmin ? ADMIN_BADGE : MEMBER_BADGE;
  return (
    // The same card as the groups grid below — picture, badges on it, the
    // name on the panel under it — so your groups and everyone's read alike.
    // No region: you know where your own groups are.
    <TouchableOpacity
      style={[
        styles.card,
        styles.myCard,
        { width: solo ? MY_CARD_WIDTH_SOLO : MY_CARD_WIDTH },
        // A step lighter than the grid's cards — your own groups, set forward.
        { backgroundColor: MY_CARD_BG, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={`${group.title ?? 'Group'}, ${badge.label.toLowerCase()}`}
    >
      <View style={styles.cardBannerWrap}>
        {banner
          ? <Image source={{ uri: banner }} style={[styles.cardBanner, solo && styles.myCardBannerSolo]} contentFit="cover" />
          : <View style={[styles.cardBanner, solo && styles.myCardBannerSolo, { backgroundColor: colors.primaryAlt + '55' }]} />
        }
        {/* Your part in it, top left. A group you run wears the gold with
            the oil-slick film; one you're in, the member blue. */}
        <View style={[styles.myCardBadge, { backgroundColor: badge.bg }]}>
          {isAdmin ? <OilSheen tone="warm" radius={PILL_RADIUS} /> : null}
          <Text style={[styles.myCardBadgeText, { color: badge.fg }]}>{badge.label}</Text>
        </View>
        {typeof group.member_count === 'number' ? (
          <View style={styles.cardMembers}>
            <Users size={11} color={COLOR_WHITE} />
            <Text style={styles.cardMembersText}>{group.member_count}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.cardBody, { backgroundColor: MY_CARD_BG }]}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * The groups list as a screen of its own: just the header around GroupsView.
 * The home screen shows the same view under its "Groups" tab, in place.
 */
export default function GroupsScreen() {
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader />
      <GroupsView headerPad={headerPad} onScroll={onScroll} />
    </SafeAreaView>
  );
}

/**
 * Everything on the Groups screen below the header, for any screen that
 * brings its own: `headerPad` is the space its header takes (the list starts
 * under it), and `onScroll` is its header's hide-on-scroll handler.
 */
export function GroupsView({ headerPad, onScroll, scrollRef: givenRef }: {
  headerPad: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** For a host that needs to move the scroll itself — the home screen's jump to the top. */
  scrollRef?: React.RefObject<FlatList<any> | null>;
}) {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const ownRef = useRef<FlatList<any>>(null);
  const scrollRef = givenRef ?? ownRef;
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const { userInfo } = useAppSelector((s) => s.auth);
  const brandTextColor = useBrandTextColor();
  const [search, setSearch] = useState('');
  /**
   * Region filter. `null` is every region; `'none'` is the groups that
   * deliberately belong to no region, which is a real answer rather than
   * missing data — an online-only club has no region on purpose.
   */
  const [region, setRegion] = useState<string | null>(null);
  /**
   * Type filter, on the same terms: `null` is every kind, `'none'` the groups
   * that carry no type — which is three of them today, from before the create
   * form asked.
   */
  const [type, setType] = useState<string | null>(null);
  /** The group whose summary panel is open, and the card it grew from. */
  const [summary, setSummary] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  const [page, setPage] = useState(0);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  const isPro = useIsPro();
  const brand = useBrandColor();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  // Pro starts as many groups as they like; basic, one — the server holds
  // both (horacio's helpers/limits), and `usage.groups` says where you stand.
  const { data: usage } = useGetUsageQuery(undefined, { skip: isPro || !userInfo?.user_id });

  const { data: rawUserGroups, isLoading: userGroupsLoading, refetch: refetchUserGroups } = useGetUserGroupsQuery(
    userInfo?.user_id ?? '',
    { skip: !userInfo?.user_id },
  );
  /**
   * The server orders your groups by when you last used them — opened or
   * posted in (horacio's helpers/groupActivity). Opening one and coming back
   * moves it to the front, so the list is read again on the way back.
   */
  useFocusEffect(useCallback(() => {
    if (userInfo?.user_id) refetchUserGroups();
  }, [userInfo?.user_id, refetchUserGroups]));
  /**
   * Groups you've actually joined.
   *
   * The endpoint returns every membership row — pending requests, open
   * invitations and declined ones included — so an unfiltered list put a group
   * you'd only asked to join on your shelf, one tap from a page you can't see
   * yet. Those stay in the browse grid, where their summary says "Requested".
   */
  const userGroups: Group[] = (rawUserGroups ?? []).filter(
    (g) => (g.membership?.status ?? 'active') === 'active',
  );

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

  /**
   * Whether the New Group button shows. A server older than the group cap
   * sends no `groups`, so a basic member falls back to "have you started one
   * of the groups you're in".
   */
  const canCreateGroup = isPro || (usage?.groups
    ? !usage.groups.reached
    : !userGroups.some((g) => g.user_id === userInfo?.user_id));

  const searchLower = search.trim().toLowerCase();
  const publicGroups = allGroups
    .filter((g) => !userGroupIds.has(g.internal_id))
    .filter((g) => !searchLower || (
      (g.title ?? '').toLowerCase().includes(searchLower) ||
      (g.subtitle ?? '').toLowerCase().includes(searchLower) ||
      (regionLabel(g.region) ?? '').toLowerCase().includes(searchLower)
    ))
    .filter((g) => {
      if (!region) return true;
      // Groups created before regions were a fixed set carry free text, so
      // this matches the key or its label rather than only the key.
      const key = regionKey(g.region);
      return region === 'none' ? !key : key === region;
    })
    .filter((g) => {
      if (!type) return true;
      // An absent type and an empty-string one are the same answer — see
      // TYPE_CHOICES. Trimmed and lowered because the field is a bare String on
      // the server with no enum behind it.
      const key = (g.type ?? '').trim().toLowerCase();
      return type === 'none' ? !key : key === type;
    });

  const handleRefresh = useCallback(() => { setPage(0); setAllGroups([]); refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (!isFetching && data && allGroups.length < data.total) setPage((p) => p + 1);
  }, [isFetching, data, allGroups.length]);

  const goToGroup = useCallback((groupId: string) => {
    (navigation as any).navigate('GroupDetail', { groupId });
  }, [navigation]);

  if (userGroupsLoading || allGroupsLoading) {
    return (
      <View style={[styles.content, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingHorizontal: GUTTER }]}>
        <SkeletonRow count={3} size={88} radius={COMMON_RADIUS} style={{ marginBottom: 20 }} />
        <SkeletonGrid count={6} ratio={1.1} />
      </View>
    );
  }

  return (
    <>
      <View style={styles.content}>
        <FlatList
          ref={scrollRef}
          data={publicGroups}
          keyExtractor={(g) => g.internal_id}
          numColumns={2}
          columnWrapperStyle={styles.cardRow}
          // A little clear of the header, with no title to hold it off.
          contentContainerStyle={[styles.list, { paddingTop: headerPad + MAIN_SCREEN_TOP_GAP, paddingBottom: tabBarHeight + 32 }]}
          onScroll={onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primaryAlt} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* No screen title — the tab says where you are. */}
              {userGroups.length > 0 && (
                <View style={styles.myGroupsSection}>
                  {/* The count rides in the heading rather than under it —
                      "how many am I in" is the question the heading raises,
                      and answering it there costs no vertical space. */}
                  <View style={styles.myGroupsHeadingRow}>
                    <Text style={[styles.myGroupsHeading, { color: colors.fg }]}>My Groups</Text>
                    <View style={[styles.myGroupsCount, { backgroundColor: brand }]}>
                      <Text style={[styles.myGroupsCountText, { color: brandTextColor }]}>
                        {userGroups.length}
                      </Text>
                    </View>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.myGroupsList}
                    snapToInterval={MY_CARD_WIDTH + MY_CARD_GAP}
                    decelerationRate="fast"
                  >
                    {userGroups.map((item) => (
                      <MyGroupCard
                        key={item.internal_id}
                        group={item}
                        onPress={() => goToGroup(item.internal_id)}
                        solo={userGroups.length === 1}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Full width, between your groups and the search — the one
                  thing on the screen that makes something. */}
              {canCreateGroup && (
                <SharedButton
                  label="New Group"
                  Icon={Plus}
                  full
                  onPress={() => setNewGroupOpen(true)}
                  style={[styles.newGroupBtn, userGroups.length === 0 && styles.newGroupBtnFirst]}
                />
              )}

              <View style={styles.searchRow}>
                <SearchPill value={search} onChangeText={setSearch} onClear={() => setSearch('')} placeholder="Search groups..." />
                {/* The filter beside the search, as a pill naming what's
                    applied — the pattern events and the marketplace share.
                    Region and type, together: both run over what's already
                    loaded, so Apply is instant. */}
                <FilterSummaryRow<GroupFilterValue>
                  value={{ region, type }}
                  onApply={(next) => { setRegion(next.region); setType(next.type); }}
                  pills={[
                    { key: 'region', label: regionButtonLabel(region) },
                    ...(type ? [{ key: 'type', label: typeButtonLabel(type) }] : []),
                  ]}
                  accessibilityLabel={`Filter groups: ${[regionButtonLabel(region), ...(type ? [typeButtonLabel(type)] : [])].join(', ')}`}
                  compact
                >
                  {(draft, setDraft) => (
                    <>
                      {/* Unlabelled, ruled apart like the location panel's. */}
                      <FilterChoiceRow<string | null>
                        options={REGION_CHOICES}
                        selected={draft.region}
                        onSelect={(region) => setDraft((d) => ({ ...d, region }))}
                      />
                      <FilterDivider />
                      <FilterChoiceRow<string | null>
                        options={TYPE_CHOICES}
                        selected={draft.type}
                        onSelect={(type) => setDraft((d) => ({ ...d, type }))}
                      />
                      <FilterDivider last />
                    </>
                  )}
                </FilterSummaryRow>
              </View>

            </View>
          }
          renderItem={({ item }) => (
            <GroupCard
              group={item}
              onPress={(origin) => setSummary({ id: item.internal_id, origin })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState
                title={search || region || type ? 'No groups match your filters' : 'No groups'}
              />
            </View>
          }
        />
      </View>

      <GroupSummaryModal
        groupId={summary?.id ?? null}
        origin={summary?.origin}
        onClose={() => setSummary(null)}
      />

      <NewGroupSheet
        visible={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        // Straight into the group you just made — you're its admin, and there
        // is nothing to do with it from this list.
        onCreated={(groupId) => goToGroup(groupId)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  list:    { paddingBottom: 32 },

  /**
   * Your groups sit on their own ground.
   *
   * The shelf and the grid below it were the same surface, so "My Groups" was
   * a heading over an indistinguishable row of cards — the only thing marking
   * them yours was a badge you had to read. A rounded container inset on the
   * page gutter says it before anything is read: this shelf is a different
   * kind of thing from the browse grid beneath.
   */
  // No box of its own: the heading and the row sit straight on the page,
  // full-bleed so the cards scroll out to the screen's edge.
  myGroupsSection: { paddingTop: 4, marginBottom: 16 },
  myGroupsHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: MY_SECTION_MARGIN, marginBottom: 10,
  },
  // Uppercase and small, like a section label rather than a page title — the
  // page title is "Groups", and two headings at the same weight competed.
  // A section heading, in the form's heading face — not a small caps label.
  myGroupsHeading: { fontSize: 17, fontFamily: FONT_INTER.bold },
  myGroupsCount: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  myGroupsCountText: { fontSize: 11, fontFamily: FONT_INTER.extrabold },
  myGroupsList: { paddingHorizontal: MY_SECTION_MARGIN, gap: MY_CARD_GAP },
  // A grid card, at the shelf's width — `card` gives it the rest.
  myCard: { flex: 0 },
  // Wider, shallower picture when yours is the only one.
  myCardBannerSolo: { aspectRatio: 2 / 1 },
  myCardBadge:  {
    position: 'absolute', top: 6, left: 6,
    paddingHorizontal: 7, paddingVertical: 2.5,
    borderRadius: PILL_RADIUS, overflow: 'hidden',
  },
  myCardBadgeText: { fontSize: 9, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.5 },

  // The search and the filter pill, side by side.
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GUTTER, marginTop: 10, marginBottom: 10,
  },

  // The same 12 gutter as My Groups and the search row above.
  cardRow:  { gap: 8, marginBottom: 8, paddingHorizontal: MY_SECTION_MARGIN },
  // The marketplace card's frame.
  card: {
    flex: 1, borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden',
  },
  // Rounded all round, the card's radius — a tile set into the card.
  cardBannerWrap: { borderRadius: CARD_RADIUS, overflow: 'hidden' },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  // The lighter panel the words sit on, filling to the card's foot.
  cardBody:   { flexGrow: 1, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, backgroundColor: COLOR_GRAY_40 },
  cardTitle:  { fontSize: 13, fontFamily: FONT_INTER.bold },
  // Bottom right, on a dark disc so it reads over any picture.
  cardMembers: {
    position: 'absolute', right: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardMembersText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },

  emptyWrap: { paddingTop: 20 },

  // On the page gutter, like the search row beneath it.
  newGroupBtn: { marginHorizontal: GUTTER, marginBottom: 6 },
  // No shelf above it: a little clear of the header instead.
  newGroupBtnFirst: { marginTop: 4 },
});
