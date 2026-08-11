import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, Modal, Animated, Pressable, TextInput, Dimensions,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { Settings, Warehouse, Plus, MoreVertical, X, Search } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetPublicUserByIdQuery,
  useGetPostsQuery,
  useGetCarsQuery,
  useGetListsQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useCreateReportMutation,
} from '../../api/apiService';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { addBlockedUser, removeBlockedUser } from '../../store/moderationSlice';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import CarCard from '../../components/cards/CarCard';
import FollowButton from '../../components/social/FollowButton';
import ListCard from '../../components/lists/ListCard';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import type { AppStackParamList } from '../../navigation/types';
import type { GarageCar, Post, User } from '../../types/api';
import { ss } from '../../styles/shared';
import RowEndSpacer from '../../components/ui/RowEndSpacer';

type NavProp = NativeStackNavigationProp<AppStackParamList>;
// Cars live on the page itself (see the garage section), so they get no tile.
type Tab = 'posts' | 'followers' | 'following' | 'lists';

const TABS: { key: Tab; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'lists',     label: 'Lists' },
];

// Garage carousel — cards stop short of full width so the next one peeks out.
const GARAGE_GUTTER = 12;
const GARAGE_CARD_WIDTH = Dimensions.get('window').width * 0.9 - GARAGE_GUTTER;

