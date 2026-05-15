import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Warehouse, Plus, ChevronLeft } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetUserStatsQuery,
  useGetPublicUserByIdQuery,
  useGetPostsQuery,
  useGetCarsQuery,
  useGetListsQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import FollowButton from '../../components/social/FollowButton';
import FeedItemCard from '../../components/cards/FeedItemCard';
import ListCard from '../../components/lists/ListCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { GarageCar, User } from '../../types/api';
import { ss } from '../../styles/shared';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'posts' | 'cars' | 'followers' | 'following' | 'lists';

const TABS: { key: Tab; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'cars',      label: 'Cars' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'lists',     label: 'Lists' },
];

// Sentinels — stable identity, never recreated
const HEADER_ITEM = { _t: 'header' } as const;
const TABBAR_ITEM = { _t: 'tabbar' } as const;

function pairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

function CarGridItem({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const colors = useColors();
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  return (
    <TouchableOpacity style={[styles.carCard, { backgroundColor: colors.card }]} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.carImage} contentFit="cover" />
        : <View style={[styles.carImage, { backgroundColor: colors.secondary }]} />
      }
      <Text style={[styles.carTitle, { color: colors.fg }]} numberOfLines={1}>
        {car.year} {car.make} {car.model}
      </Text>
    </TouchableOpacity>
  );
}

