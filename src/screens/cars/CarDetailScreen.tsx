import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, FlatList, Modal, StatusBar, SafeAreaView as RNSafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wrench, X, Images } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGetCarWithUserQuery, useGetCarTasksQuery, useGetCarGalleriesQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import FeedList from '../../components/feed/FeedList';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import LikeButton from '../../components/social/LikeButton';
import FollowButton from '../../components/social/FollowButton';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { CarsScreenProps, AppStackParamList } from '../../navigation/types';
import type { CarGalleryAlbum, GalleryItem } from '../../types/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH * 0.88;
const ALBUM_COL_WIDTH = 200;
const GALLERY_HEIGHT = 280;

type Tab = 'overview' | 'posts' | 'mods' | 'tasks';

// ── Full-screen lightbox ─────────────────────────────────────────────────────

function Lightbox({
  images, initialIndex, title, onClose,
}: { images: GalleryItem[]; initialIndex: number; title?: string; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <RNSafeAreaView style={styles.lightboxSafe}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />

        {/* Header */}
        <View style={styles.lightboxHeader}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.lightboxTitle}>{title}</Text> : null}
            <Text style={styles.lightboxCount}>{index + 1} / {images.length}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.lightboxClose}>
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Images */}
        <FlatList
          data={images}
          keyExtractor={(img, i) => img.filename ?? String(i)}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => {
            setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
          }}
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
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.brgLight }]} />
      )}
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

// ── Gallery strip (Murray mobile layout) ────────────────────────────────────

