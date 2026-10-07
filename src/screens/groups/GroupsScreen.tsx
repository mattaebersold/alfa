import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, Dimensions,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { Image } from 'expo-image';
import OilSheen from '../../components/ui/OilSheen';
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
import {
  COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK, COLOR_GRAY_17, COLOR_MEMBER_BLUE, COLOR_PRO, COLOR_WHITE, GUTTER, COLOR_GRAY_40, COLOR_HUE_SEAFOAM, COLOR_HUE_CORNFLOWER, COLOR_HUE_CLAY, COLOR_HUE_ORCHID, COLOR_HUE_LAVENDER, COLOR_HUE_ROSE, COLOR_HUE_STEEL, COLOR_HUE_RASPBERRY,
} from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<AppStackParamList>;
import { SkeletonGrid, SkeletonRow } from '../../components/ui/Skeleton';

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

const ADMIN_BADGE = { label: 'ADMIN', bg: COLOR_PRO, fg: COLOR_BLACK };
const MEMBER_BADGE = { label: 'MEMBER', bg: COLOR_MEMBER_BLUE, fg: COLOR_WHITE };

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
/**
 * A region's badge colour — steady per region, from the app's hue palette,
 * hashed from the key so a region added later still gets one.
 */
const REGION_HUES = [
  COLOR_HUE_SEAFOAM, COLOR_HUE_CORNFLOWER, COLOR_HUE_CLAY, COLOR_HUE_ORCHID,
  COLOR_HUE_LAVENDER, COLOR_HUE_ROSE, COLOR_HUE_STEEL, COLOR_HUE_RASPBERRY,
];
function regionColor(key?: string | null): string {
  if (!key) return COLOR_HUE_STEEL;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return REGION_HUES[h % REGION_HUES.length];
}

function GroupCard({ group, onPress }: {
  group: Group;
  onPress: (origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const banner = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  const region = regionLabel(group.region);
  return (
    // Built like a marketplace card: a bordered card, its picture rounded
    // all round, and the words on a lighter panel under it.
    <SummaryTouchable
      // One ground for the whole card — the words' panel colour, so it shows
      // the same around the picture's rounded corners as under it.
      style={[styles.card, { backgroundColor: COLOR_GRAY_40, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityLabel={group.title ?? 'Group'}
    >
      <View style={styles.cardBannerWrap}>
        {banner
          ? <Image source={{ uri: banner }} style={styles.cardBanner} contentFit="cover" />
          : <View style={[styles.cardBanner, { backgroundColor: colors.primaryAlt + '55' }]} />
        }
        {/* Where it is, on the picture's bottom left — each region its own
            colour, as a listing's category is. */}
        {region ? (
          <View style={[styles.cardRegion, { backgroundColor: regionColor(group.region) }]}>
            <MapPin size={10} color={COLOR_BLACK} strokeWidth={2.4} />
            <Text style={styles.cardRegionText} numberOfLines={1}>{region}</Text>
          </View>
        ) : null}
        {/* How many are in it, bottom right — as on your own groups' cards. */}
        {typeof group.member_count === 'number' ? (
          <View style={styles.cardMembers}>
            <Users size={11} color={COLOR_WHITE} />
            <Text style={styles.cardMembersText}>{group.member_count}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.fg }]} numberOfLines={1}>{group.title}</Text>
        {group.subtitle && <Text style={[styles.cardSub, { color: colors.muted }]} numberOfLines={1}>{group.subtitle}</Text>}
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
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
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

  if (userGroupsLoading || allGroupsLoading) {
    return (
      <View style={[styles.content, { backgroundColor: colors.cream, paddingTop: headerPad, paddingHorizontal: GUTTER }]}>
        <SkeletonRow count={3} size={88} radius={COMMON_RADIUS} style={{ marginBottom: 20 }} />
        <SkeletonGrid count={6} ratio={1.1} />
      </View>
    );
  }

  return (
    <>
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
              </View>


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
    </>
  );
}

/** A card's corners, and its picture's — a touch tighter than the app's radius at this size. */
const CARD_RADIUS = 14;

const styles = StyleSheet.create({
  content: { flex: 1 },
  list:    { paddingBottom: 32 },

  screenTitleBar: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { fontSize: 20, fontFamily: FONT_INTER.bold, letterSpacing: 0.3 },

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
  // A pill, the filter's height, taking the rest of the row.
  searchBar: {
    flex: 1, minWidth: 0, height: 38,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14,
    borderRadius: PILL_RADIUS, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  declinedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: GUTTER, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  declinedText:   { flex: 1, fontSize: 13, fontFamily: FONT_INTER.semibold },
  declinedAction: { fontSize: 13, fontFamily: FONT_INTER.extrabold },

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
  cardSub:    { fontSize: 12, marginTop: 2 },
  // On the picture's bottom left, lifted off it like the marketplace's price.
  cardRegion: {
    position: 'absolute', left: 6, bottom: 6, maxWidth: '62%',
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: PILL_RADIUS,
    boxShadow: '0px 4px 18px 2px rgba(0, 0, 0, 0.35)',
  },
  cardRegionText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_BLACK, flexShrink: 1 },
  // Bottom right, on a dark disc so it reads over any picture.
  cardMembers: {
    position: 'absolute', right: 6, bottom: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cardMembersText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },

  emptyWrap: { paddingTop: 20 },

  headingWrap: { paddingHorizontal: GUTTER, marginBottom: 4 },
});