function UserRow({ user, onPress }: { user: User; onPress: () => void }) {
  const colors = useColors();
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  return (
    <TouchableOpacity
      style={[ss.listRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName ?? '?'} size={44} />
      <View style={styles.userRowText}>
        <Text style={[styles.userRowName, { color: colors.fg }]}>{displayName}</Text>
        {user.username && (
          <Text style={[styles.userRowUsername, { color: colors.grey }]}>@{user.username}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const route = useRoute<any>();
  const paramUserId = route.params?.userId as string | undefined;
  const paramInitialTab = route.params?.initialTab as Tab | undefined;

  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [tab, setTab] = useState<Tab>(paramInitialTab ?? 'posts');
  const listRef = useRef<FlatList>(null);

  const isOwnProfile = !paramUserId || paramUserId === userInfo?.user_id;

  const { data: loggedInUser, isLoading: loadingOwn } = useGetLoggedInUserQuery(undefined, { skip: !isOwnProfile });
  const { data: stats } = useGetUserStatsQuery(undefined, { skip: !isOwnProfile });
  const { data: publicUser, isLoading: loadingOther } = useGetPublicUserByIdQuery(paramUserId!, { skip: isOwnProfile || !paramUserId });

  const user = isOwnProfile ? loggedInUser : publicUser;
  const isLoading = isOwnProfile ? loadingOwn : loadingOther;
  const userId = user?.user_id ?? '';

  const { data: postsData }     = useGetPostsQuery({ user_id: userId, limit: 30 }, { skip: !userId || tab !== 'posts' });
  const { data: carsData }      = useGetCarsQuery({ user_id: userId, limit: 24 }, { skip: !userId || tab !== 'cars' });
  const { data: listsData }     = useGetListsQuery({ user_id: userId, limit: 50 }, { skip: !userId || tab !== 'lists' });
  const { data: followersData } = useGetUserFollowersQuery({ userId, limit: 50 }, { skip: !userId || tab !== 'followers' });
  const { data: followingData } = useGetUserFollowingQuery({ userId, limit: 50 }, { skip: !userId || tab !== 'following' });

  if (isLoading || !user) return <Spinner fullScreen />;

  const bannerUri = user.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  const posts     = postsData?.entries ?? [];
  const cars      = carsData?.entries ?? [];
  const lists     = listsData?.entries ?? [];
  const followers = followersData?.entries ?? [];
  const following = followingData?.entries ?? [];

  const safeEdges = ['top'] as const;
  const safeBg    = isOwnProfile ? colors.primaryAlt : colors.cream;

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    listRef.current?.scrollToIndex({ index: 1, animated: false });
  };

  // ── Top chrome ─────────────────────────────────────────────────────────────
  const topBar = isOwnProfile ? (
    <AppHeader />
  ) : (
    <View style={[styles.backBar, { backgroundColor: colors.cream, borderBottomColor: colors.border }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
        <ChevronLeft size={26} color={colors.fg} />
      </TouchableOpacity>
    </View>
  );

  // ── Tab bar — data[1], sticky via stickyHeaderIndices={[1]} ────────────────
  const tabBarEl = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
      contentContainerStyle={styles.tabBar}
    >
      {TABS.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
          onPress={() => switchTab(t.key)}
        >
          <Text style={[styles.tabText, { color: tab === t.key ? colors.primaryAlt : colors.grey }]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Profile header — data[0], scrolls away ────────────────────────────────
  const profileHeader = (
    <View>
      <View style={styles.bannerContainer}>
        {bannerUri
          ? <Image source={{ uri: bannerUri }} style={styles.banner} contentFit="cover" />
          : <View style={styles.bannerPlaceholder} />
        }
      </View>
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName} size={80} />
        </View>
        {isOwnProfile ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => (navigation as any).navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Garage' } })}
            >
              <Warehouse size={20} color={colors.primaryAlt} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => (navigation as any).navigate('Settings')}
            >
              <Settings size={20} color={colors.primaryAlt} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.followRow}>
            <FollowButton username={user.username} />
            <TouchableOpacity
              style={[styles.msgBtn, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('ComposeMessage', { userId: user.user_id, username: user.username })}
            >
              <Text style={[styles.msgBtnText, { color: colors.fg }]}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>{user.firstName} {user.lastName}</Text>
        <Text style={[styles.username, { color: colors.grey }]}>@{user.username}</Text>
        {user.bio ? <Text style={[styles.bio, { color: colors.muted }]}>{user.bio}</Text> : null}
        {user.cityState ? <Text style={[styles.location, { color: colors.grey }]}>{user.cityState}</Text> : null}
        {isOwnProfile && user.memberNumber ? (
          <Text style={[styles.memberNum, { color: colors.grey }]}>Member #{user.memberNumber}</Text>
        ) : null}
      </View>
    </View>
  );

  // ── Build flat data array: [header, tabbar, ...content] ───────────────────
  const carPairs = pairs(cars);
  let tabContent: any[] = [];
  switch (tab) {
    case 'posts':
      tabContent = posts.length ? posts : [{ _t: 'empty' }];
      break;
    case 'cars':
      tabContent = carPairs.length ? carPairs : [{ _t: 'empty' }];
      break;
    case 'followers':
      tabContent = followers.length ? followers : [{ _t: 'empty' }];
      break;
    case 'following':
      tabContent = following.length ? following : [{ _t: 'empty' }];
      break;
    case 'lists':
      tabContent = [
        ...(isOwnProfile ? [{ _t: 'newlist' }] : []),
        ...(lists.length ? lists : [{ _t: 'empty' }]),
      ];
      break;
  }

  const flatData: any[] = [HEADER_ITEM, TABBAR_ITEM, ...tabContent];

  const keyExtractor = (item: any, i: number) => {
    if (item._t === 'header')  return '__header';
    if (item._t === 'tabbar')  return '__tabbar';
    if (item._t === 'empty')   return '__empty';
    if (item._t === 'newlist') return '__newlist';
    if (Array.isArray(item))   return `carrow-${i}`;
    return item.internal_id ?? item.user_id ?? String(i);
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item._t === 'header') return profileHeader;
    if (item._t === 'tabbar') return tabBarEl;
    if (item._t === 'empty') {
      const titles: Record<Tab, string> = {
        posts:     'No posts yet',
        cars:      'No cars yet',
        followers: 'No followers yet',
        following: 'Not following anyone yet',
        lists:     'No lists yet',
      };
      return <EmptyState title={titles[tab]} />;
    }
    if (item._t === 'newlist') {
      return (
        <TouchableOpacity
          style={[styles.newListBtn, { backgroundColor: colors.primaryAlt }]}
          onPress={() => (navigation as any).navigate('CreateList')}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.newListBtnText}>New List</Text>
        </TouchableOpacity>
      );
    }
    if (Array.isArray(item)) {
      return (
        <View style={styles.carRow}>
          {(item as GarageCar[]).map((car: GarageCar) => (
            <CarGridItem
              key={car.internal_id}
              car={car}
              onPress={() => (navigation as any).navigate('CarDetailModal', { carId: car.internal_id })}
            />
          ))}
          {(item as GarageCar[]).length === 1 && <View style={styles.carCardSpacer} />}
        </View>
      );
    }
    if (tab === 'posts') {
      return (
        <FeedItemCard
          post={item}
          onPress={() => (navigation as any).navigate('PostDetailModal', { postId: item.internal_id })}
        />
      );
    }
    if (tab === 'followers' || tab === 'following') {
      return (
        <UserRow
          user={item}
          onPress={() => (navigation as any).navigate('UserDetail', { userId: item.user_id, username: item.username })}
        />
      );
    }
    if (tab === 'lists') {
      return (
        <ListCard
          list={item}
          onPress={(l: any) => (navigation as any).navigate('ListDetail', { listId: l.internal_id })}
        />
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: safeBg }]} edges={safeEdges}>
      {topBar}
      <FlatList
        ref={listRef}
        data={flatData}
        // index 0 = profile header (scrolls away), index 1 = tab bar (sticks)
        stickyHeaderIndices={[1]}
        style={{ backgroundColor: colors.cream }}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:            { paddingBottom: 24 },
  bannerContainer: { width: '100%', aspectRatio: 3 / 1 },
  banner:          { width: '100%', height: '100%' },
  bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.primaryAlt },
  avatarRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -40 },
  avatarWrap:      {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    backgroundColor: colors.primaryAlt,
  },
  headerActions: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  iconBtn:       {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  followRow:  { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  msgBtn:     { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  msgBtnText: { fontSize: 14, fontWeight: '600' },
  backBar:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 4 },
  backBtn:    { padding: 8 },
  info:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  name:       { fontSize: 20, fontWeight: '800' },
  username:   { fontSize: 14, marginTop: 2 },
  bio:        { fontSize: 14, marginTop: 8, lineHeight: 20 },
  location:   { fontSize: 13, marginTop: 4 },
  memberNum:  { fontSize: 12, marginTop: 4, fontWeight: '700' },
  tabBar:     { flexDirection: 'row', paddingHorizontal: 4 },
  tabItem:    { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.primaryAlt },
  tabText:    { fontSize: 13, fontWeight: '600' },
  carRow:     { flexDirection: 'row', gap: 8, marginHorizontal: 8, marginBottom: 8 },
  carCard:    {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  carCardSpacer: { flex: 1 },
  carImage:      { width: '100%', aspectRatio: 4 / 3 },
  carTitle:      { fontSize: 12, fontWeight: '700', padding: 8 },
  newListBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 12, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  newListBtnText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  userRowText:     { flex: 1 },
  userRowName:     { fontSize: 15, fontWeight: '600' },
  userRowUsername: { fontSize: 13, marginTop: 1 },
});