function PostRow({ post, onPress }: { post: Post; onPress: () => void }) {
  const colors = useColors();
  const thumb = firstGalleryUrl(post.gallery);
  const title = post.title ?? (post.body ? stripHtml(post.body) : null);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    <TouchableOpacity
      style={[ss.listRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.postRowThumb} contentFit="cover" />
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        {title ? (
          <Text style={{ color: colors.fg, fontSize: 14, fontWeight: '600', lineHeight: 19 }} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

function UserRow({ user, onPress, currentUserId }: { user: User; onPress: () => void; currentUserId?: string }) {
  const colors = useColors();
  const dispatch = useAppDispatch();
  const [blockUser] = useBlockUserMutation();
  const [unblockUser] = useUnblockUserMutation();
  const [createReport] = useCreateReportMutation();
  const isBlocked = useAppSelector((s) => s.moderation.blockedUserIds.includes(user.user_id));

  const handleUnblock = () => {
    Alert.alert(
      'Unblock user',
      `Unblock @${user.username}? You'll be able to see each other's content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser({ blocked_id: user.user_id }).unwrap();
              dispatch(removeBlockedUser(user.user_id));
            } catch {
              Alert.alert('Error', 'Could not unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleMorePress = () => {
    Alert.alert(
      `@${user.username}`,
      undefined,
      [
        {
          text: 'Block user',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Block user',
              `Block @${user.username}? They won't be able to see your content and you won't see theirs.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await blockUser({ blocked_id: user.user_id }).unwrap();
                      dispatch(addBlockedUser(user.user_id));                                   // hide their content instantly
                      createReport({ content_type: 'user', content_id: user.user_id }).catch(() => {}); // notify moderation
                      Alert.alert('Blocked', `@${user.username} has been blocked. You won't see their content anymore.`);
                    } catch {
                      Alert.alert('Error', 'Could not block user. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Report user',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Report user',
              `Report @${user.username} as inappropriate?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await createReport({ content_type: 'user', content_id: user.user_id }).unwrap();
                      Alert.alert('Reported', `@${user.username} has been reported for review.`);
                    } catch (err: any) {
                      if (err?.status === 409) {
                        Alert.alert('Already reported', 'You\'ve already reported this user.');
                      } else {
                        Alert.alert('Error', 'Could not report user. Please try again.');
                      }
                    }
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[ss.listRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={44} />
      <Text style={[styles.userRowName, { color: colors.fg, flex: 1 }]}>@{user.username}</Text>
      {isBlocked ? (
        <>
          <View style={[styles.blockedPill, { backgroundColor: colors.red + '18' }]}>
            <Text style={[styles.blockedPillText, { color: colors.red }]}>Blocked</Text>
          </View>
          <TouchableOpacity
            style={[styles.unblockBtn, { borderColor: colors.border }]}
            onPress={handleUnblock}
            activeOpacity={0.7}
          >
            <Text style={[styles.unblockBtnText, { color: colors.primaryAlt }]}>Unblock</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {user.username && user.user_id !== currentUserId && (
            <FollowButton username={user.username} />
          )}
          {user.user_id !== currentUserId && (
            <TouchableOpacity onPress={handleMorePress} hitSlop={10} style={styles.moreBtn}>
              <MoreVertical size={18} color={colors.grey} />
            </TouchableOpacity>
          )}
        </>
      )}
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
  const isPro = userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
  const visibleTabs = isPro ? TABS : TABS.filter((t) => t.key !== 'lists');
  const [activeSection, setActiveSection] = useState<Tab | null>(paramInitialTab ?? null);
  // Kept mounted through the slide-out so content doesn't vanish mid-animation.
  const [renderedSection, setRenderedSection] = useState<Tab | null>(paramInitialTab ?? null);
  const [userSearch, setUserSearch] = useState('');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioLines, setBioLines] = useState<number | null>(null);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [blockProfileUser] = useBlockUserMutation();
  const [reportProfileUser] = useCreateReportMutation();
  const sheetY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetMounted = useRef(false);

  useEffect(() => {
    if (activeSection) {
      setRenderedSection(activeSection);
      setUserSearch('');
      sheetMounted.current = true;
      sheetY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (sheetMounted.current) {
      Animated.parallel([
        Animated.timing(sheetY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        sheetMounted.current = false;
        setRenderedSection(null);
      });
    }
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwnProfile = !paramUserId || paramUserId === userInfo?.user_id;

  const { data: loggedInUser, isLoading: loadingOwn } = useGetLoggedInUserQuery(undefined, { skip: !isOwnProfile });
  const { data: publicUser, isLoading: loadingOther } = useGetPublicUserByIdQuery(paramUserId!, { skip: isOwnProfile || !paramUserId });

  const user = isOwnProfile ? loggedInUser : publicUser;
  const isLoading = isOwnProfile ? loadingOwn : loadingOther;
  const userId = user?.user_id ?? '';

  // All sections fetched up front so the tiles can show counts and content is
  // ready the moment a tile opens its modal.
  const { data: postsData }     = useGetPostsQuery({ user_id: userId, limit: 30 }, { skip: !userId });
  const { data: carsData }      = useGetCarsQuery({ user_id: userId, limit: 24 }, { skip: !userId });
  const { data: listsData }     = useGetListsQuery({ user_id: userId, limit: 50 }, { skip: !userId || !isPro });
  const { data: followersData } = useGetUserFollowersQuery({ userId, limit: 50 }, { skip: !userId });
  const { data: followingData } = useGetUserFollowingQuery({ userId, limit: 50 }, { skip: !userId });

  if (isLoading || !user) return <Spinner fullScreen />;

  const handleProfileMenu = () => {
    Alert.alert(`@${user.username}`, undefined, [
      {
        text: 'Block user',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Block user',
          `Block @${user.username}? You won't see each other's content, messages, or notifications.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockProfileUser({ blocked_id: user.user_id }).unwrap();
                  dispatch(addBlockedUser(user.user_id));                                        // hide their content instantly
                  reportProfileUser({ content_type: 'user', content_id: user.user_id }).catch(() => {}); // notify moderation
                  Alert.alert('Blocked', `@${user.username} has been blocked. You won't see their content anymore.`);
                  navigation.goBack();
                } catch {
                  Alert.alert('Error', 'Could not block user. Please try again.');
                }
              },
            },
          ]
        ),
      },
      {
        text: 'Report user',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Report user',
          `Report @${user.username} as inappropriate?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: async () => {
                try {
                  await reportProfileUser({ content_type: 'user', content_id: user.user_id }).unwrap();
                  Alert.alert('Reported', 'Thanks — our team will review this user.');
                } catch (err: any) {
                  if (err?.status === 409) Alert.alert('Already reported', "You've already reported this user.");
                  else Alert.alert('Error', 'Could not report user. Please try again.');
                }
              },
            },
          ]
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const bannerUri = user.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  const posts     = postsData?.entries ?? [];
  const cars      = carsData?.entries ?? [];
  const lists     = listsData?.entries ?? [];
  const followers = followersData?.entries ?? [];
  const following = followingData?.entries ?? [];

  // Every profile uses the floating header over the cover image, so the screen
  // claims no top inset.
  const safeEdges: Edge[] = [];
  // Clear the floating tab bar. Computed rather than read via
  // useBottomTabBarHeight, which throws when this renders outside the tabs.
  const tabBarClearance = 88 + insets.bottom;
  const safeBg    = colors.cream;

  const countFor = (key: Tab): number => {
    switch (key) {
      case 'posts':     return postsData?.total ?? posts.length;
      case 'followers': return followersData?.total ?? followers.length;
      case 'following': return followingData?.total ?? following.length;
      case 'lists':     return listsData?.total ?? lists.length;
    }
  };

  // ── Top chrome ─────────────────────────────────────────────────────────────
  // Identical chrome whether it's your profile or someone else's — the back
  // chevron is replaced by the header's own navigation (plus swipe-back).
  const topBar = <AppHeader />;

  // ── Section tiles — tap to open a modal with that section's content ───────
  const tilesEl = (
    <View style={styles.tilesGrid}>
      {visibleTabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setActiveSection(t.key)}
          activeOpacity={0.85}
        >
          <Text style={[styles.tileCount, { color: colors.fg }]}>{countFor(t.key)}</Text>
          <Text style={[styles.tileLabel, { color: colors.grey }]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ── Garage — lives on the page rather than behind a tile ──────────────────
  // A featured car (if any) leads at full width; the rest sit two-up beneath it.
  const featuredCar = cars.find((c) => c.featured);
  const restCars = featuredCar ? cars.filter((c) => c.internal_id !== featuredCar.internal_id) : cars;

  const garageEl = (
    <View style={styles.garageSection}>
      <View style={styles.garageHeader}>
        <Text style={[styles.garageTitle, { color: colors.fg }]}>Garage</Text>
        <Text style={[styles.garageCount, { color: colors.grey }]}>{carsData?.total ?? cars.length}</Text>
      </View>

      {cars.length === 0 ? (
        <EmptyState title="No cars yet" />
      ) : (
        <>
          {featuredCar && <CarCard car={featuredCar} featured />}
          {restCars.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.garageCarousel}
              // Snaps card-by-card rather than page-by-page, so the peek stays put.
              snapToInterval={GARAGE_CARD_WIDTH + GARAGE_GUTTER}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {restCars.map((car: GarageCar) => (
                <View key={car.internal_id} style={styles.garageCarouselItem}>
                  <CarCard car={car} compact />
                </View>
              ))}
              <RowEndSpacer width={GARAGE_GUTTER} />
            </ScrollView>
          )}
        </>
      )}
    </View>
  );

  // ── Profile header ────────────────────────────────────────────────────────
  const profileHeader = (
    <View>
      <View style={styles.bannerContainer}>
        {/* Same stand-in a car uses when it has no photo. */}
        <Image
          source={bannerUri ? { uri: bannerUri } : require('../../../assets/car-placeholder.jpg')}
          style={styles.banner}
          contentFit="cover"
        />
        {/* Darkens the top of the cover so the floating header reads over it. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          style={styles.bannerScrim}
          pointerEvents="none"
        />
      </View>
      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={104} />
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
            <TouchableOpacity
              style={[styles.profileMenuBtn, { borderColor: colors.border }]}
              onPress={handleProfileMenu}
              hitSlop={8}
            >
              <MoreVertical size={18} color={colors.fg} />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.fg }]}>@{user.username}</Text>
          {user.memberNumber ? (
            <View style={[styles.memberBadge, { backgroundColor: colors.primaryAlt }]}>
              <Text style={styles.memberBadgeText}>#{user.memberNumber}</Text>
            </View>
          ) : null}
        </View>
        {user.bio ? (
          <View style={styles.bioWrap}>
            <Text
              style={[styles.bio, { color: colors.muted }]}
              numberOfLines={bioLines == null ? undefined : (bioExpanded ? undefined : 3)}
              onTextLayout={bioLines == null ? (e) => setBioLines(e.nativeEvent.lines.length) : undefined}
            >
              {stripHtml(user.bio)}
            </Text>
            {bioLines != null && bioLines > 3 && (
              <TouchableOpacity onPress={() => setBioExpanded((v) => !v)} hitSlop={6}>
                <Text style={[styles.moreLink, { color: colors.grey }]}>{bioExpanded ? 'Less' : 'More'}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );

  // ── Navigate helpers that also dismiss the modal ──────────────────────────
  const openAndClose = (fn: () => void) => { setActiveSection(null); fn(); };

  // ── Modal content per section ─────────────────────────────────────────────
  const renderSectionContent = () => {
    switch (renderedSection) {
      case 'posts':
        return (
          <FlatList
            data={posts}
            keyExtractor={(p: Post) => p.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <PostRow
                post={item}
                onPress={() => openAndClose(() => (navigation as any).navigate('PostDetailModal', { postId: item.internal_id }))}
              />
            )}
            ListEmptyComponent={<EmptyState title="No posts yet" />}
          />
        );
      case 'followers':
      case 'following': {
        const source = renderedSection === 'followers' ? followers : following;
        const q = userSearch.trim().toLowerCase();
        const data = q ? source.filter((u) => (u.username ?? '').toLowerCase().includes(q)) : source;
        return (
          <FlatList
            data={data}
            keyExtractor={(u: User) => u.user_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={[styles.userSearchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.userSearchInput, { color: colors.fg }]}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search by username..."
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                />
              </View>
            }
            renderItem={({ item }) => (
              <UserRow
                user={item}
                currentUserId={userInfo?.user_id}
                onPress={() => openAndClose(() => (navigation as any).navigate('UserDetail', { userId: item.user_id, username: item.username }))}
              />
            )}
            ListEmptyComponent={
              <EmptyState title={q ? 'No users match' : (renderedSection === 'followers' ? 'No followers yet' : 'Not following anyone yet')} />
            }
          />
        );
      }
      case 'lists':
        return (
          <FlatList
            data={lists}
            keyExtractor={(l: any) => l.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isOwnProfile ? (
                <TouchableOpacity
                  style={[styles.newListBtn, { backgroundColor: colors.primaryAlt }]}
                  onPress={() => openAndClose(() => (navigation as any).navigate('CreateList'))}
                >
                  <Plus size={16} color="#fff" />
                  <Text style={styles.newListBtnText}>New List</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => (
              <ListCard
                list={item}
                onPress={(l: any) => openAndClose(() => (navigation as any).navigate('ListDetail', { listId: l.internal_id }))}
              />
            )}
            ListEmptyComponent={<EmptyState title="No lists yet" />}
          />
        );
      default:
        return null;
    }
  };

  const activeLabel = TABS.find((t) => t.key === renderedSection)?.label ?? '';

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: safeBg }]} edges={safeEdges}>
      {topBar}
      <ScrollView
        style={{ backgroundColor: colors.cream }}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {profileHeader}
        {tilesEl}
        {garageEl}
      </ScrollView>

      <Modal
        visible={!!renderedSection}
        transparent
        animationType="none"
        onRequestClose={() => setActiveSection(null)}
      >
        <View style={styles.modalBackdrop}>
          {/* Fixed overlay — fades in/out, never slides */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveSection(null)} />
          {/* Sheet — slides up */}
          <Animated.View style={[styles.sheet, { backgroundColor: colors.cream, transform: [{ translateY: sheetY }] }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.fg }]}>{activeLabel}</Text>
              <TouchableOpacity onPress={() => setActiveSection(null)} hitSlop={8}>
                <X size={22} color={colors.grey} />
              </TouchableOpacity>
            </View>
            <View style={ss.fill}>{renderSectionContent()}</View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:            { paddingBottom: 24 },
  // Taller than a classic cover strip because the floating header sits over its
  // top portion — this keeps a usable amount of image visible beneath it.
  // 10/9 is the old 5/3 with 50% more height.
  bannerContainer: { width: '100%', aspectRatio: 10 / 9 },
  banner:          { width: '100%', height: '100%' },
  // Neutral, not brand-colored — at this height a solid accent block dominates
  // the screen for anyone without a cover image.
  bannerScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  avatarRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 16, marginTop: -52 },
  avatarWrap:      {
    width: 104, height: 104, borderRadius: 52,
    overflow: 'hidden',
    backgroundColor: colors.primaryAlt,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  headerActions: { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  iconBtn:       {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  followRow:  { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  msgBtn:     { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  msgBtnText: { fontSize: 14, fontWeight: '600' },
  profileMenuBtn: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  info:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:       { fontSize: 20, fontWeight: '800' },
  memberBadge: {
    minWidth: 26, height: 26, borderRadius: 13,
    paddingHorizontal: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  memberBadgeText: { color: '#000000', fontSize: 13, fontWeight: '800' },
  username:   { fontSize: 14, marginTop: 2 },
  bioWrap:    { marginTop: 8 },
  bio:        { fontSize: 14, lineHeight: 20 },
  moreLink:   { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline', marginTop: 4 },
  location:   { fontSize: 13, marginTop: 4 },
  tilesGrid:  {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingTop: 4, gap: 10,
  },
  tile:       {
    flexBasis: '48%', flexGrow: 1,
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tileCount:  { fontSize: 22, fontWeight: '800' },
  tileLabel:  { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet:         { height: '85%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  sheetHeader:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  sheetTitle:    { fontSize: 17, fontWeight: '800' },
  modalList:     { paddingBottom: 32 },
  userSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  userSearchInput: { flex: 1, fontSize: 14 },

  postRowThumb: { width: 58, height: 58, borderRadius: 6 },

  garageSection: { marginTop: 18 },
  garageHeader:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 6,
  },
  garageTitle:   { fontSize: 18, fontWeight: '800' },
  garageCount:   { fontSize: 14, fontWeight: '700' },
  garageCarousel: {
    gap: GARAGE_GUTTER, paddingLeft: GARAGE_GUTTER, paddingTop: 6,
  },
  garageCarouselItem: { width: GARAGE_CARD_WIDTH },
  newListBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 12, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  newListBtnText:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  userRowText:     { flex: 1 },
  userRowName:     { fontSize: 15, fontWeight: '600' },
  userRowUsername: { fontSize: 13, marginTop: 1 },
  moreBtn:         { padding: 4, marginLeft: 4 },
  blockedPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  blockedPillText: { fontSize: 12, fontWeight: '700' },
  unblockBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginLeft: 8 },
  unblockBtnText:  { fontSize: 13, fontWeight: '700' },
});
