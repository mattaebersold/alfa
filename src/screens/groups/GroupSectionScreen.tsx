import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronDown, ChevronUp, Search, X, MoreVertical, Plus } from 'lucide-react-native';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useGetGroupForumQuery,
  useGetGroupNewsQuery,
  useGetGroupResourcesQuery,
  useGetEventsQuery,
  useGetGroupCarsQuery,
  useGetRoutesQuery,
  useGetUserGarageQuery,
  useUpdateCarGroupMutation,
  useGetPostsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import GroupItemDetailModal from '../../components/groups/GroupItemDetailModal';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { CATEGORY_LABELS } from '../../components/ui/Badge';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import GroupSettingsSheet from '../../components/groups/GroupSettingsSheet';
import GroupCreateSheet, { type CreateKind } from '../../components/groups/GroupCreateSheet';
import RecordRow from '../../components/social/RecordRow';
import { colors, withAlpha } from '../../constants/colors';
import FollowButton from '../../components/social/FollowButton';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import RouteTrace from '../../components/routes/RouteTrace';
import { formatDistance, curvinessLabel } from '../../utils/routeGeometry';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;
type ActiveTab = 'posts' | 'forum' | 'news' | 'members' | 'cars' | 'events' | 'routes' | 'market' | 'resources';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'forum',     label: 'Forum' },
  { key: 'news',      label: 'News' },
  { key: 'members',   label: 'Members' },
  { key: 'cars',      label: 'Cars' },
  { key: 'events',    label: 'Events' },
  { key: 'routes',    label: 'Routes' },
  { key: 'market',    label: 'Market' },
  { key: 'resources', label: 'Resources' },
];

const TABBAR_SENTINEL = { _t: 'tabbar' } as const;

const RESOURCE_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',     label: 'General' },
  { key: 'exterior',    label: 'Exterior' },
  { key: 'interior',    label: 'Interior' },
  { key: 'engine',      label: 'Engine' },
  { key: 'electrical',  label: 'Electrical' },
  { key: 'performance', label: 'Performance' },
  { key: 'suspension',  label: 'Suspension' },
  { key: 'brakes',      label: 'Brakes' },
  { key: 'visual',      label: 'Visual Mods' },
  { key: 'mechanics',   label: 'Shop/Mechanic' },
];
const RESOURCE_CAT_LABEL: Record<string, string> = RESOURCE_CATEGORIES.reduce(
  (acc, cat) => { acc[cat.key] = cat.label; return acc; }, {} as Record<string, string>
);

const FORUM_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',    label: 'General' },
  { key: 'engine',     label: 'Engine' },
  { key: 'chassis',    label: 'Chassis' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'body',       label: 'Body' },
  { key: 'mods',       label: 'Mods' },
];
const NEWS_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',       label: 'General' },
  { key: 'meets',         label: 'Meets' },
  { key: 'announcements', label: 'Announcements' },
];

// Categorised tabs share one filter bar + sort-by-category behaviour.
// Posts carry the app-wide content categories rather than a group-specific set.
// The bar filters this down to what's actually present, so listing them all is
// safe — a category nobody used simply never appears.
const POST_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label }));

const CATEGORY_LISTS: Record<string, { key: string; label: string }[]> = {
  posts: POST_CATEGORIES,
  forum: FORUM_CATEGORIES,
  news: NEWS_CATEGORIES,
  resources: RESOURCE_CATEGORIES,
};
const CATEGORIZED_TABS = ['posts', 'forum', 'news', 'resources'];
/** Tabs whose rows are collected into a collapsible card per category. */
const GROUPED_TABS = ['forum', 'resources'];
/** How far a category card is held off the screen edges, and its corner radius. */
const GROUP_INSET = 12;
const GROUP_RADIUS = 14;
/** Leading pad of the tab row — subtracted so a scrolled-to pill sits flush. */
const TAB_ROW_PAD = 12;
/**
 * Extra slack left to the active pill's left, so the tail of the previous tab
 * stays visible — otherwise the row reads as if it starts at the active tab.
 */
const TAB_PEEK = 26;
const catList = (tab: string) => CATEGORY_LISTS[tab] ?? [];
const catLabel = (tab: string, key?: string) =>
  catList(tab).find((cat) => cat.key === (key ?? 'general'))?.label ?? key;
const catOrder = (tab: string, key?: string) => {
  const i = catList(tab).findIndex((cat) => cat.key === (key ?? 'general'));
  return i === -1 ? 999 : i;
};

