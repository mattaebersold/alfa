import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, TextInput, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Users, MapPin, Check, Ban } from 'lucide-react-native';
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
import ScreenHeading from '../../components/ui/ScreenHeading';
import NewGroupSheet from '../../components/groups/NewGroupSheet';
import DeclinedInvitesSheet from '../../components/groups/DeclinedInvitesSheet';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { Group } from '../../types/api';
import { REGIONS, regionKey, regionLabel } from '../../constants/regions';
import SharedModal from '../../components/ui/SharedModal';

/** What the filter button says once something is chosen. */
function regionButtonLabel(key: string) {
  if (key === 'none') return 'No region';
  return REGIONS.find((r) => r.key === key)?.label ?? key;
}

/** Every choice the filter offers, in the order it offers them. */
const REGION_CHOICES: { key: string | null; label: string }[] = [
  { key: null,   label: 'All regions' },
  ...REGIONS.map((r) => ({ key: r.key, label: r.label })),
  { key: 'none', label: 'No region' },
];
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Near enough to full width to read as a row of cards you page through rather
// than a shelf you scan — the sliver of the next one is what says there is one.
const MY_CARD_WIDTH = SCREEN_WIDTH * 0.9;
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
        {regionLabel(group.region) && (
          <Text style={[styles.cardRegion, { color: colors.grey }]}>{regionLabel(group.region)}</Text>
        )}
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
    <TouchableOpacity
      style={[styles.myCard, { borderColor: badge.bg }]}
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
  /**
   * Region filter. `null` is every region; `'none'` is the groups that
   * deliberately belong to no region, which is a real answer rather than
   * missing data — an online-only club has no region on purpose.
   */
  const [region, setRegion] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [declinedOpen, setDeclinedOpen] = useState(false);

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
      (regionLabel(g.region) ?? '').toLowerCase().includes(searchLower)
    ))
    .filter((g) => {
      if (!region) return true;
      // Groups created before regions were a fixed set carry free text, so
      // this matches the key or its label rather than only the key.
      const key = regionKey(g.region);
      return region === 'none' ? !key : key === region;
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
                <ScreenHeading title="Groups" />
              </View>

              {/* Full width and beneath the title, matching Add Car and Add
                  Content: the same kind of button doing the same kind of job,
                  and as a pill beside the heading it read as a secondary
                  control on a screen whose whole point it is. */}
              {isPro && (
                <TouchableOpacity
                  style={[styles.newGroupBtn, { backgroundColor: brand }]}
                  onPress={() => setNewGroupOpen(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new group"
                >
                  <Plus size={17} color={brandTextColor} strokeWidth={2.6} />
                  <Text style={[styles.newGroupText, { color: brandTextColor }]}>New Group</Text>
                </TouchableOpacity>
              )}
              {userGroups.length > 0 && (
                <View style={[
                  styles.myGroupsSection,
                  { backgroundColor: colors.card, borderBottomColor: colors.borderDark },
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
                      <MyGroupCard key={item.internal_id} group={item} onPress={() => goToGroup(item.internal_id)} />
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

                {/* One button rather than a row of chips: there are six
                    options and they don't combine, so a row would take a line
                    of its own next to a search field that already has one.
                    Selected, it carries the region's name so the filter is
                    visible without opening anything. */}
                <TouchableOpacity
                  style={[
                    styles.regionBtn,
                    region
                      ? { backgroundColor: brand, borderColor: brand }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setRegionOpen(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={region ? `Region: ${regionButtonLabel(region)}` : 'Filter by region'}
                >
                  <MapPin size={14} color={region ? brandTextColor : colors.grey} />
                  <Text
                    style={[styles.regionBtnText, { color: region ? brandTextColor : colors.grey }]}
                    numberOfLines={1}
                  >
                    {region ? regionButtonLabel(region) : 'Region'}
                  </Text>
                </TouchableOpacity>
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
            <GroupCard group={item} onPress={() => goToGroup(item.internal_id)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <EmptyState title={search ? 'No groups match your search' : 'No groups'} />
            </View>
          }
        />
      </View>

      <DeclinedInvitesSheet
        visible={declinedOpen}
        onClose={() => setDeclinedOpen(false)}
      />

      <SharedModal
        visible={regionOpen}
        onClose={() => setRegionOpen(false)}
        title="Filter by region"
      >
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {REGION_CHOICES.map((choice) => {
            const on = region === choice.key;
            return (
              <TouchableOpacity
                key={choice.key ?? 'all'}
                style={[styles.regionSheetRow, { borderBottomColor: colors.border }]}
                onPress={() => { setRegion(choice.key); setRegionOpen(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.regionSheetText, { color: '#FFFFFF' }]}>{choice.label}</Text>
                {on && <Check size={17} color={brand} strokeWidth={3} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SharedModal>

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
   * them yours was a badge you had to read. A recessed band with a rule under
   * it says it before anything is read: this strip is a different kind of
   * thing from the browse grid beneath.
   */
  myGroupsSection: {
    paddingTop: 14, paddingBottom: 14, marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    width: MY_CARD_WIDTH,
    height: 200,
    borderRadius: 14,
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

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginVertical: 10,
  },
  searchBar: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  regionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    // Same height as the field beside it, and capped so a long region name
    // shortens rather than squeezing the search box.
    maxWidth: 138,
    paddingHorizontal: 11, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  regionBtnText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  regionSheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  regionSheetText: { flex: 1, fontSize: 15, fontWeight: '600' },
  declinedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginBottom: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  declinedText:   { flex: 1, fontSize: 13, fontWeight: '600' },
  declinedAction: { fontSize: 13, fontWeight: '800' },

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

  // Sits in the heading row beside the title, so it stays small enough not to
  // compete with it while still reading as the primary action.
  headingWrap: { paddingHorizontal: 12 },
  // Squared off at 10 to match Add Car and Add Content — the same button on
  // three screens should be the same button.
  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginHorizontal: 12, marginBottom: 14,
    paddingVertical: 12, borderRadius: 10,
  },
  newGroupText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
});