function CarGalleryStrip({ carId, heroFilename }: { carId: string; heroFilename?: string }) {
  const [lightbox, setLightbox] = useState<{ images: GalleryItem[]; index: number; title?: string } | null>(null);
  const { data: galData } = useGetCarGalleriesQuery(carId);
  const albums = galData?.entries ?? [];

  const heroUrl = heroFilename ? imageUrl(heroFilename) : null;

  // Pair albums into columns of 2
  const albumCols: CarGalleryAlbum[][] = [];
  for (let i = 0; i < albums.length; i += 2) {
    albumCols.push(albums.slice(i, i + 2));
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.galleryStrip}
        snapToInterval={HERO_WIDTH + 10}
        decelerationRate="fast"
      >
        {/* Hero image */}
        {heroUrl ? (
          <TouchableOpacity
            style={[styles.heroSlide]}
            activeOpacity={0.92}
            onPress={() => heroFilename && setLightbox({ images: [{ filename: heroFilename }], index: 0, title: 'Hero' })}
          >
            <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.heroSlide, { backgroundColor: Colors.brgLight }]} />
        )}

        {/* Album columns */}
        {albumCols.map((pair, colIdx) => (
          <View key={colIdx} style={styles.albumCol}>
            {pair.map((album) => (
              <AlbumCard
                key={album.internal_id}
                album={album}
                onPress={() => {
                  if (album.gallery && album.gallery.length > 0) {
                    setLightbox({ images: album.gallery, index: 0, title: album.title });
                  }
                }}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          title={lightbox.title}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CarDetailScreen({ route }: CarsScreenProps<'CarDetail'>) {
  const { carId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: car, isLoading } = useGetCarWithUserQuery(carId);
  const { data: tasks = [] } = useGetCarTasksQuery(carId, { skip: activeTab !== 'tasks' });

  if (isLoading || !car) return <Spinner fullScreen />;

  const owner = car.user;
  const displayName = owner
    ? `${owner.firstName} ${owner.lastName}`.trim() || owner.username
    : 'Unknown';
  const isOwner = userInfo?.user_id === car.user_id;

  // hero: prefer profile_image, fall back to first gallery item
  const heroFilename = (car as any).profile_image
    || car.gallery?.[0]?.filename
    || undefined;

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
    { key: 'tasks',    label: 'Tasks' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[2]}>

        {/* ── Gallery strip ── */}
        <View style={styles.galleryWrap}>
          <CarGalleryStrip carId={carId} heroFilename={heroFilename} />
        </View>

        {/* ── Title + owner ── */}
        <View style={[styles.titleSection, { backgroundColor: colors.card }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={[styles.carTitle, { color: colors.fg }]}>
                {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
              </Text>
              {car.type && <Text style={[styles.carType, { color: colors.grey }]}>{car.type}</Text>}
            </View>
            {isOwner && (
              <TouchableOpacity
                onPress={() => appNav.navigate('CarTasks', { carId, carTitle: `${car.year} ${car.make} ${car.model}` })}
                style={[styles.taskBtn, { backgroundColor: colors.cream, borderColor: colors.border }]}
              >
                <Wrench size={18} color={Colors.brg} />
                <Text style={styles.taskBtnText}>Tasks</Text>
              </TouchableOpacity>
            )}
          </View>

          {car.body ? (
            <Text style={[styles.carDescription, { color: colors.muted }]}>{car.body}</Text>
          ) : null}

          {/* Like row */}
          <View style={[styles.likeRow, { borderTopColor: colors.border }]}>
            <LikeButton
              documentId={car.internal_id}
              entryType={(car as any).entry_type ?? 'garagecar'}
              initialCount={(car as any).likeCount ?? 0}
              initialLiked={(car as any).isLiked ?? false}
            />
          </View>

          {/* Owner card */}
          {owner && (
            <TouchableOpacity
              style={[styles.ownerCard, { backgroundColor: colors.cream }]}
              onPress={() => appNav.navigate('UserDetail', { userId: owner.user_id })}
            >
              <Avatar
                filename={owner.gallery?.[0]?.filename ?? owner.profilePicture}
                name={displayName}
                size={44}
              />
              <View style={styles.ownerInfo}>
                <Text style={[styles.ownerName, { color: colors.fg }]}>{displayName}</Text>
                {owner.username && (
                  <Text style={[styles.ownerUsername, { color: colors.grey }]}>@{owner.username}</Text>
                )}
              </View>
              {!isOwner && owner.username && (
                <FollowButton username={owner.username} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Sticky tab bar ── */}
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, { color: colors.grey }, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab content ── */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Specs</Text>
            {specs.map((s) => (
              <View key={s.label} style={[styles.specRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.specLabel, { color: colors.grey }]}>{s.label}</Text>
                <Text style={[styles.specValue, { color: colors.fg }]}>{s.value}</Text>
              </View>
            ))}
            {specs.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.grey }]}>No specs added yet.</Text>
            )}
          </View>
        )}

        {activeTab === 'posts' && <FeedList carId={carId} />}

        {activeTab === 'mods' && (
          <View style={styles.section}>
            <Text style={[styles.emptyText, { color: colors.grey }]}>Mods coming soon.</Text>
          </View>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.section}>
            {tasks.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.grey }]}>No tasks yet.</Text>
            ) : (
              tasks.map((task) => (
                <View key={task.internal_id} style={[styles.taskRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.taskDot, task.completed && styles.taskDotDone]} />
                  <Text style={[
                    styles.taskTitle, { color: colors.fg },
                    task.completed && { color: colors.grey, textDecorationLine: 'line-through' },
                  ]}>
                    {task.title}
                  </Text>
                  {task.priority && (
                    <Text style={[styles.taskPriority, { color: colors.grey }]}>{task.priority}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Gallery
  galleryWrap:    { height: GALLERY_HEIGHT + 24, backgroundColor: '#000' },
  galleryStrip:   { paddingHorizontal: 12, paddingVertical: 12, gap: 10, alignItems: 'flex-start' },
  heroSlide:      {
    width: HERO_WIDTH,
    height: GALLERY_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  albumCol:       { gap: 10 },
  albumCard:      {
    width: ALBUM_COL_WIDTH,
    height: (GALLERY_HEIGHT - 10) / 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  albumOverlay:   {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  albumTitle:     { flex: 1, color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginRight: 6 },
  albumCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  albumCount:     { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },

  // Lightbox
  lightboxSafe:   { flex: 1, backgroundColor: '#000' },
  lightboxHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  lightboxTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  lightboxCount:  { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  lightboxClose:  { padding: 8 },

  // Title section
  titleSection:   { padding: 16 },
  titleRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleLeft:      { flex: 1 },
  carTitle:       { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  carType:        { fontSize: 13, marginTop: 2, textTransform: 'capitalize' },
  carDescription: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  likeRow:        { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  taskBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  taskBtnText:    { fontSize: 13, fontWeight: '600', color: Colors.brg },
  ownerCard:      {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 16, padding: 12, borderRadius: 10,
  },
  ownerInfo:      { flex: 1 },
  ownerName:      { fontSize: 15, fontWeight: '700' },
  ownerUsername:  { fontSize: 12, marginTop: 1 },

  // Tab bar
  tabBar:         { flexDirection: 'row', borderBottomWidth: 1 },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: Colors.brg },
  tabText:        { fontSize: 13, fontWeight: '600' },
  tabTextActive:  { color: Colors.brg },

  // Tab content
  section:        { padding: 16 },
  sectionTitle:   { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  specRow:        {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1,
  },
  specLabel:      { fontSize: 13, fontWeight: '500' },
  specValue:      { fontSize: 13, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },
  emptyText:      { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  taskRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  taskDot:        { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.brg },
  taskDotDone:    { backgroundColor: Colors.green },
  taskTitle:      { flex: 1, fontSize: 14, fontWeight: '500' },
  taskPriority:   { fontSize: 11, textTransform: 'capitalize' },
});