// Extract a YouTube video id from common URL forms (watch, youtu.be, embed, shorts).
function youtubeId(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function GroupSectionScreen() {
  const route = useRoute<{ key: string; name: string; params: { groupId: string; groupTitle: string; initialTab: string } }>();
  const { groupId, groupTitle, initialTab } = route.params;
  const navigation = useNavigation<AppNav>();
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [tab, setTab] = useState<ActiveTab>((initialTab as ActiveTab) ?? 'posts');
  const [search, setSearch] = useState('');
  const [showCarModal, setShowCarModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  // Which category a new item starts in — set when the plus is tapped on a
  // category header, left null for the banner's plus.
  const [createCategory, setCreateCategory] = useState<string | null>(null);
  // Empty means every category is open; collapsing is a per-visit choice.
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [detailItem, setDetailItem] = useState<any>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const { data: group } = useGetGroupQuery(groupId);
  const banner = firstGalleryUrl(group?.banners) ?? firstGalleryUrl(group?.gallery);
  const { data: members = [] } = useGetGroupMembersQuery(groupId);
  const { data: garageData }   = useGetUserGarageQuery(undefined, { skip: !showCarModal });
  const [updateCarGroup, { isLoading: updatingCarGroup }] = useUpdateCarGroupMutation();

  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  // Active admins only. Without the status check an invited-but-not-joined
  // admin would see Settings before actually being in the group.
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin' && m.status === 'active');

  // Lazy per-tab fetches
  const { data: postsData,     isFetching: postsFetching }     = useGetPostsQuery({ group_id: groupId, limit: 30 }, { skip: tab !== 'posts' });
  const { data: forumData,     isFetching: forumFetching }     = useGetGroupForumQuery({ groupId }, { skip: tab !== 'forum' });
  const { data: newsData,      isFetching: newsFetching }      = useGetGroupNewsQuery({ groupId }, { skip: tab !== 'news' });
  const { data: resourcesData, isFetching: resourcesFetching } = useGetGroupResourcesQuery({ groupId }, { skip: tab !== 'resources' });
  const { data: eventsData,    isFetching: eventsFetching }    = useGetEventsQuery({ limit: 20, group_id: groupId }, { skip: tab !== 'events' });
  const { data: carsData,      isFetching: carsFetching }      = useGetGroupCarsQuery(groupId, { skip: tab !== 'cars' });
  // Routes tagged with this group. The association lives in the shared Tag
  // collection, so the API resolves it rather than the route carrying a group_id.
  const { data: routesData,    isFetching: routesFetching }    = useGetRoutesQuery({ group_id: groupId, sort: 'votes', limit: 30 }, { skip: tab !== 'routes' });
  const { data: marketData,    isFetching: marketFetching }    = useGetPostsQuery({ group_id: groupId, type: 'listing', limit: 30 }, { skip: tab !== 'market' });

  /**
   * Brings the active pill to the left edge of the tab row.
   *
   * Offsets come from each pill's own onLayout rather than being computed from
   * label widths — the pills size to their text, so measuring is the only way
   * to know. `layout.x` is relative to the content container, which is the
   * coordinate space scrollTo wants.
   */
  const tabScrollRef = useRef<ScrollView>(null);
  const tabOffsets = useRef<Record<string, number>>({});
  const didInitialTabScroll = useRef(false);

  const scrollTabIntoView = (key: string, animated = true) => {
    const x = tabOffsets.current[key];
    if (x == null) return;
    tabScrollRef.current?.scrollTo({ x: Math.max(0, x - TAB_ROW_PAD - TAB_PEEK), animated });
  };

  const onTabLayout = (key: string, x: number) => {
    tabOffsets.current[key] = x;
    // The tab a screen opens on can be anywhere in the row; bring it into view
    // once its position is known, without an animation on first paint.
    if (key === tab && !didInitialTabScroll.current) {
      didInitialTabScroll.current = true;
      scrollTabIntoView(key, false);
    }
  };

  const openListingMenu = (listing: any) => {
    const seller = listing.user ?? listing.user_objectid;
    const options: { text: string; style?: 'cancel'; onPress?: () => void }[] = [
      {
        text: 'View listing',
        onPress: () => (navigation as any).navigate('PostDetailModal', { postId: listing.internal_id }),
      },
    ];
    // No point offering to message yourself about your own listing.
    if (seller?.user_id && seller.user_id !== userInfo?.user_id) {
      options.push({
        text: 'Message seller',
        onPress: () => (navigation as any).navigate('ComposeMessage', {
          userId: seller.user_id,
          username: seller.username,
          subject: listing.title,
        }),
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(listing.title ?? 'Listing', undefined, options);
  };

  const openCreateIn = (category: string | null) => {
    setCreateCategory(category);
    setCreateOpen(true);
  };

  const switchTab = (newTab: ActiveTab) => {
    setTab(newTab);
    scrollTabIntoView(newTab);
    setSearch('');
    setCatFilter(null);
    listRef.current?.scrollToIndex({ index: 0, animated: false });
  };

  const visibleTabs = [...TABS, ...(isAdmin ? [{ key: 'settings', label: 'Settings' }] : [])];

  const openMemberMenu = (m: any) => {
    const username = m.user?.username;
    Alert.alert(username ? `@${username}` : 'Member', undefined, [
      {
        text: 'Message user',
        onPress: () => (navigation as any).navigate('ComposeMessage', { userId: m.user_id, username }),
      },
      {
        text: 'View profile',
        onPress: () => (navigation as any).navigate('UserDetail', { userId: m.user_id, username }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const SEARCHABLE_TABS: ActiveTab[] = ['posts', 'forum', 'members', 'cars', 'market', 'resources'];
  const showSearch = SEARCHABLE_TABS.includes(tab);

  /**
   * Which "new" the banner's plus offers, or null when the tab has none.
   *
   * News is admin-only — the server rejects it from anyone else, so offering
   * the form would just be a trip to an error.
   */
  const createKind: CreateKind | null =
    tab === 'posts' ? 'posts'
    : tab === 'forum' ? 'forum'
    : tab === 'resources' ? 'resources'
    : tab === 'news' && isAdmin ? 'news'
    : null;

  // ── Banner header ────────────────────────────────────────────────────────────
  // Mirrors the group home: the cover behind, the group named small, and the
  // section you're in as the page title.
  const sectionLabel = visibleTabs.find((t) => t.key === tab)?.label ?? '';

  const compactHeader = (
    <View style={styles.headerWrap}>
      {banner
        ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: c.primaryAlt }]} />}
      {/* Wash + fade to the card colour the tab bar sits on, so the image
          resolves into the chrome instead of stopping at a hard edge. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.card, 0.22) }]} pointerEvents="none" />
      {/* Darkens under the status bar so the clock and indicators stay legible
          over a bright cover. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
        style={styles.headerTopScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[withAlpha(c.card, 0), withAlpha(c.card, 0.8), c.card]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.headerContent}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backCircle, { backgroundColor: withAlpha(c.card, 0.6), borderColor: c.borderDark }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to group home"
        >
          <ChevronLeft size={22} color={c.fg} />
        </TouchableOpacity>
        <Text style={[styles.groupName, { color: c.grey }]} numberOfLines={1}>{groupTitle}</Text>
        <Text style={[styles.sectionTitle, { color: c.fg }]} numberOfLines={1}>{sectionLabel}</Text>
      </View>

      {/* Creates whatever section you're in. Hidden on the tabs that have no
          "new" of their own — members, cars, events, routes and market are all
          composed elsewhere. */}
      {createKind && (
        <TouchableOpacity
          style={[styles.bannerAddBtn, { backgroundColor: c.pro }]}
          onPress={() => openCreateIn(null)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`New ${sectionLabel}`}
        >
          <Plus size={22} color="#000000" strokeWidth={3} />
        </TouchableOpacity>
      )}
    </View>
  );

  let rawItems: any[] = [];
  switch (tab) {
    case 'posts':     rawItems = postsData?.entries ?? [];     break;
    case 'forum':     rawItems = forumData?.entries ?? [];     break;
    case 'news':      rawItems = newsData?.entries ?? [];      break;
    case 'resources': rawItems = resourcesData?.entries ?? []; break;
    case 'events':    rawItems = eventsData?.entries ?? [];    break;
    case 'cars':      rawItems = carsData?.entries ?? [];      break;
    case 'routes':    rawItems = routesData?.entries ?? [];    break;
    case 'market':    rawItems = marketData?.entries ?? [];    break;
    // Admins lead; everyone else keeps the order the server sent. Matches the
    // roster pane on the group home.
    case 'members':
      rawItems = members
        .filter((m) => m.status === 'active')
        .sort((a, b) => (a.member_type === 'admin' ? 0 : 1) - (b.member_type === 'admin' ? 0 : 1));
      break;
  }

  // Computed up here rather than beside the list: the category bar lives inside
  // the tab bar now, so its inputs have to exist before that element is built.
  const showCatFilters = CATEGORIZED_TABS.includes(tab) && (rawItems.length > 0 || !!catFilter);
  const presentCats = new Set(rawItems.map((r: any) => r.category ?? 'general'));

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const tabBar = (
    <View style={{ backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {visibleTabs.map((t) => {
          if (t.key === 'settings') {
            return (
              <TouchableOpacity
                key="settings"
                style={[styles.tabPill, { borderColor: c.borderDark }]}
                onPress={() => setSettingsOpen(true)}
                onLayout={(e) => onTabLayout('settings', e.nativeEvent.layout.x)}
              >
                <Text style={[styles.tabPillText, { color: c.grey }]}>Settings</Text>
              </TouchableOpacity>
            );
          }
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[
                styles.tabPill,
                { borderColor: c.borderDark },
                isActive && { backgroundColor: c.primaryAlt, borderColor: c.primaryAlt },
              ]}
              onPress={() => switchTab(t.key as ActiveTab)}
              onLayout={(e) => onTabLayout(t.key, e.nativeEvent.layout.x)}
            >
              <Text style={[styles.tabPillText, { color: isActive ? contrastText(c.primaryAlt) : c.grey }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Category filter — under the tabs, above the search, so the narrowing
          reads top-down: section → category → text. */}
      {showCatFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { borderTopColor: c.borderDark }]}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              { borderColor: c.borderDark, backgroundColor: c.secondary },
              !catFilter && { backgroundColor: c.primaryAlt, borderColor: c.primaryAlt },
            ]}
            onPress={() => setCatFilter(null)}
          >
            <Text style={[styles.filterChipText, { color: !catFilter ? contrastText(c.primaryAlt) : c.fg }]}>All</Text>
          </TouchableOpacity>
          {catList(tab).filter((cat) => presentCats.has(cat.key) || catFilter === cat.key).map((cat) => {
            const active = catFilter === cat.key;
            const tint = categoryColor(cat.key);
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.filterChip,
                  { borderColor: c.borderDark, backgroundColor: c.secondary },
                  active && { backgroundColor: tint, borderColor: tint },
                ]}
                onPress={() => setCatFilter(cat.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? pillTextColor(tint) : c.fg }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {showSearch && (
        <View style={[styles.searchWrap, { borderTopColor: c.border }]}>
          <Search size={15} color={c.grey} />
          <TextInput
            style={[styles.searchInput, { color: c.fg }]}
            value={search}
            onChangeText={setSearch}
            placeholder={`Search ${tab}…`}
            placeholderTextColor={c.grey}
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      )}
    </View>
  );

  // ── Render items ─────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item._t === 'tabbar') return tabBar;
    if (item._t === 'catHeader') return (
      <View style={[
        styles.catHeader,
        { backgroundColor: c.secondary },
        // Collapsed, no rows follow to close the card off.
        item.collapsed && styles.catHeaderClosed,
      ]}>
        <Text style={[styles.catHeaderText, { color: c.fg }]}>{catLabel(item.tab, item.category)}</Text>
        <View style={[styles.catCount, { backgroundColor: c.borderDark }]}>
          <Text style={[styles.catCountText, { color: c.fg }]}>{item.count}</Text>
        </View>
        <View style={ss.fill} />
        <TouchableOpacity
          onPress={() => openCreateIn(item.category)}
          hitSlop={10}
          style={[styles.catAdd, { borderColor: c.pro }]}
          accessibilityRole="button"
          accessibilityLabel={`New post in ${catLabel(item.tab, item.category)}`}
        >
          <Plus size={14} color={c.pro} strokeWidth={3} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCollapsedCats((prev) => ({ ...prev, [item.category]: !prev[item.category] }))}
          hitSlop={10}
          style={styles.catCaret}
          accessibilityRole="button"
          accessibilityLabel={`${item.collapsed ? 'Expand' : 'Collapse'} ${catLabel(item.tab, item.category)}`}
        >
          {/* Two icons rather than one rotated by a transform — a transformed
              SVG reserves its space but draws nothing. */}
          {item.collapsed
            ? <ChevronDown size={16} color={c.grey} />
            : <ChevronUp size={16} color={c.grey} />}
        </TouchableOpacity>
      </View>
    );
    if (item._t === 'carsCta') return (
      <TouchableOpacity style={[styles.carsCta, { backgroundColor: c.card, borderColor: c.primaryAlt }]} onPress={() => setShowCarModal(true)} activeOpacity={0.8}>
        <Text style={[styles.carsCtaText, { color: c.primaryAlt }]}>Add your car(s) to this group</Text>
      </TouchableOpacity>
    );
    if (item._tab === 'loading') return <ActivityIndicator size="large" color={c.primaryAlt} style={styles.loader} />;
    if (item._tab === 'empty')   return <EmptyState title={`No ${tab} yet`} />;

    const d = item.data;

    if (item._tab === 'posts') {
      const hero = firstGalleryUrl(d.gallery);
      const user = d.user ?? d.user_objectid;
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        // The same row a car's Records pane uses. The author rides in the meta
        // line, since who posted matters more here than on your own car.
        <View style={{ backgroundColor: c.card }}>
          <RecordRow
            title={d.title ?? (d.body ? stripHtml(d.body) : null)}
            imageUri={hero}
            meta={[user?.username ? `@${user.username}` : null, timeAgo].filter(Boolean).join(' · ')}
            category={d.category}
            onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })}
          />
        </View>
      );
    }

    if (item._tab === 'forum') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        // Avatar demoted to the byline: at 38px leading the row it competed
        // with the title, and voting now lives in the detail pane.
        <TouchableOpacity
          style={[
            styles.groupedRow,
            {
              backgroundColor: c.card,
              borderBottomColor: c.borderDark,
              borderBottomWidth: item.isLast ? 0 : StyleSheet.hairlineWidth,
            },
            item.isLast && styles.groupedRowLast,
          ]}
          onPress={() => setDetailItem({ _kind: 'forum', data: d })}
          activeOpacity={0.8}
        >
          <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
          <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body ?? '')}</Text>
          <View style={styles.forumByline}>
            <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={20} />
            <Text style={[styles.metaText, { color: c.grey }]} numberOfLines={1}>
              @{d.user?.username} · {timeAgo}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'news') {
      const hero = firstGalleryUrl(d.gallery);
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <TouchableOpacity style={[styles.newsCard, { backgroundColor: c.card }]} onPress={() => setDetailItem({ _kind: 'news', data: d })} activeOpacity={0.85}>
          {hero && <Image source={{ uri: hero }} style={styles.newsImage} contentFit="cover" />}
          {/* Two-line body and an avatar byline, so news reads the same way as
              forum and resources do. */}
          <View style={styles.newsPad}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text>}
            <View style={styles.forumByline}>
              <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={20} />
              <Text style={[styles.metaText, { color: c.grey }]} numberOfLines={1}>
                {d.user?.username ? `@${d.user.username} · ` : ''}{timeAgo}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'resources') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        // Inside a category card now, so the category chip is redundant — the
        // header above it already says which one this is.
        <TouchableOpacity
          style={[
            styles.groupedRow,
            {
              backgroundColor: c.card,
              borderBottomColor: c.borderDark,
              borderBottomWidth: item.isLast ? 0 : StyleSheet.hairlineWidth,
            },
            item.isLast && styles.groupedRowLast,
          ]}
          onPress={() => setDetailItem({ _kind: 'resource', data: d })}
          activeOpacity={0.8}
        >
          <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
          {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text>}
          <View style={styles.forumByline}>
            <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={20} />
            <Text style={[styles.metaText, { color: c.grey }]} numberOfLines={1}>
              {d.user?.username ? `@${d.user.username} · ` : ''}{timeAgo}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }


    if (item._tab === 'routes') {
      const stats = d.stats;
      return (
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => (navigation as any).navigate('RouteDetailModal', { routeId: d.internal_id })}
          activeOpacity={0.8}
        >
          <RouteTrace polyline={d.polyline} speeds={d.speed_profile} color={c.primaryAlt} style={styles.rowThumb} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title || 'Untitled route'}</Text>
            {stats && (
              <Text style={[styles.metaText, { color: c.grey }]}>
                {formatDistance(stats.distance_meters)} · {curvinessLabel(stats.curviness)} · {d.vote_count ?? 0} votes
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'events') {
      const hero = firstGalleryUrl(d.gallery);
      const date = d.event_date ? format(new Date(d.event_date), 'MMM d, yyyy') : null;
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => (navigation as any).navigate('EventDetailModal', { eventId: d.internal_id })} activeOpacity={0.8}>
          {hero ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" /> : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            {date && <Text style={[styles.metaText, { color: c.grey }]}>{date}</Text>}
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'cars') {
      const hero = firstGalleryUrl(d.gallery) ?? (d.profile_image ? imageUrl(d.profile_image) : null);
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => (navigation as any).navigate('CarDetail', { carId: d.internal_id })} activeOpacity={0.8}>
          {hero ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" /> : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title || [d.year, d.make, d.model].filter(Boolean).join(' ')}</Text>
            {d.user && <Text style={[styles.metaText, { color: c.grey }]}>@{d.user.username}</Text>}
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'market') {
      const hero = firstGalleryUrl(d.gallery);
      const user = d.user ?? d.user_objectid;
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}
          onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })}
          activeOpacity={0.8}
        >
          {hero
            ? <Image source={{ uri: hero }} style={styles.marketThumb} contentFit="cover" />
            : <View style={[styles.marketThumb, { backgroundColor: c.segment }]} />}
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
            {d.title ? <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text> : null}
            {d.price ? (
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>${Number(d.price).toLocaleString()}</Text>
              </View>
            ) : null}
            {d.body ? <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={1}>{stripHtml(d.body)}</Text> : null}
            <View style={styles.forumByline}>
              <Avatar filename={user?.gallery?.[0]?.filename ?? user?.profilePicture} name={user?.username ?? '?'} size={20} />
              <Text style={[styles.metaText, { color: c.grey }]} numberOfLines={1}>
                {user?.username ? `@${user.username} · ` : ''}{timeAgo}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => openListingMenu(d)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.memberMenuBtn}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${d.title ?? 'listing'}`}
          >
            <MoreVertical size={18} color={c.grey} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'members') {
      const isMe = d.user_id === userInfo?.user_id;
      return (
        // A View, not a touchable — the row's actions are the follow button and
        // the menu, matching the roster pane on the group home.
        <View style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.borderDark }]}>
          <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={42} />
          <View style={styles.memberNameWrap}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>@{d.user?.username}</Text>
            {d.member_type === 'admin' && (
              <View style={[styles.adminBadge, { backgroundColor: c.primaryAlt }]}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
          {!isMe && d.user?.username ? <FollowButton username={d.user.username} /> : null}
          <TouchableOpacity
            onPress={() => openMemberMenu(d)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.memberMenuBtn}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${d.user?.username ?? 'member'}`}
          >
            <MoreVertical size={18} color={c.grey} />
          </TouchableOpacity>
        </View>
      );
    }

    return null;
    // `userInfo` matters now that member rows hide the follow button for you.
  }, [tab, c, navigation, groupId, isMember, showCarModal, userInfo?.user_id]);

  // ── Build flat list data ─────────────────────────────────────────────────────
  const isFetchingTab = (
    (tab === 'posts' && postsFetching) ||
    (tab === 'forum' && forumFetching) ||
    (tab === 'news' && newsFetching) ||
    (tab === 'resources' && resourcesFetching) ||
    (tab === 'events' && eventsFetching) ||
    (tab === 'cars' && carsFetching) ||
    (tab === 'market' && marketFetching) ||
    (tab === 'routes' && routesFetching)
  );

  const q = search.trim().toLowerCase();
  const filteredItems = q ? rawItems.filter((item) => {
    const user = item.user ?? item.user_objectid;
    switch (tab) {
      case 'posts': case 'market': return item.title?.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q) || user?.username?.toLowerCase().includes(q);
      case 'forum': return item.title?.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q) || item.user?.username?.toLowerCase().includes(q);
      case 'members': return item.user?.username?.toLowerCase().includes(q);
      case 'cars': return item.make?.toLowerCase().includes(q) || item.model?.toLowerCase().includes(q) || String(item.year ?? '').includes(q) || item.user?.username?.toLowerCase().includes(q);
      case 'resources': return item.title?.toLowerCase().includes(q) || item.body?.toLowerCase().includes(q);
      default: return true;
    }
  }) : rawItems;

  // Forum / News / Resources: filter by category, then sort by category order (newest first within).
  let processedItems = filteredItems;
  if (CATEGORIZED_TABS.includes(tab)) {
    if (catFilter) {
      processedItems = processedItems.filter((r) => (r.category ?? 'general') === catFilter);
    }
    processedItems = [...processedItems].sort((a, b) => {
      const ao = catOrder(tab, a.category);
      const bo = catOrder(tab, b.category);
      if (ao !== bo) return ao - bo;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }

  /**
   * Forum rows, grouped into a card per category — the same shape a car's
   * to-do list uses: a header that caps the group, its rows beneath, and the
   * last one rounding off the bottom.
   *
   * A Map keyed by category preserves the sort order established above, so the
   * cards come out in the order the filter bar lists them.
   */
  const taggedItems = GROUPED_TABS.includes(tab)
    ? (() => {
        const byCat = new Map<string, any[]>();
        processedItems.forEach((item) => {
          const cat = item.category ?? 'general';
          byCat.set(cat, [...(byCat.get(cat) ?? []), item]);
        });
        const rows: any[] = [];
        byCat.forEach((items, cat) => {
          const collapsed = !!collapsedCats[cat];
          rows.push({ _t: 'catHeader', tab, category: cat, count: items.length, collapsed });
          if (collapsed) return;
          items.forEach((item, i) => rows.push({ _tab: tab, data: item, isLast: i === items.length - 1 }));
        });
        return rows;
      })()
    : processedItems.map((item) => ({ _tab: tab, data: item }));

  const contentItems: any[] = isFetchingTab ? [{ _tab: 'loading' }] : taggedItems.length === 0 ? [{ _tab: 'empty' }] : taggedItems;
  const carsCta = (tab === 'cars' && isMember) ? [{ _t: 'carsCta' }] : [];
  const flatData: any[] = [TABBAR_SENTINEL, ...carsCta, ...contentItems];

  const keyExtractor = (item: any, i: number) => {
    if (item._t === 'tabbar') return '__tabbar';
    if (item._t === 'catHeader') return `__cat-${item.category}`;
    if (item._t === 'resourceFilters') return '__resourceFilters';
    if (item._t === 'carsCta') return '__carsCta';
    if (item._tab === 'loading') return '__loading';
    if (item._tab === 'empty') return '__empty';
    return item.data?.internal_id ?? item.data?.user_id ?? String(i);
  };

  // Content is gated to active members — pending/non-members see a prompt.
  if (!isMember) {
    return (
      <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['top', 'bottom']}>
        {compactHeader}
        <View style={styles.gate}>
          <EmptyState
            title="Members only"
            message={isAdmin ? undefined : 'Join this group and get approved to see its content.'}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Bottom edge only — the banner runs under the status bar, and the header
  // content pads itself past the top inset.
  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['bottom']}>
      {compactHeader}
      <FlatList
        ref={listRef}
        data={flatData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        // Without a flex the list sizes to its content and overflows the
        // banner-plus-list column, so the tail is clipped rather than scrollable.
        style={ss.fill}
        contentContainerStyle={styles.list}
        onScrollToIndexFailed={() => {}}
      />

      {/* Add cars to group modal */}
      <Modal visible={showCarModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCarModal(false)}>
        <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['top', 'bottom']}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.fg }]}>Your Cars</Text>
            <TouchableOpacity onPress={() => setShowCarModal(false)} hitSlop={10}>
              <Text style={[styles.modalDone, { color: c.primaryAlt }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: c.grey }]}>Toggle a car to add or remove it from this group.</Text>
          <FlatList
            data={garageData?.entries ?? []}
            keyExtractor={(item) => item.internal_id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<EmptyState title="No cars in your garage" message="Add a car first." />}
            renderItem={({ item: car }) => {
              const inGroup = car.group_id === groupId;
              const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
              return (
                <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={async () => { await updateCarGroup({ carId: car.internal_id, groupId: inGroup ? null : groupId }); }} disabled={updatingCarGroup} activeOpacity={0.8}>
                  {hero ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" /> : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{car.title || [car.year, car.make, car.model].filter(Boolean).join(' ')}</Text>
                  </View>
                  <View style={[styles.toggleDot, { borderColor: c.border }, inGroup && { backgroundColor: c.primaryAlt }]}>
                    {inGroup && <View style={styles.toggleCheck} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Forum / News / Resource detail ── */}
      <GroupItemDetailModal
        visible={!!detailItem}
        item={detailItem?.data ?? null}
        kind={detailItem?._kind ?? null}
        categoryLabel={detailItem ? catLabel(detailItem._kind === 'resource' ? 'resources' : detailItem._kind, detailItem.data?.category) : null}
        onClose={() => setDetailItem(null)}
      />

      <GroupSettingsSheet
        groupId={groupId}
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {createKind && (
        <GroupCreateSheet
          kind={createKind}
          groupId={groupId}
          groupTitle={groupTitle}
          categories={catList(createKind)}
          initialCategory={createCategory ?? undefined}
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // flexGrow so an empty or short section still fills the screen rather than
  // leaving the page background showing under it.
  list:           { flexGrow: 1, paddingBottom: 40 },
  gate:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Shorter than the group home's cover — this is a section header, and the
  // tab row has to stay reachable without scrolling.
  // Taller than the visible band suggests: it starts under the status bar now,
  // so the inset eats the top of it.
  headerWrap:     { width: '100%', aspectRatio: 2 / .9, justifyContent: 'flex-end' },
  headerTopScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%' },
  bannerAddBtn:   {
    position: 'absolute', right: 16, bottom: 12,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 6, elevation: 6,
  },
  headerContent:  { paddingHorizontal: 16, paddingBottom: 12, gap: 6, alignItems: 'flex-start' },
  backCircle:     {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  groupName:      { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  sectionTitle:   { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },

  tabRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  tabPill:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  tabPillText:    { fontSize: 13, fontWeight: '700' },

  // The name column absorbs the squeeze so the follow button and menu keep
  // their full width on a long username.
  memberNameWrap: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  memberMenuBtn:  { padding: 2 },

  // A listing leads with its photo, so it gets the same room a record does.
  marketThumb:    { width: 100, height: 100, borderRadius: 10 },
  // Green fill, black label — the price is the one thing you scan a listing for.
  pricePill:      {
    alignSelf: 'flex-start',
    backgroundColor: colors.green,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  pricePillText:  { fontSize: 13, fontWeight: '800', color: '#000000' },

  // A card per category, the same shape a car's to-do list uses: lighter cap,
  // rows beneath, inset from both edges so the group reads as one object.
  catHeader:      {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 10,
    marginTop: 16, marginHorizontal: GROUP_INSET,
    borderTopLeftRadius: GROUP_RADIUS, borderTopRightRadius: GROUP_RADIUS,
  },
  catHeaderClosed:{ borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
  catHeaderText:  { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },
  catCount:       {
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  catCountText:   { fontSize: 11, fontWeight: '800' },
  catAdd:         {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  catCaret:       { padding: 2 },

  groupedRow:     { paddingHorizontal: 14, paddingVertical: 12, gap: 5, marginHorizontal: GROUP_INSET },
  groupedRowLast: { borderBottomLeftRadius: GROUP_RADIUS, borderBottomRightRadius: GROUP_RADIUS },
  forumByline:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },


  searchWrap:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  searchInput:    { flex: 1, fontSize: 14, paddingVertical: 0 },

  loader:         { marginVertical: 40 },

  rowTitle:       { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  rowBody:        { fontSize: 13, lineHeight: 18, marginBottom: 3 },
  rowMeta:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText:       { fontSize: 12 },
  rowThumb:       { width: 72, height: 52, borderRadius: 8 },

  newsCard:       { marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  newsImage:      { width: '100%', aspectRatio: 16 / 9 },
  // Gap rather than per-child margins, matching the forum and resource rows.
  newsPad:        { padding: 12, gap: 5 },


  // Sits inside the tab bar now, so it's ruled off from the pills above it
  // rather than from the search below.
  filterBar:      { flexGrow: 0, borderTopWidth: StyleSheet.hairlineWidth },
  filterRow:      { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterChip:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '700' },

  ytWrap:         { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  ytPlayer:       { flex: 1, backgroundColor: '#000' },
  linkBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 13, borderRadius: 12 },
  linkBtnText:    { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  adminBadge:     { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminText:      { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  carsCta:        { margin: 12, marginBottom: 0, padding: 14, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  carsCtaText:    { fontSize: 14, fontWeight: '700' },

  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle:     { fontSize: 17, fontWeight: '700' },
  modalDone:      { fontSize: 15, fontWeight: '600' },
  modalSub:       { fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },

  toggleDot:      { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  toggleCheck:    { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },

  detailHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  detailKind:     { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  detailScroll:   { paddingBottom: 60 },
  detailHero:     { width: '100%', aspectRatio: 16 / 9 },
  detailBody:     { padding: 16 },
  detailTitle:    { fontSize: 20, fontWeight: '800', lineHeight: 26, marginBottom: 12 },
  detailMeta:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  detailText:     { fontSize: 15, lineHeight: 24 },
});
