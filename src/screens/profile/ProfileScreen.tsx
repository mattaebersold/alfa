import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Settings, Warehouse } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetUserStatsQuery,
  useGetPostsQuery,
  useGetCarsQuery,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import FeedItemCard from '../../components/cards/FeedItemCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import type { GarageCar } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'posts' | 'cars';

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CarGridItem({ car, onPress }: { car: GarageCar; onPress: () => void }) {
  const hero = firstGalleryUrl(car.gallery) ?? (car.profile_image ? imageUrl(car.profile_image) : null);
  return (
    <TouchableOpacity style={styles.carCard} onPress={onPress} activeOpacity={0.9}>
      {hero
        ? <Image source={{ uri: hero }} style={styles.carImage} contentFit="cover" />
        : <View style={[styles.carImage, styles.carPlaceholder]} />
      }
      <Text style={styles.carTitle} numberOfLines={1}>
        {car.year} {car.make} {car.model}
      </Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
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

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <EmptyState title="Not logged in" />;

  const bannerUri = user.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  const posts = postsData?.entries ?? [];
  const cars = carsData?.entries ?? [];

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
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Garage')}
          >
            <Warehouse size={20} color={Colors.brg} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings size={20} color={Colors.brg} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Name / username / bio */}
      <View style={styles.info}>
        <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        {user.cityState ? <Text style={styles.location}>{user.cityState}</Text> : null}
        {user.memberNumber ? (
          <Text style={styles.memberNum}>Member #{user.memberNumber}</Text>
        ) : null}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatItem label="Posts" value={stats?.postsCount ?? 0} />
        <View style={styles.statDivider} />
        <StatItem label="Cars" value={stats?.garageCarsCount ?? 0} />
        <View style={styles.statDivider} />
        <StatItem label="Followers" value={stats?.followersCount ?? user.followersCount ?? 0} />
        <View style={styles.statDivider} />
        <StatItem label="Following" value={stats?.followingCount ?? user.followingCount ?? 0} />
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'posts' && styles.tabItemActive]}
          onPress={() => setTab('posts')}
        >
          <Text style={[styles.tabText, tab === 'posts' && styles.tabTextActive]}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'cars' && styles.tabItemActive]}
          onPress={() => setTab('cars')}
        >
          <Text style={[styles.tabText, tab === 'cars' && styles.tabTextActive]}>Cars</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (tab === 'cars') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <FlatList
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
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
  safe:            { flex: 1, backgroundColor: Colors.cream },
  list:            { paddingBottom: 24 },
  bannerContainer: { width: '100%', aspectRatio: 3 / 1 },
  banner:          { width: '100%', height: '100%' },
  bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.brg },
  avatarRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -40 },
  avatarWrap:      {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    backgroundColor: Colors.brg,
  },
  headerActions:   { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  iconBtn:         {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  info:      { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  name:      { fontSize: 20, fontWeight: '800', color: Colors.fg },
  username:  { fontSize: 14, color: Colors.grey, marginTop: 2 },
  bio:       { fontSize: 14, color: Colors.muted, marginTop: 8, lineHeight: 20 },
  location:  { fontSize: 13, color: Colors.grey, marginTop: 4 },
  memberNum: { fontSize: 12, color: Colors.grey, marginTop: 4, fontWeight: '700' },
  statsRow:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  statItem:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: Colors.fg },
  statLabel: { fontSize: 12, color: Colors.grey, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  tabBar:    {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabItem:   { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.brg },
  tabText:   { fontSize: 14, fontWeight: '600', color: Colors.grey },
  tabTextActive: { color: Colors.brg },
  carRow:    { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  carCard:   {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  carImage:       { width: '100%', aspectRatio: 4 / 3 },
  carPlaceholder: { backgroundColor: Colors.secondary },
  carTitle:       { fontSize: 12, fontWeight: '700', color: Colors.fg, padding: 8 },
});
