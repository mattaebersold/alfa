import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
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
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import type { AppStackParamList, AppScreenProps } from '../../navigation/types';
import type { GarageCar } from '../../types/api';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
type Tab = 'posts' | 'cars';
type SheetType = 'posts' | 'cars' | null;

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

export default function UserDetailScreen({ route }: AppScreenProps<'UserDetail'>) {
  const { userId, username } = route.params;
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const [tab, setTab] = useState<Tab>('posts');
  const [sheet, setSheet] = useState<SheetType>(null);

  const { data: user, isLoading } = useGetPublicUserByIdQuery(userId);

  // Always fetch both; tab just controls which to display
  const { data: postsData } = useGetPostsQuery({ user_id: userId, limit: 30 });
  const { data: carsData } = useGetCarsQuery({ user_id: userId, limit: 30 });

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
          <Avatar filename={user.gallery?.[0]?.filename} name={user.firstName} size={80} />
        </View>
        <View style={styles.followRow}>
          <FollowButton username={user.username} />
          <TouchableOpacity
            style={[styles.msgBtn, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('ComposeMessage', { userId: user.user_id, username: user.username })}
          >
            <Text style={[styles.msgBtnText, { color: colors.fg }]}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name / username / bio */}
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.fg }]}>{user.firstName} {user.lastName}</Text>
        <Text style={[styles.username, { color: colors.grey }]}>@{user.username}</Text>
        {user.bio ? <Text style={[styles.bio, { color: colors.muted }]}>{user.bio}</Text> : null}
        {user.cityState ? <Text style={[styles.location, { color: colors.grey }]}>{user.cityState}</Text> : null}
      </View>

      {/* Stats — tappable */}
      <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.statItem} onPress={() => setSheet('posts')}>
          <Text style={[styles.statValue, { color: colors.fg }]}>{posts.length}</Text>
          <Text style={[styles.statLabel, { color: Colors.brg }]}>Posts</Text>
        </TouchableOpacity>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.statItem} onPress={() => setSheet('cars')}>
          <Text style={[styles.statValue, { color: colors.fg }]}>{cars.length}</Text>
          <Text style={[styles.statLabel, { color: Colors.brg }]}>Cars</Text>
        </TouchableOpacity>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.fg }]}>{user.followersCount ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.grey }]}>Followers</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.fg }]}>{user.followingCount ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.grey }]}>Following</Text>
        </View>
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
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      {/* Single FlatList with key to avoid numColumns error */}
      {tab === 'cars' ? (
        <FlatList
          key="cars"
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
      ) : (
        <FlatList
          key="posts"
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
      )}

      {/* Posts sheet */}
      <Modal visible={sheet === 'posts'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <SafeAreaView style={[styles.sheetSafe, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.fg }]}>Posts</Text>
            <TouchableOpacity onPress={() => setSheet(null)} hitSlop={10}><X size={20} color={colors.fg} /></TouchableOpacity>
          </View>
          <FlatList
            data={posts}
            keyExtractor={(p) => p.internal_id}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <FeedItemCard
                post={item}
                onPress={() => { setSheet(null); navigation.navigate('PostDetailModal', { postId: item.internal_id }); }}
              />
            )}
            ListEmptyComponent={<EmptyState title="No posts yet" />}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>

      {/* Cars sheet */}
      <Modal visible={sheet === 'cars'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)}>
        <SafeAreaView style={[styles.sheetSafe, { backgroundColor: colors.cream }]} edges={['top', 'bottom']}>
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.fg }]}>Cars</Text>
            <TouchableOpacity onPress={() => setSheet(null)} hitSlop={10}><X size={20} color={colors.fg} /></TouchableOpacity>
          </View>
          <FlatList
            data={cars}
            keyExtractor={(c) => c.internal_id}
            numColumns={2}
            columnWrapperStyle={styles.carRow}
            contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 8 }}
            renderItem={({ item }) => (
              <CarGridItem
                car={item}
                onPress={() => { setSheet(null); navigation.navigate('CarDetailModal', { carId: item.internal_id }); }}
              />
            )}
            ListEmptyComponent={<EmptyState title="No cars yet" />}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1 },
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
  msgBtn:     { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  msgBtnText: { fontSize: 14, fontWeight: '600' },
  info:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  name:       { fontSize: 20, fontWeight: '800' },
  username:   { fontSize: 14, marginTop: 2 },
  bio:        { fontSize: 14, marginTop: 8, lineHeight: 20 },
  location:   { fontSize: 13, marginTop: 4 },
  statsRow:   {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { fontSize: 18, fontWeight: '800' },
  statLabel:  { fontSize: 12, marginTop: 2, fontWeight: '600' },
  statDivider:{ width: 1, height: 30 },
  tabBar:     { flexDirection: 'row', borderBottomWidth: 1 },
  tabItem:      { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: Colors.brg },
  tabText:      { fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: Colors.brg },
  carRow:       { gap: 8, marginBottom: 8, paddingHorizontal: 8 },
  carCard:      {
    flex: 1, borderRadius: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  carImage:       { width: '100%', aspectRatio: 4 / 3 },
  carTitle:       { fontSize: 12, fontWeight: '700', padding: 8 },
  sheetSafe:      { flex: 1 },
  sheetHeader:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetTitle:     { fontSize: 17, fontWeight: '700' },
});
