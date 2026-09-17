import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, TextInput, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users, MapPin, Ban } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetGroupsQuery, useGetUserGroupsQuery, useGetDeclinedInvitesQuery } from '../../api/apiService';
import { useBrandTextColor, useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl } from '../../utils/image';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import HeadingActionButton from '../../components/ui/HeadingActionButton';
import NewGroupSheet from '../../components/groups/NewGroupSheet';
import DeclinedInvitesSheet from '../../components/groups/DeclinedInvitesSheet';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';
import { REGIONS, regionKey, regionLabel } from '../../constants/regions';
import { GROUP_TYPES } from '../../constants/groupTypes';
import FilterSummaryRow, { FilterChoiceRow } from '../../components/ui/FilterSummaryRow';
import GroupSummaryModal from '../../components/groups/GroupSummaryModal';
import { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';

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
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Side margin on the My Groups container, matching the 12 gutter below it. */
const MY_SECTION_MARGIN = 12;
const MY_CARD_GAP = 8;
// A shelf you scan rather than cards you page through: a little over two fit
// inside the container, and the part of the third says the row goes on.
const MY_CARD_WIDTH = Math.round((SCREEN_WIDTH - MY_SECTION_MARGIN * 2) * 0.42);
/** The shelf's whole inner width — a lone group has nothing to share it with. */
const MY_CARD_WIDTH_SOLO = SCREEN_WIDTH - MY_SECTION_MARGIN * 2 - 12 * 2;
const MY_CARD_HEIGHT = 118;
/** Taller too, so a full-width banner isn't a letterbox strip. */
const MY_CARD_HEIGHT_SOLO = 170;

const ADMIN_BADGE = { label: 'ADMIN', bg: '#CDA96F', fg: '#000000' };
const MEMBER_BADGE = { label: 'MEMBER', bg: '#2F6FED', fg: '#FFFFFF' };

/**
 * A group you're not in.
 *
 * Opens a summary rather than the group itself. Everything in this grid is
 * somewhere you haven't joined — the list is filtered to exclude your own — so
 * the question a card raises is "what is this and do I want in", not "take me
 * there". Pushing the whole group screen to answer it cost you the browse
 * position you'd scrolled to, and the panel carries a View Group button for
 * when the answer is yes.
 */
function GroupCard({ group, onPress }: {
  group: Group;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  return (
    <SummaryTouchable
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={group.title ?? 'Group'}
    >
      {banner
        ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
        : <View style={[styles.cardBanner, { backgroundColor: colors.primaryAlt + '55' }]} />
      }
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
        {regionLabel(group.region) && (
          <View style={[styles.cardRegion, { backgroundColor: colors.segment }]}>
            <MapPin size={10} color={colors.grey} strokeWidth={2.4} />
            <Text style={[styles.cardRegionText, { color: colors.fg }]} numberOfLines={1}>
              {regionLabel(group.region)}
            </Text>
          </View>
        )}
      </View>
    </SummaryTouchable>
  );
}

function MyGroupCard({ group, onPress, solo = false }: { group: Group; onPress: () => void; solo?: boolean }) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const isAdmin = group.membership?.member_type === 'admin';
  const badge = isAdmin ? ADMIN_BADGE : MEMBER_BADGE;
  return (
    <TouchableOpacity
      style={[
        styles.myCard,
        solo
          ? { width: MY_CARD_WIDTH_SOLO, height: MY_CARD_HEIGHT_SOLO }
          : { width: MY_CARD_WIDTH, height: MY_CARD_HEIGHT },
        { borderColor: badge.bg },
      ]}
      onPress={onPress}
      activeOpacity={0.95}
    >
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
            <Users size={11} color="rgba(255,255,255,0.9)" />
            <Text style={styles.myCardMembersText}>{group.member_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const tabBarHeight = useBottomTabBarHeight();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
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
  const [declinedOpen, setDeclinedOpen] = useState(false);
  /** The group whose summary panel is open, and the card it grew from. */
  const [summary, setSummary] = useState<{ id: string; origin: SummaryOrigin | null } | null>(null);

  // Only surfaced when there's something in it — a permanent row explaining a
  // state you've never been in is clutter.
  const { data: declined } = useGetDeclinedInvitesQuery();
  const declinedCount = declined?.entries?.length ?? 0;
  const [page, setPage] = useState(0);
  const [allGroups, setAllGroups] = useState<Group[]>([]);

  // Starting a group is a Pro feature — it used to be admin-only, which meant
  // nobody but the team could make one. The server only asks that you're signed
  // in, so this is the whole gate.
  const isPro = useIsPro();
  const brand = useBrandColor();
  const [newGroupOpen, setNewGroupOpen] = useState(false);

  const { data: rawUserGroups, isLoading: userGroupsLoading } = useGetUserGroupsQuery(
    userInfo?.user_id ?? '',
    { skip: !userInfo?.user_id },
  );
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

  if (userGroupsLoading || allGroupsLoading) return <Spinner fullScreen />;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[styles.content, { backgroundColor: colors.cream }]}>
        <FlatList
          ref={scrollRef}
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
              {/* The action sits with the title rather than in a band of its
                  own below the shelf of groups you're already in — it's the
                  first thing you'd reach for, so it shouldn't be the last
                  thing you scroll past. */}
              {/* ScreenHeading sits at zero — it's shared with eight other
                  screens that supply their own gutter — so the padding is
                  here, on the same 12 as everything below it. */}
              <View style={styles.headingWrap}>
                <ScreenHeading
                  title="Groups"
                  inline
                  right={isPro ? (
                    <HeadingActionButton
                      label="New Group"
                      onPress={() => setNewGroupOpen(true)}
                      accessibilityLabel="Create a new group"
                    />
                  ) : undefined}
                />
              </View>
              {userGroups.length > 0 && (
                <View style={[
                  styles.myGroupsSection,
                  { backgroundColor: colors.card, borderColor: colors.borderDark },
                ]}>
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

              <View style={styles.searchRow}>
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

              {/* The same filter row events, members and cars have, rather
                  than a region button of its own beside the search field. Both
                  filters run over what's already loaded, so Apply is instant.

                  Where and what kind are separate questions — a Northwest
                  single-make register and a Northwest regional club are not the
                  same thing to be looking for — and events already asks both in
                  one panel, so groups does too. */}
              <FilterSummaryRow<GroupFilterValue>
                value={{ region, type }}
                onApply={(draft) => { setRegion(draft.region); setType(draft.type); }}
                pills={[
                  { key: 'region', label: regionButtonLabel(region) },
                  { key: 'type', label: typeButtonLabel(type) },
                ]}
                accessibilityLabel={`Filter groups: ${regionButtonLabel(region)}, ${typeButtonLabel(type)}`}
                style={styles.filterRow}
              >
                {(draft, setDraft) => (
                  <>
                    <FilterChoiceRow<string | null>
                      label="Region"
                      options={REGION_CHOICES}
                      selected={draft.region}
                      onSelect={(region) => setDraft((d) => ({ ...d, region }))}
                    />
                    <FilterChoiceRow<string | null>
                      label="Type"
                      options={TYPE_CHOICES}
                      selected={draft.type}
                      onSelect={(type) => setDraft((d) => ({ ...d, type }))}
                    />
                  </>
                )}
              </FilterSummaryRow>

              {/* The only way back from a decline. It lives here rather than in
                  settings because it's a fact about groups, and this is the
                  groups screen — see DeclinedInvitesSheet. */}
              {declinedCount > 0 && (
                <TouchableOpacity
                  style={[styles.declinedRow, { borderColor: colors.border }]}
                  onPress={() => setDeclinedOpen(true)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Declined invitations"
                >
                  <Ban size={14} color={colors.grey} />
                  <Text style={[styles.declinedText, { color: colors.grey }]}>
                    {declinedCount} declined invitation{declinedCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={[styles.declinedAction, { color: colors.fg }]}>Manage</Text>
                </TouchableOpacity>
              )}
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

      <DeclinedInvitesSheet
        visible={declinedOpen}
        onClose={() => setDeclinedOpen(false)}
      />

      <NewGroupSheet
        visible={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        // Straight into the group you just made — you're its admin, and there
        // is nothing to do with it from this list.
        onCreated={(groupId) => goToGroup(groupId)}
      />
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

  /**
   * Your groups sit on their own ground.
   *
   * The shelf and the grid below it were the same surface, so "My Groups" was
   * a heading over an indistinguishable row of cards — the only thing marking
   * them yours was a badge you had to read. A rounded container inset on the
   * page gutter says it before anything is read: this shelf is a different
   * kind of thing from the browse grid beneath.
   */
  myGroupsSection: {
    marginHorizontal: MY_SECTION_MARGIN, marginBottom: 8,
    paddingTop: 12, paddingBottom: 12,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth,
    // Clips the shelf's scrolling cards to the rounded corners.
    overflow: 'hidden',
  },
  myGroupsHeadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, marginBottom: 10,
  },
  // Uppercase and small, like a section label rather than a page title — the
  // page title is "Groups", and two headings at the same weight competed.
  myGroupsHeading: {
    fontSize: 12, fontWeight: '800', letterSpacing: 1,
    textTransform: 'uppercase',
  },
  myGroupsCount: {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  myGroupsCountText: { fontSize: 11, fontWeight: '800' },
  myGroupsList: { paddingHorizontal: 12, gap: MY_CARD_GAP },
  myCard: {
    borderRadius: COMMON_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#111',
    // Edged in the same colour as its role badge — gold for a group you run,
    // blue for one you're in. Which of your groups is which reads at a glance,
    // and a browse card has no edge at all.
    borderWidth: 1.5,
  },
  myCardOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  myCardInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 9, paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  myCardTitle:  { flex: 1, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  myCardMembers: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  myCardMembersText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  myCardBadge:  {
    position: 'absolute', top: 7, left: 7,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: PILL_RADIUS,
  },
  myCardBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  searchRow: {
    flexDirection: 'row', alignItems: 'stretch', gap: 8,
    marginHorizontal: 12, marginTop: 10, marginBottom: 4,
  },
  // Tucked up under the search field; the declined row below brings its own gap.
  filterRow: { marginTop: 4, marginBottom: 10 },
  searchBar: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  declinedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  declinedText:   { flex: 1, fontSize: 13, fontWeight: '600' },
  declinedAction: { fontSize: 13, fontWeight: '800' },

  // The same 12 gutter as My Groups and the search row above.
  cardRow:  { gap: 8, marginBottom: 8, paddingHorizontal: MY_SECTION_MARGIN },
  card: {
    flex: 1, borderRadius: COMMON_RADIUS, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardBanner: { width: '100%', aspectRatio: 3 / 2 },
  cardBody:   { padding: 8 },
  cardTitle:  { fontSize: 13, fontWeight: '700' },
  cardSub:    { fontSize: 12, marginTop: 2 },
  cardRegion: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', maxWidth: '100%',
    marginTop: 6, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: PILL_RADIUS,
  },
  cardRegionText: { fontSize: 10.5, fontWeight: '700', flexShrink: 1 },

  emptyWrap: { paddingTop: 20 },

  headingWrap: { paddingHorizontal: 12, marginBottom: 4 },
});
