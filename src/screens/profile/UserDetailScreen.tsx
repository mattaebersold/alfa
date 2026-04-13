import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetPublicUserByIdQuery,
  useGetPostsQuery,
  useGetCarsQuery,
} from '../../api/apiService';
import Avatar from '../../components/ui/Avatar';
import FollowButton from '../../components/social/FollowButton';
import FeedItemCard from '../../components/cards/FeedItemCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { Colors } from '../../constants/colors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList, AppScreenProps } from '../../navigation/types';
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

export default function UserDetailScreen({ route }: AppScreenProps<'UserDetail'>) {
  const { userId, username } = route.params;
  const navigation = useNavigation<NavProp>();
  const [tab, setTab] = useState<Tab>('posts');

  const { data: user, isLoading } = useGetPublicUserByIdQuery(userId);
  const { data: postsData } = useGetPostsQuery(
    { user_id: userId, limit: 20 },
    { skip: tab !== 'posts' }
  );
  const { data: carsData } = useGetCarsQuery(
    { user_id: userId, limit: 24 },
    { skip: tab !== 'cars' }
  );

  if (isLoading) return <Spinner fullScreen />;
  if (!user) return <EmptyState title="User not found" />;

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

      {/* Avatar + follow row */}
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            filename={user.gallery?.[0]?.filename}
            name={user.firstName}
            size={80}
          />
        </View>
        <View style={styles.followRow}>
          <FollowButton username={user.username} />
          <TouchableOpacity
            style={styles.msgBtn}
            onPress={() => navigation.navigate('ComposeMessage', { userId: user.user_id, username: user.username })}
          >
            <Text style={styles.msgBtnText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name / username / bio */}
      <View style={styles.info}>
        <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        {user.cityState ? <Text style={styles.location}>{user.cityState}</Text> : null}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatItem label="Posts" value={posts.length} />
        <View style={styles.statDivider} />
        <StatItem label="Cars" value={cars.length} />
        <View style={styles.statDivider} />
        <StatItem label="Followers" value={user.followersCount ?? 0} />
        <View style={styles.statDivider} />
        <StatItem label="Following" value={user.followingCount ?? 0} />
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
          ListEmptyComponent={<EmptyState title="No cars yet" />}
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
        ListEmptyComponent={<EmptyState title="No posts yet" />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: Colors.cream },
  list:              { paddingBottom: 24 },
  bannerContainer:   { width: '100%', aspectRatio: 3 / 1 },
  banner:            { width: '100%', height: '100%' },
  bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: Colors.brg },
  avatarRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -40 },
  avatarWrap:        {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden',
    backgroundColor: Colors.brg,
  },
  followRow:  { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  msgBtn:     {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  msgBtnText: { fontSize: 14, fontWeight: '600', color: Colors.fg },
  info:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  name:       { fontSize: 20, fontWeight: '800', color: Colors.fg },
  username:   { fontSize: 14, color: Colors.grey, marginTop: 2 },
  bio:        { fontSize: 14, color: Colors.muted, marginTop: 8, lineHeight: 20 },
  location:   { fontSize: 13, color: Colors.grey, marginTop: 4 },
  statsRow:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { fontSize: 18, fontWeight: '800', color: Colors.fg },
  statLabel:  { fontSize: 12, color: Colors.grey, marginTop: 2 },
  statDivider:{ width: 1, height: 30, backgroundColor: Colors.border },
  tabBar:     {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tabItem:      { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.brg },
  tabText:      { fontSize: 14, fontWeight: '600', color: Colors.grey },
  tabTextActive: { color: Colors.brg },
  carRow:       { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  carCard:      {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  carImage:       { width: '100%', aspectRatio: 4 / 3 },
  carPlaceholder: { backgroundColor: Colors.secondary },
  carTitle:       { fontSize: 12, fontWeight: '700', color: Colors.fg, padding: 8 },
});
