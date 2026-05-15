import React, { useState, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, FlatList, Modal, StatusBar, SafeAreaView as RNSafeAreaView,
  ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wrench, X, Images, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../../components/ui/AppHeader';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetCarWithUserQuery, useGetCarTasksQuery,
  useGetCarGalleriesQuery, useGetUserByIdQuery, useGetPostsQuery, useGetCarModsQuery,
  useDeleteCarMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import FeedItemCard from '../../components/cards/FeedItemCard';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import LikeButton from '../../components/social/LikeButton';
import FollowButton from '../../components/social/FollowButton';
import TasksSheet from '../../components/cars/TasksSheet';
import { imageUrl } from '../../utils/image';
import { stripHtml } from '../../utils/text';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import type { CarGalleryAlbum, GalleryItem, Mod } from '../../types/api';
import { ss } from '../../styles/shared';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH * 0.88;
const ALBUM_COL_WIDTH = 200;
const GALLERY_HEIGHT = 280;

type Tab = 'overview' | 'posts' | 'mods';

// ── Full-screen lightbox ─────────────────────────────────────────────────────

function Lightbox({
  images, initialIndex, title, onClose,
}: { images: GalleryItem[]; initialIndex: number; title?: string; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <RNSafeAreaView style={styles.lightboxSafe}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.lightboxHeader}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.lightboxTitle}>{title}</Text> : null}
            <Text style={styles.lightboxCount}>{index + 1} / {images.length}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.lightboxClose}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={images}
          keyExtractor={(img, i) => img.filename ?? String(i)}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, justifyContent: 'center' }}>
              <Image
                source={{ uri: imageUrl(item.filename)! }}
                style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
                contentFit="contain"
              />
            </View>
          )}
        />
      </RNSafeAreaView>
    </Modal>
  );
}

// ── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({ album, onPress }: { album: CarGalleryAlbum; onPress: () => void }) {
  const thumb = album.gallery?.[0] ? imageUrl(album.gallery[0].filename) : null;
  return (
    <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.85}>
      {thumb
        ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
        : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brgLight }]} />
      }
      <View style={styles.albumOverlay}>
        <Text style={styles.albumTitle} numberOfLines={1}>{album.title ?? 'Album'}</Text>
        <View style={styles.albumCountRow}>
          <Images size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.albumCount}>{album.gallery?.length ?? 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Gallery strip ────────────────────────────────────────────────────────────

function CarGalleryStrip({ carId, heroFilename }: { carId: string; heroFilename?: string }) {
  const [lightbox, setLightbox] = useState<{ images: GalleryItem[]; index: number; title?: string } | null>(null);
  const { data: galData } = useGetCarGalleriesQuery(carId);
  const albums = galData?.entries ?? [];
  const heroUrl = heroFilename ? imageUrl(heroFilename) : null;

  const albumCols: CarGalleryAlbum[][] = [];
  for (let i = 0; i < albums.length; i += 2) albumCols.push(albums.slice(i, i + 2));

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryStrip}
        snapToInterval={HERO_WIDTH + 10}
        decelerationRate="fast"
      >
        {heroUrl ? (
          <TouchableOpacity
            style={styles.heroSlide}
            activeOpacity={0.92}
            onPress={() => heroFilename && setLightbox({ images: [{ filename: heroFilename }], index: 0 })}
          >
            <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.heroSlide, { backgroundColor: colors.brgLight }]} />
        )}
        {albumCols.map((pair, colIdx) => (
          <View key={colIdx} style={styles.albumCol}>
            {pair.map((album) => (
              <AlbumCard
                key={album.internal_id}
                album={album}
                onPress={() => album.gallery?.length && setLightbox({ images: album.gallery, index: 0, title: album.title })}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── Mod card ─────────────────────────────────────────────────────────────────

function ModCard({ mod, colors }: { mod: Mod; colors: ReturnType<typeof useColors> }) {
  const thumb = mod.gallery?.[0] ? imageUrl(mod.gallery[0].filename) : null;
  return (
    <View style={[modStyles.card, { backgroundColor: colors.card }]}>
      {thumb && (
        <Image source={{ uri: thumb }} style={modStyles.thumb} contentFit="cover" />
      )}
      <View style={modStyles.body}>
        <View style={modStyles.titleRow}>
          <Text style={[modStyles.title, { color: colors.fg }]} numberOfLines={2}>{mod.title ?? 'Untitled'}</Text>
          {mod.type && (
            <View style={[modStyles.typeBadge, { backgroundColor: colors.segment }]}>
              <Text style={[modStyles.typeText, { color: colors.grey }]}>{mod.type}</Text>
            </View>
          )}
        </View>
        {mod.body ? (
          <Text style={[modStyles.desc, { color: colors.muted }]} numberOfLines={3}>{stripHtml(mod.body)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const modStyles = StyleSheet.create({
  card:      { marginHorizontal: 12, marginBottom: 8, borderRadius: 10, overflow: 'hidden' },
  thumb:     { width: '100%', height: 180 },
  body:      { padding: 12 },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  title:     { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, flexShrink: 0 },
  typeText:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  desc:      { fontSize: 13, lineHeight: 18, marginTop: 6 },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CarDetailScreen({ route }: { route: { params: { carId: string } } }) {
  const { carId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const localNav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const tabBarYRef = useRef(0);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [tasksOpen, setTasksOpen] = useState(false);
  const [deleteCar] = useDeleteCarMutation();

  const { data: car, isLoading } = useGetCarWithUserQuery(carId);
  const { data: coOwnerData } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  const { data: tasksData } = useGetCarTasksQuery(carId, { skip: !car });
  const openTaskCount = (tasksData?.entries ?? []).filter((t) => !t.completed).length;

  const { data: postsData, isFetching: postsFetching } = useGetPostsQuery(
    { car_id: carId, limit: 30 },
    { skip: activeTab !== 'posts' }
  );
  const posts = postsData?.entries ?? [];

  const { data: modsData, isFetching: modsFetching } = useGetCarModsQuery(
    carId,
    { skip: activeTab !== 'mods' }
  );
  const mods = modsData?.entries ?? [];

  const isOwner = userInfo?.user_id === (car?.user_id ?? '');

  const handleCogPress = useCallback(() => {
    if (!car) return;
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    Alert.alert(title, '', [
      { text: 'Edit', onPress: () => appNav.navigate('CarCreate', { carId }) },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert(
            'Delete Car',
            `Remove ${title} from your garage? This cannot be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete', style: 'destructive', onPress: async () => {
                  try {
                    await deleteCar({ internal_id: car.internal_id }).unwrap();
                    appNav.goBack();
                  } catch {
                    Alert.alert('Error', 'Could not delete car. Please try again.');
                  }
                },
              },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [car, appNav, carId, deleteCar]);

  const handleTabPress = useCallback((tab: Tab) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: tabBarYRef.current, animated: true });
  }, []);

  useLayoutEffect(() => {
    if (!car) return;
    const carTitle = [car.year, car.make, car.model].filter(Boolean).join(' ');
    appNav.setOptions({
      title: carTitle || 'Car',
      headerStyle: { backgroundColor: '#3C3C3E' },
      headerRight: isOwner ? () => (
        <TouchableOpacity onPress={handleCogPress} hitSlop={8}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={17} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      ) : undefined,
    });
  }, [car, isOwner, handleCogPress, appNav]);

  if (isLoading || !car) return <Spinner fullScreen />;

  const owner = car.user;
  const displayName = owner
    ? `${owner.firstName} ${owner.lastName}`.trim() || owner.username
    : 'Unknown';
  const coOwnerName = coOwnerData
    ? `${coOwnerData.firstName} ${coOwnerData.lastName}`.trim() || coOwnerData.username
    : '';

  const heroFilename = car.profile_image || car.gallery?.[0]?.filename || undefined;

  const specs: { label: string; value: string | undefined }[] = [
    { label: 'Year',      value: car.year },
    { label: 'Make',      value: car.make },
    { label: 'Model',     value: car.model },
    { label: 'Trim',      value: car.trim },
    { label: 'Color',     value: car.color },
    { label: 'Engine',    value: car.engine },
    { label: 'HP',        value: car.horsepower },
    { label: 'Torque',    value: car.torque },
    { label: 'Mileage',   value: car.mileage ? `${Number(car.mileage).toLocaleString()} mi` : undefined },
    { label: 'Condition', value: car.condition },
    { label: 'Type',      value: car.type },
  ].filter((s) => s.value);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'posts',    label: 'Posts' },
    { key: 'mods',     label: 'Mods' },
  ];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>

        {/* ── Gallery strip ── */}
        <View style={styles.galleryWrap}>
          <CarGalleryStrip carId={carId} heroFilename={heroFilename} />
        </View>

        {/* ── Title + owners ── */}
        <View style={[styles.titleSection, { backgroundColor: colors.bgDark }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={[styles.carTitle, { color: colors.fg }]}>
                {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
              </Text>
              {car.type && <Text style={[styles.carType, { color: colors.grey }]}>{car.type}</Text>}
            </View>
            {isOwner && (
              <TouchableOpacity
                onPress={() => setTasksOpen(true)}
                style={styles.taskBtn}
              >
                <Wrench size={16} color="#FFFFFF" />
                <Text style={styles.taskBtnText}>Tasks</Text>
                {openTaskCount > 0 && (
                  <View style={styles.taskBtnBadge}>
                    <Text style={styles.taskBtnBadgeText}>{openTaskCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          {car.body ? (
            <Text style={[styles.carDescription, { color: colors.muted }]}>{stripHtml(car.body)}</Text>
          ) : null}

          <View style={[styles.likeRow, { borderTopColor: colors.border }]}>
            <LikeButton
              documentId={car.internal_id}
              entryType={(car as any).entry_type ?? 'garagecar'}
              initialCount={(car as any).like_count ?? 0}
              initialLiked={(car as any).isLiked ?? false}
            />
          </View>

          {/* Owner */}
          {owner && (
            <TouchableOpacity
              style={[styles.ownerCard, { backgroundColor: colors.cream }]}
              onPress={() => (localNav as any).navigate('UserDetail', { userId: owner.user_id })}
            >
              <Avatar filename={owner.gallery?.[0]?.filename ?? owner.profilePicture} name={displayName} size={44} />
              <View style={styles.ownerInfo}>
                <Text style={[styles.ownerName, { color: colors.fg }]}>{displayName}</Text>
                {owner.username && <Text style={[styles.ownerUsername, { color: colors.grey }]}>@{owner.username}</Text>}
              </View>
              {!isOwner && owner.username && <FollowButton username={owner.username} />}
            </TouchableOpacity>
          )}

          {/* Co-owner */}
          {coOwnerData && (
            <TouchableOpacity
              style={[styles.ownerCard, styles.coOwnerCard, { backgroundColor: colors.cream, borderTopColor: colors.border }]}
              onPress={() => appNav.navigate('UserDetail', { userId: coOwnerData.user_id })}
            >
              <Avatar filename={coOwnerData.gallery?.[0]?.filename} name={coOwnerName} size={44} />
              <View style={styles.ownerInfo}>
                <View style={styles.coOwnerLabelRow}>
                  <Text style={[styles.ownerName, { color: colors.fg }]}>{coOwnerName}</Text>
                  <View style={[styles.coOwnerBadge, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.coOwnerBadgeText, { color: colors.grey }]}>co-owner</Text>
                  </View>
                </View>
                {coOwnerData.username && <Text style={[styles.ownerUsername, { color: colors.grey }]}>@{coOwnerData.username}</Text>}
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sticky tab bar ── */}
        <View
          style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onLayout={(e) => { tabBarYRef.current = e.nativeEvent.layout.y; }}
        >
          <View style={[styles.tabPillRow, { backgroundColor: colors.segment }]}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, activeTab === tab.key && styles.tabPillActive]}
                onPress={() => handleTabPress(tab.key)}
              >
                <Text style={[styles.tabPillText, { color: colors.grey }, activeTab === tab.key && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Tab content — no nested FlatList, use map() ── */}
        {activeTab === 'overview' && (
          <View style={[styles.section, { backgroundColor: colors.bgDark }]}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Specs</Text>
            {specs.map((s) => (
              <View key={s.label} style={[styles.specRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.specLabel, { color: colors.grey }]}>{s.label}</Text>
                <Text style={[styles.specValue, { color: colors.fg }]}>{s.value}</Text>
              </View>
            ))}
            {specs.length === 0 && <Text style={[styles.emptyText, { color: colors.grey }]}>No specs added yet.</Text>}
          </View>
        )}

        {activeTab === 'posts' && (
          <View style={{ backgroundColor: colors.bgDark }}>
            {postsFetching ? (
              <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 32 }} />
            ) : posts.length === 0 ? (
              <EmptyState title="No posts yet" />
            ) : (
              posts.map((post) => (
                <FeedItemCard
                  key={post.internal_id}
                  post={post}
                  onPress={() => appNav.navigate('PostDetailModal', { postId: post.internal_id })}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'mods' && (
          <View style={{ paddingTop: 8, paddingBottom: 24, backgroundColor: colors.bgDark }}>
            {modsFetching ? (
              <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginTop: 32 }} />
            ) : mods.length === 0 ? (
              <EmptyState title="No mods yet" />
            ) : (
              mods.map((mod) => (
                <ModCard key={mod.internal_id} mod={mod} colors={colors} />
              ))
            )}
          </View>
        )}

      </ScrollView>

      <TasksSheet
        carId={carId}
        carTitle={[car.year, car.make, car.model].filter(Boolean).join(' ')}
        visible={tasksOpen}
        onClose={() => setTasksOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  galleryWrap:    { height: GALLERY_HEIGHT + 24, backgroundColor: '#000' },
  galleryStrip:   { paddingHorizontal: 12, paddingVertical: 12, gap: 10, alignItems: 'flex-start' },
  heroSlide:      { width: HERO_WIDTH, height: GALLERY_HEIGHT, borderRadius: 12, overflow: 'hidden' },
  albumCol:       { gap: 10 },
  albumCard:      { width: ALBUM_COL_WIDTH, height: (GALLERY_HEIGHT - 10) / 2, borderRadius: 10, overflow: 'hidden' },
  albumOverlay:   {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  albumTitle:     { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginRight: 6 },
  albumCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  albumCount:     { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  lightboxSafe:   { flex: 1, backgroundColor: '#000' },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  lightboxCount:  { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  lightboxClose:  { padding: 8 },

  titleSection:   { padding: 16 },
  titleRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleLeft:      { flex: 1, marginRight: 12 },
  carTitle:       { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  carType:        { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  carDescription: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  likeRow:        { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },

  taskBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, backgroundColor: colors.primaryAlt,
  },
  taskBtnText:    { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  taskBtnBadge:   {
    backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 9,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  taskBtnBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  ownerCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: 10 },
  coOwnerCard:    { marginTop: 8, borderTopWidth: 1 },
  ownerInfo:      { flex: 1 },
  ownerName:      { fontSize: 15, fontWeight: '700' },
  ownerUsername:  { fontSize: 12, marginTop: 1 },
  coOwnerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coOwnerBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  coOwnerBadgeText: { fontSize: 11, fontWeight: '700' },

  tabBar:            { borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  tabPillRow:        { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  tabPill:           { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  tabPillActive:     { backgroundColor: colors.primaryAlt, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 },
  tabPillText:       { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  tabPillTextActive: { color: '#FFFFFF', fontWeight: '800' },

  section:        { padding: 16 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  specRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  specLabel:      { fontSize: 13, fontWeight: '500' },
  specValue:      { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  emptyText:      { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
