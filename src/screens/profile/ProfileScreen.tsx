import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Warehouse, Plus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetUserStatsQuery,
  useGetPostsQuery,
  useGetCarsQuery,
  useGetListsQuery,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import FeedItemCard from '../../components/cards/FeedItemCard';
import ListCard from '../../components/lists/ListCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { GarageCar } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'posts' | 'cars' | 'lists';

function StatItem({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: colors.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.grey }]}>{label}</Text>
    </View>
  );
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

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('posts');

  const { data: user, isLoading } = useGetLoggedInUserQuery();
  const { data: stats } = useGetUserStatsQuery();
  const { data: postsData } = useGetPostsQuery(
    { user_id: user?.user_id, limit: 20 },
    { skip: !user?.user_id || tab !== 'posts' }
  );
  const { data: carsData } = useGetCarsQuery(
    { user_id: user?.user_id, limit: 24 },
    { skip: !user?.user_id || tab !== 'cars' }
  );
  const { data: listsData, refetch: refetchLists } = useGetListsQuery(
    { user_id: user?.user_id, limit: 50 },
    { skip: !user?.user_id || tab !== 'lists' }
  );

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <EmptyState title="Not logged in" />;

  const bannerUri = user.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  const posts = postsData?.entries ?? [];
  const cars = carsData?.entries ?? [];
  const lists = listsData?.entries ?? [];

  const header = (
    <View>
      {/* Banner */}
      <View style={styles.bannerContainer}>
        {bannerUri
          ? <Image source={{ uri: bannerUri }} style={styles.banner} contentFit="cover" />
          : <View style={styles.bannerPlaceholder} />
        }
      </View>

      {/* Avatar + actions row */}
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            filename={user.gallery?.[0]?.filename}
            name={user.firstName}
            size={80}
          />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Garage')}
          >
            <Warehouse size={20} color={colors.cyan} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings size={20} color={colors.cyan} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Name / username / bio */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>{user.firstName} {user.lastName}</Text>
        <Text style={[styles.username, { color: colors.grey }]}>@{user.username}</Text>
        {user.bio ? <Text style={[styles.bio, { color: colors.muted }]}>{user.bio}</Text> : null}
        {user.cityState ? <Text style={[styles.location, { color: colors.grey }]}>{user.cityState}</Text> : null}
        {user.memberNumber ? (
          <Text style={[styles.memberNum, { color: colors.grey }]}>Member #{user.memberNumber}</Text>
        ) : null}
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <StatItem label="Posts" value={stats?.postsCount ?? 0} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatItem label="Cars" value={stats?.garageCarsCount ?? 0} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatItem label="Followers" value={stats?.followersCount ?? user.followersCount ?? 0} />
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <StatItem label="Following" value={stats?.followingCount ?? user.followingCount ?? 0} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'posts' && styles.tabItemActive]}
          onPress={() => setTab('posts')}
        >
          <Text style={[styles.tabText, { color: colors.grey }, tab === 'posts' && styles.tabTextActive]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'cars' && styles.tabItemActive]}
          onPress={() => setTab('cars')}
        >
          <Text style={[styles.tabText, { color: colors.grey }, tab === 'cars' && styles.tabTextActive]}>Cars</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'lists' && styles.tabItemActive]}
          onPress={() => setTab('lists')}
        >
          <Text style={[styles.tabText, { color: colors.grey }, tab === 'lists' && styles.tabTextActive]}>Lists</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (tab === 'cars') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
        <FlatList
          key="tab-cars"
          data={cars}
          keyExtractor={(item) => item.internal_id}
          numColumns={2}
          columnWrapperStyle={styles.carRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <CarGridItem
              car={item}
              onPress={() => navigation.navigate('CarDetailModal', { carId: item.internal_id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No cars yet" message="Add your first car to your garage." />
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  if (tab === 'lists') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
        <FlatList
          key="tab-lists"
          data={lists}
          keyExtractor={(item) => item.internal_id}
          contentContainerStyle={[styles.list, styles.listsPadding]}
          ListHeaderComponent={
            <View>
              {header}
              <TouchableOpacity
                style={[styles.newListBtn, { backgroundColor: colors.cyan }]}
                onPress={() => navigation.navigate('CreateList')}
              >
                <Plus size={16} color="#fff" />
                <Text style={styles.newListBtnText}>New List</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <ListCard
              list={item}
              onPress={(l) => navigation.navigate('ListDetail', { listId: l.internal_id })}
            />
          )}
          ListEmptyComponent={
            <EmptyState title="No lists yet" message="Create a list to organize your content." />
          }
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <FlatList
        key="tab-posts"
        data={posts}
        keyExtractor={(item) => item.internal_id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <FeedItemCard
            post={item}
            onPress={() => navigation.navigate('PostDetailModal', { postId: item.internal_id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState title="No posts yet" />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1 },
  list:            { paddingBottom: 24 },
  bannerContainer: { width: '100%', aspectRatio: 3 / 1 },
  banner:          { width: '100%', height: '100%' },
  bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: colors.cyan },
  avatarRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -40 },
  avatarWrap:      {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    backgroundColor: colors.cyan,
  },
  headerActions:   { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  iconBtn:         {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  info:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  name:      { fontSize: 20, fontWeight: '800' },
  username:  { fontSize: 14, marginTop: 2 },
  bio:       { fontSize: 14, marginTop: 8, lineHeight: 20 },
  location:  { fontSize: 13, marginTop: 4 },
  memberNum: { fontSize: 12, marginTop: 4, fontWeight: '700' },
  statsRow:  {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  statItem:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 30 },
  tabBar:    {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem:   { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.cyan },
  tabText:   { fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.cyan },
  carRow:    { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  carCard:   {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  carImage:       { width: '100%', aspectRatio: 4 / 3 },
  carTitle:       { fontSize: 12, fontWeight: '700', padding: 8 },
  listsPadding:   { paddingHorizontal: 12 },
  newListBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  newListBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
