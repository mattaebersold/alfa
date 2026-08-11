import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Modal, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ThumbsUp, ThumbsDown, FileText, Search, X, ExternalLink } from 'lucide-react-native';
import { formatDistanceToNow, format } from 'date-fns';
import {
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
const CATEGORY_LISTS: Record<string, { key: string; label: string }[]> = {
  forum: FORUM_CATEGORIES,
  news: NEWS_CATEGORIES,
  resources: RESOURCE_CATEGORIES,
};
const CATEGORIZED_TABS = ['forum', 'news', 'resources'];
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
  const [detailItem, setDetailItem] = useState<any>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const { data: members = [] } = useGetGroupMembersQuery(groupId);
  const { data: garageData }   = useGetUserGarageQuery(undefined, { skip: !showCarModal });
  const [updateCarGroup, { isLoading: updatingCarGroup }] = useUpdateCarGroupMutation();

  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin');

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

  const switchTab = (newTab: ActiveTab) => {
    setTab(newTab);
    setSearch('');
    setCatFilter(null);
    listRef.current?.scrollToIndex({ index: 0, animated: false });
  };

  const visibleTabs = [...TABS, ...(isAdmin ? [{ key: 'settings', label: 'Settings' }] : [])];
  const SEARCHABLE_TABS: ActiveTab[] = ['posts', 'forum', 'members', 'cars', 'market', 'resources'];
  const showSearch = SEARCHABLE_TABS.includes(tab);

  // ── Compact header ───────────────────────────────────────────────────────────
  const compactHeader = (
    <View style={[styles.compactHeader, { backgroundColor: c.card, borderBottomColor: c.border }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={20} color={c.primaryAlt} />
        <Text style={[styles.backLabel, { color: c.primaryAlt }]}>Group Home</Text>
      </TouchableOpacity>
      <Text style={[styles.groupName, { color: c.fg }]} numberOfLines={1}>{groupTitle}</Text>
    </View>
  );

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const tabBar = (
    <View style={{ backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {visibleTabs.map((t) => {
          if (t.key === 'settings') {
            return (
              <TouchableOpacity key="settings" style={styles.tabItem} onPress={() => (navigation as any).navigate('GroupSettings', { groupId })}>
                <Text style={[styles.tabText, { color: c.grey }]}>Settings</Text>
              </TouchableOpacity>
            );
          }
          const isActive = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[styles.tabItem, isActive && { borderBottomColor: c.primaryAlt }]} onPress={() => switchTab(t.key as ActiveTab)}>
              <Text style={[styles.tabText, { color: isActive ? c.primaryAlt : c.grey }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })} activeOpacity={0.8}>
          {hero ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" /> : <Avatar filename={user?.gallery?.[0]?.filename ?? user?.profilePicture} name={user?.username ?? '?'} size={44} />}
          <View style={{ flex: 1 }}>
            {d.title ? <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text> : null}
            {d.body ? <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text> : null}
            <View style={styles.rowMeta}>
              <Text style={[styles.metaText, { color: c.grey }]}>@{user?.username} · {timeAgo}</Text>
              <Text style={[styles.metaText, { color: c.grey }]}>{d.like_count ?? 0} likes · {d.comment_count ?? 0} comments</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'forum') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => setDetailItem({ _kind: 'forum', data: d })} activeOpacity={0.8}>
          <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body ?? '')}</Text>
            <View style={styles.rowMeta}>
              <Text style={[styles.metaText, { color: c.grey }]}>{timeAgo}</Text>
              <View style={styles.votes}><ThumbsUp size={12} color={c.grey} /><Text style={[styles.metaText, { color: c.grey }]}>{d.upvotes ?? 0}</Text><ThumbsDown size={12} color={c.grey} /><Text style={[styles.metaText, { color: c.grey }]}>{d.downvotes ?? 0}</Text></View>
            </View>
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
          <View style={styles.newsPad}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={3}>{stripHtml(d.body)}</Text>}
            <Text style={[styles.metaText, { color: c.grey, marginTop: 4 }]}>@{d.user?.username} · {timeAgo}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'resources') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      const catLabel = RESOURCE_CAT_LABEL[d.category ?? 'general'] ?? d.category;
      const isVideo = !!youtubeId(d.url);
      return (
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => setDetailItem({ _kind: 'resource', data: d })}
          activeOpacity={0.8}
        >
          <View style={[styles.resourceIcon, { backgroundColor: c.cream }]}>
            {isVideo ? <ExternalLink size={20} color={c.primaryAlt} /> : <FileText size={20} color={c.primaryAlt} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text>
            {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text>}
            <View style={styles.resourceMetaRow}>
              {catLabel ? (
                <View style={[styles.resourceCatChip, { backgroundColor: c.segment }]}>
                  <Text style={[styles.resourceCatChipText, { color: c.grey }]}>{catLabel}</Text>
                </View>
              ) : null}
              <Text style={[styles.metaText, { color: c.grey }]}>{timeAgo}</Text>
            </View>
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
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })} activeOpacity={0.8}>
          {hero ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" /> : <Avatar filename={user?.gallery?.[0]?.filename ?? user?.profilePicture} name={user?.username ?? '?'} size={44} />}
          <View style={{ flex: 1 }}>
            {d.title ? <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text> : null}
            {d.price ? <Text style={[styles.rowBody, { color: c.primaryAlt, fontWeight: '700' }]}>${Number(d.price).toLocaleString()}</Text> : null}
            {d.body ? <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={1}>{stripHtml(d.body)}</Text> : null}
            <Text style={[styles.metaText, { color: c.grey }]}>@{user?.username} · {timeAgo}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'members') {
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} onPress={() => d.user_id && (navigation as any).navigate('UserDetail', { userId: d.user_id })} activeOpacity={0.8}>
          <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={42} />
          <Text style={[styles.rowTitle, { color: c.fg, flex: 1 }]}>@{d.user?.username}</Text>
          {d.member_type === 'admin' && (
            <View style={[styles.adminBadge, { backgroundColor: c.primaryAlt }]}>
              <Text style={styles.adminText}>Admin</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  }, [tab, c, navigation, groupId, isMember, showCarModal]);

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
    case 'members':   rawItems = members.filter((m) => m.status === 'active'); break;
  }

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

  const taggedItems = processedItems.map((item) => ({ _tab: tab, data: item }));
  const contentItems: any[] = isFetchingTab ? [{ _tab: 'loading' }] : taggedItems.length === 0 ? [{ _tab: 'empty' }] : taggedItems;
  const carsCta = (tab === 'cars' && isMember) ? [{ _t: 'carsCta' }] : [];
  const flatData: any[] = [TABBAR_SENTINEL, ...carsCta, ...contentItems];
  const showCatFilters = CATEGORIZED_TABS.includes(tab) && (rawItems.length > 0 || !!catFilter);
  const presentCats = new Set(rawItems.map((r: any) => r.category ?? 'general'));

  const keyExtractor = (item: any, i: number) => {
    if (item._t === 'tabbar') return '__tabbar';
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

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['top', 'bottom']}>
      {compactHeader}
      {showCatFilters && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterBar, { backgroundColor: c.cream, borderBottomColor: c.border }]}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: !catFilter ? c.primaryAlt : c.border, backgroundColor: !catFilter ? c.primaryAlt : c.card }]}
            onPress={() => setCatFilter(null)}
          >
            <Text style={[styles.filterChipText, { color: !catFilter ? '#FFFFFF' : c.fg }]}>All</Text>
          </TouchableOpacity>
          {catList(tab).filter((cat) => presentCats.has(cat.key) || catFilter === cat.key).map((cat) => {
            const active = catFilter === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.filterChip, { borderColor: active ? c.primaryAlt : c.border, backgroundColor: active ? c.primaryAlt : c.card }]}
                onPress={() => setCatFilter(cat.key)}
              >
                <Text style={[styles.filterChipText, { color: active ? '#FFFFFF' : c.fg }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <FlatList
        ref={listRef}
        data={flatData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:           { paddingBottom: 40 },
  gate:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  compactHeader:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backLabel:      { fontSize: 13, fontWeight: '600' },
  groupName:      { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },

  tabRow:         { flexDirection: 'row', paddingHorizontal: 4 },
  tabItem:        { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText:        { fontSize: 14, fontWeight: '600' },

  searchWrap:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  searchInput:    { flex: 1, fontSize: 14, paddingVertical: 0 },

  loader:         { marginVertical: 40 },

  rowTitle:       { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  rowBody:        { fontSize: 13, lineHeight: 18, marginBottom: 3 },
  rowMeta:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText:       { fontSize: 12 },
  votes:          { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowThumb:       { width: 72, height: 52, borderRadius: 8 },

  newsCard:       { marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  newsImage:      { width: '100%', aspectRatio: 16 / 9 },
  newsPad:        { padding: 12 },

  resourceIcon:   { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  resourceMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  resourceCatChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5 },
  resourceCatChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },

  filterBar:      { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  filterRow:      { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  filterChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: '600' },

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
