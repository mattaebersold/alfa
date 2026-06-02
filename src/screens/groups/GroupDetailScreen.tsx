import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, TextInput, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ThumbsUp, ThumbsDown, FileText, Search } from 'lucide-react-native';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
  useGetGroupForumQuery,
  useGetGroupNewsQuery,
  useGetGroupResourcesQuery,
  useGetEventsQuery,
  useGetGroupCarsQuery,
  useGetUserGarageQuery,
  useUpdateCarGroupMutation,
  useGetPostsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;
type ActiveTab = 'posts' | 'forum' | 'news' | 'members' | 'cars' | 'events' | 'market' | 'resources';

const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'forum',     label: 'Forum' },
  { key: 'news',      label: 'News' },
  { key: 'members',   label: 'Members' },
  { key: 'cars',      label: 'Cars' },
  { key: 'events',    label: 'Events' },
  { key: 'market',    label: 'Market' },
  { key: 'resources', label: 'Resources' },
];

const HEADER_SENTINEL = { _t: 'header' } as const;
const TABBAR_SENTINEL = { _t: 'tabbar' } as const;
const SETTINGS_TAB    = { key: 'settings', label: 'Settings' };

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GroupDetailScreen() {
  const route = useRoute<{ key: string; name: string; params: { groupId: string } }>();
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [tab, setTab] = useState<ActiveTab>('posts');
  const [search, setSearch] = useState('');
  const [showCarModal, setShowCarModal] = useState(false);
  const listRef = useRef<FlatList>(null);

  const { data: group, isLoading } = useGetGroupQuery(groupId);
  const { data: members = [] }     = useGetGroupMembersQuery(groupId);
  const [join,  { isLoading: joining }]  = useJoinGroupMutation();
  const [leave, { isLoading: leaving }]  = useLeaveGroupMutation();

  // Lazy per-tab fetches
  const { data: postsData,     isFetching: postsFetching }     = useGetPostsQuery({ group_id: groupId, limit: 30 }, { skip: tab !== 'posts' });
  const { data: forumData,     isFetching: forumFetching }     = useGetGroupForumQuery({ groupId }, { skip: tab !== 'forum' });
  const { data: newsData,      isFetching: newsFetching }      = useGetGroupNewsQuery({ groupId }, { skip: tab !== 'news' });
  const { data: resourcesData, isFetching: resourcesFetching } = useGetGroupResourcesQuery({ groupId }, { skip: tab !== 'resources' });
  const { data: eventsData,    isFetching: eventsFetching }    = useGetEventsQuery({ limit: 20, group_id: groupId }, { skip: tab !== 'events' });
  const { data: carsData,      isFetching: carsFetching }      = useGetGroupCarsQuery(groupId, { skip: tab !== 'cars' });
  const { data: garageData } = useGetUserGarageQuery(undefined, { skip: !showCarModal });
  const [updateCarGroup, { isLoading: updatingCarGroup }] = useUpdateCarGroupMutation();
  const { data: marketData,    isFetching: marketFetching }    = useGetPostsQuery({ group_id: groupId, type: 'listing', limit: 30 }, { skip: tab !== 'market' });

  // Derived values — safe before early return via optional chaining
  const banner   = firstGalleryUrl(group?.banners) ?? firstGalleryUrl(group?.gallery);
  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin');

  const switchTab = (newTab: ActiveTab) => {
    setTab(newTab);
    setSearch('');
    listRef.current?.scrollToIndex({ index: 1, animated: false });
  };

  // ── Tab bar ──────────────────────────────────────────────────────────────────
  const visibleTabs = [...TABS, ...(isAdmin ? [SETTINGS_TAB] : [])];

  const SEARCHABLE_TABS: ActiveTab[] = ['posts', 'forum', 'members', 'cars', 'market', 'resources'];
  const showSearch = SEARCHABLE_TABS.includes(tab);

  const tabBar = (
    <View style={{ backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {visibleTabs.map((t) => {
          if (t.key === 'settings') {
            return (
              <TouchableOpacity
                key="settings"
                style={styles.tabItem}
                onPress={() => (navigation as any).navigate('GroupSettings', { groupId })}
              >
                <Text style={[styles.tabText, { color: c.grey }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          }
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => switchTab(t.key as ActiveTab)}
            >
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

  // ── Group header (scrolls away) ───────────────────────────────────────────
  const groupHeader = group ? (
    <View>
      {/* Banner */}
      <View style={styles.bannerWrap}>
        {banner
          ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
          : <View style={[styles.banner, { backgroundColor: c.primaryAlt }]} />
        }
        {/* Back button overlay */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Title card */}
      <View style={[styles.titleCard, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.groupTitle, { color: c.fg }]}>{group.title}</Text>
            {group.subtitle && <Text style={[styles.groupSub, { color: c.muted }]}>{group.subtitle}</Text>}
            {group.region && <Text style={[styles.groupRegion, { color: c.grey }]}>{group.region}</Text>}
          </View>
          <TouchableOpacity
            style={[styles.joinBtn, isMember && { backgroundColor: c.cream, borderWidth: 1.5, borderColor: c.border }]}
            onPress={() => isMember ? leave(groupId) : join(groupId)}
            disabled={joining || leaving}
          >
            <Text style={[styles.joinBtnText, isMember && { color: c.fg }]}>
              {isMember ? 'Leave' : 'Join'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Members strip */}
      {members.length > 0 && (
        <View style={[styles.membersStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <Text style={[styles.memberCount, { color: c.grey }]}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.avatarRow}>
            {members.slice(0, 10).map((m) => (
              <View key={m.user_id} style={styles.avatarWrap}>
                <Avatar filename={m.user?.gallery?.[0]?.filename} name={m.user?.username ?? '?'} size={30} />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Description */}
      {group.body && (
        <View style={[styles.bodyBlock, { backgroundColor: c.card, borderBottomColor: c.border }]}>
          <Text style={[styles.bodyText, { color: c.fg }]}>{stripHtml(group.body)}</Text>
        </View>
      )}
    </View>
  ) : null;

  // ── Render items — must be defined before the early return ────────────────
  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item._t === 'header') return groupHeader;
    if (item._t === 'tabbar') return tabBar;
    if (item._t === 'carsCta') return (
      <TouchableOpacity
        style={[styles.carsCta, { backgroundColor: c.card, borderColor: c.primaryAlt }]}
        onPress={() => setShowCarModal(true)}
        activeOpacity={0.8}
      >
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
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })}
          activeOpacity={0.8}
        >
          {hero
            ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
            : <Avatar filename={user?.gallery?.[0]?.filename ?? user?.profilePicture} name={user?.username ?? '?'} size={44} />
          }
          <View style={{ flex: 1 }}>
            {d.title
              ? <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text>
              : null
            }
            {d.body
              ? <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text>
              : null
            }
            <View style={styles.rowMeta}>
              <Text style={[styles.metaText, { color: c.grey }]}>@{user?.username} · {timeAgo}</Text>
              <Text style={[styles.metaText, { color: c.grey }]}>
                {d.like_count ?? d.likeCount ?? 0} likes · {d.comment_count ?? d.commentCount ?? 0} comments
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'forum') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} activeOpacity={0.8}>
          <Avatar filename={d.user?.gallery?.[0]?.filename} name={d.user?.username ?? '?'} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body ?? '')}</Text>
            <View style={styles.rowMeta}>
              <Text style={[styles.metaText, { color: c.grey }]}>{timeAgo}</Text>
              <View style={styles.votes}>
                <ThumbsUp size={12} color={c.grey} />
                <Text style={[styles.metaText, { color: c.grey }]}>{d.upvotes ?? 0}</Text>
                <ThumbsDown size={12} color={c.grey} />
                <Text style={[styles.metaText, { color: c.grey }]}>{d.downvotes ?? 0}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'news') {
      const hero = firstGalleryUrl(d.gallery);
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <View style={[styles.newsCard, { backgroundColor: c.card }]}>
          {hero && <Image source={{ uri: hero }} style={styles.newsImage} contentFit="cover" />}
          <View style={styles.newsPad}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
            {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={3}>{stripHtml(d.body)}</Text>}
            <Text style={[styles.metaText, { color: c.grey, marginTop: 4 }]}>@{d.user?.username} · {timeAgo}</Text>
          </View>
        </View>
      );
    }

    if (item._tab === 'resources') {
      const timeAgo = d.created_at ? formatDistanceToNow(new Date(d.created_at), { addSuffix: true }) : '';
      return (
        <TouchableOpacity style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]} activeOpacity={0.8}>
          <View style={[styles.resourceIcon, { backgroundColor: c.cream }]}>
            <FileText size={20} color={c.primaryAlt} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text>
            {d.body && <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text>}
            <Text style={[styles.metaText, { color: c.grey }]}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'events') {
      const hero = firstGalleryUrl(d.gallery);
      const date = d.event_date ? format(new Date(d.event_date), 'MMM d, yyyy') : null;
      return (
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => (navigation as any).navigate('EventDetailModal', { eventId: d.internal_id })}
          activeOpacity={0.8}
        >
          {hero
            ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
            : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />
          }
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
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => (navigation as any).navigate('CarDetailModal', { carId: d.internal_id })}
          activeOpacity={0.8}
        >
          {hero
            ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
            : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />
          }
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>
              {d.title || [d.year, d.make, d.model].filter(Boolean).join(' ')}
            </Text>
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
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })}
          activeOpacity={0.8}
        >
          {hero
            ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
            : <Avatar filename={user?.gallery?.[0]?.filename ?? user?.profilePicture} name={user?.username ?? '?'} size={44} />
          }
          <View style={{ flex: 1 }}>
            {d.title
              ? <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>{d.title}</Text>
              : null
            }
            {d.price
              ? <Text style={[styles.rowBody, { color: c.primaryAlt, fontWeight: '700' }]}>${Number(d.price).toLocaleString()}</Text>
              : null
            }
            {d.body
              ? <Text style={[styles.rowBody, { color: c.muted }]} numberOfLines={1}>{stripHtml(d.body)}</Text>
              : null
            }
            <Text style={[styles.metaText, { color: c.grey }]}>@{user?.username} · {timeAgo}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (item._tab === 'members') {
      return (
        <TouchableOpacity
          style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
          onPress={() => d.user_id && (navigation as any).navigate('UserDetail', { userId: d.user_id })}
          activeOpacity={0.8}
        >
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
  }, [tab, c, navigation, groupId, groupHeader, tabBar, group, members, isMember, isAdmin, joining, leaving, showCarModal]);

  // Early return AFTER all hooks to avoid Rules of Hooks violations
  if (isLoading || !group) return <Spinner fullScreen />;

  // ── Tab content ───────────────────────────────────────────────────────────
  const isFetchingTab = (
    (tab === 'posts' && postsFetching) ||
    (tab === 'forum' && forumFetching) ||
    (tab === 'news' && newsFetching) ||
    (tab === 'resources' && resourcesFetching) ||
    (tab === 'events' && eventsFetching) ||
    (tab === 'cars' && carsFetching) ||
    (tab === 'market' && marketFetching)
  );

  let rawItems: any[] = [];
  switch (tab) {
    case 'posts':     rawItems = postsData?.entries ?? [];     break;
    case 'forum':     rawItems = forumData?.entries ?? [];     break;
    case 'news':      rawItems = newsData?.entries ?? [];      break;
    case 'resources': rawItems = resourcesData?.entries ?? []; break;
    case 'events':    rawItems = eventsData?.entries ?? [];    break;
    case 'cars':      rawItems = carsData?.entries ?? [];      break;
    case 'market':    rawItems = marketData?.entries ?? [];    break;
    case 'members':   rawItems = members.filter((m) => m.status === 'active'); break;
  }

  // Search filter (client-side)
  const q = search.trim().toLowerCase();
  const filteredItems = q ? rawItems.filter((item) => {
    const user = item.user ?? item.user_objectid;
    switch (tab) {
      case 'posts':
      case 'market':
        return (
          item.title?.toLowerCase().includes(q) ||
          item.body?.toLowerCase().includes(q) ||
          user?.username?.toLowerCase().includes(q)
        );
      case 'forum':
        return (
          item.title?.toLowerCase().includes(q) ||
          item.body?.toLowerCase().includes(q) ||
          item.user?.username?.toLowerCase().includes(q)
        );
      case 'members':
        return item.user?.username?.toLowerCase().includes(q);
      case 'cars':
        return (
          item.make?.toLowerCase().includes(q) ||
          item.model?.toLowerCase().includes(q) ||
          String(item.year ?? '').includes(q) ||
          item.user?.username?.toLowerCase().includes(q)
        );
      case 'resources':
        return (
          item.title?.toLowerCase().includes(q) ||
          item.body?.toLowerCase().includes(q)
        );
      default:
        return true;
    }
  }) : rawItems;

  const taggedItems = filteredItems.map((item) => ({ _tab: tab, data: item }));
  const contentItems: any[] = isFetchingTab
    ? [{ _tab: 'loading' }]
    : taggedItems.length === 0
    ? [{ _tab: 'empty' }]
    : taggedItems;

  const carsCta = (tab === 'cars' && isMember) ? [{ _t: 'carsCta' }] : [];
  const flatData: any[] = [HEADER_SENTINEL, TABBAR_SENTINEL, ...carsCta, ...contentItems];

  const keyExtractor = (item: any, i: number) => {
    if (item._t === 'header') return '__header';
    if (item._t === 'tabbar') return '__tabbar';
    if (item._t === 'carsCta') return '__carsCta';
    if (item._tab === 'loading') return '__loading';
    if (item._tab === 'empty')   return '__empty';
    return item.data?.internal_id ?? item.data?.user_id ?? String(i);
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <View style={[ss.fill, { backgroundColor: c.cream }]}>
        <FlatList
          ref={listRef}
          data={flatData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          onScrollToIndexFailed={() => {}}
        />
      </View>

      {/* ── Add cars to group modal ─────────────────────────────────── */}
      <Modal
        visible={showCarModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCarModal(false)}
      >
        <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={['top', 'bottom']}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.modalTitle, { color: c.fg }]}>Your Cars</Text>
            <TouchableOpacity onPress={() => setShowCarModal(false)} hitSlop={10}>
              <Text style={[styles.modalDone, { color: c.primaryAlt }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSub, { color: c.grey }]}>
            Toggle a car to add or remove it from this group.
          </Text>
          <FlatList
            data={garageData?.entries ?? []}
            keyExtractor={(item) => item.internal_id}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<EmptyState title="No cars in your garage" message="Add a car first." />}
            renderItem={({ item: car }) => {
              const inGroup = car.group_id === groupId;
              const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
              return (
                <TouchableOpacity
                  style={[ss.listRow, { backgroundColor: c.card, borderBottomColor: c.border }]}
                  onPress={async () => {
                    await updateCarGroup({ carId: car.internal_id, groupId: inGroup ? null : groupId });
                  }}
                  disabled={updatingCarGroup}
                  activeOpacity={0.8}
                >
                  {hero
                    ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
                    : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />
                  }
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={1}>
                      {car.title || [car.year, car.make, car.model].filter(Boolean).join(' ')}
                    </Text>
                  </View>
                  <View style={[styles.toggleDot, inGroup && { backgroundColor: c.primaryAlt }]}>
                    {inGroup && <View style={styles.toggleCheck} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:         { paddingBottom: 32 },

  bannerWrap:   { position: 'relative' },
  banner:       { width: '100%', aspectRatio: 3 / 1 },
  backBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  titleCard:    { padding: 16, borderBottomWidth: 1 },
  titleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  groupTitle:   { fontSize: 20, fontWeight: '800' },
  groupSub:     { fontSize: 14, marginTop: 3 },
  groupRegion:  { fontSize: 13, marginTop: 3 },
  joinBtn:      {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.primaryAlt, alignSelf: 'flex-start', flexShrink: 0,
  },
  joinBtnText:  { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  membersStrip: { padding: 14, borderBottomWidth: 1 },
  memberCount:  { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  avatarRow:    { flexDirection: 'row' },
  avatarWrap:   { marginRight: -6 },

  bodyBlock:    { padding: 16, borderBottomWidth: 1 },
  bodyText:     { fontSize: 15, lineHeight: 22 },

  // Tab bar
  tabBar:       { flexDirection: 'row', paddingHorizontal: 4 },
  tabItem:      {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: colors.primaryAlt },
  tabText:      { fontSize: 14, fontWeight: '600' },

  // Search
  searchWrap:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  searchInput:  { flex: 1, fontSize: 14, paddingVertical: 0 },

  loader:       { marginVertical: 40 },

  // Row items
  rowTitle:     { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  rowBody:      { fontSize: 13, lineHeight: 18, marginBottom: 3 },
  rowMeta:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaText:     { fontSize: 12 },
  votes:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowThumb:     { width: 72, height: 52, borderRadius: 8 },

  newsCard:     { marginHorizontal: 12, marginTop: 12, borderRadius: 12, overflow: 'hidden' },
  newsImage:    { width: '100%', aspectRatio: 16 / 9 },
  newsPad:      { padding: 12 },

  resourceIcon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  adminBadge:   { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  adminText:    { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  // Cars CTA
  carsCta:      {
    margin: 12, marginBottom: 0, padding: 14, borderRadius: 10,
    borderWidth: 1.5, alignItems: 'center',
  },
  carsCtaText:  { fontSize: 14, fontWeight: '700' },

  // Add cars modal
  modalHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle:   { fontSize: 17, fontWeight: '700' },
  modalDone:    { fontSize: 15, fontWeight: '600' },
  modalSub:     { fontSize: 13, paddingHorizontal: 16, paddingVertical: 10 },

  // Toggle
  toggleDot:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  toggleCheck:  { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
});
