import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Dimensions, FlatList, Modal, StatusBar, SafeAreaView as RNSafeAreaView,
  ActivityIndicator, Alert, Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Images, MoreHorizontal, Plus } from 'lucide-react-native';
import ReportButton from '../../components/ui/ReportButton';
import { useNavigation } from '@react-navigation/native';
import AppHeader from '../../components/ui/AppHeader';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetCarWithUserQuery, useGetCarTasksQuery,
  useGetCarGalleriesQuery, useGetUserByIdQuery, useGetPostsQuery, useGetCarModsQuery,
  useDeleteCarMutation, useCreateCarGalleryMutation,
  useCreateModMutation, useUpdateModMutation, useDeleteModMutation,
  useUpdateCarGalleryMutation, useDeleteCarGalleryMutation,
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
import { CAR_TYPES, CAR_CATEGORIES, MOD_TYPES } from '../../constants/carTypes';
import type { AppStackParamList } from '../../navigation/types';
import type { CarGalleryAlbum, GalleryItem, Mod } from '../../types/api';
import { ss } from '../../styles/shared';

const ALL_CATEGORIES = Object.values(CAR_CATEGORIES).flat();
function carTypeLabel(key?: string) {
  return CAR_TYPES.find((t) => t.key === key)?.label ?? key ?? '';
}
function carCategoryLabel(key?: string) {
  return ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key ?? '';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH * 0.88;
const ALBUM_COL_WIDTH = 200;
const GALLERY_HEIGHT = 280;

type Sheet = 'mods' | 'gallery' | 'gallery-edit' | null;

// ── Full-screen lightbox ─────────────────────────────────────────────────────

function LightboxPage({ item, height }: { item: GalleryItem; height: number }) {
  return (
    <ScrollView
      style={{ width: SCREEN_WIDTH, height }}
      contentContainerStyle={{ width: SCREEN_WIDTH, height }}
      maximumZoomScale={5}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      scrollEnabled
    >
      <Image
        source={{ uri: imageUrl(item.filename)! }}
        style={{ width: SCREEN_WIDTH, height }}
        contentFit="contain"
      />
    </ScrollView>
  );
}

function Lightbox({
  images, initialIndex, title, onClose,
}: { images: GalleryItem[]; initialIndex: number; title?: string; onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [listHeight, setListHeight] = useState(SCREEN_HEIGHT - 80);
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
          style={{ flex: 1 }}
          onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
          data={images}
          keyExtractor={(img, i) => img.filename ?? String(i)}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => <LightboxPage item={item} height={listHeight} />}
        />
      </RNSafeAreaView>
    </Modal>
  );
}

// ── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({ album, onPress, onManage }: { album: CarGalleryAlbum; onPress: () => void; onManage?: () => void }) {
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
      {onManage && (
        <TouchableOpacity style={styles.albumManageBtn} onPress={(e) => { e.stopPropagation(); onManage(); }} hitSlop={6}>
          <MoreHorizontal size={16} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ── Gallery strip ────────────────────────────────────────────────────────────

function CarGalleryStrip({ carId, heroFilename, onAddGallery, onManageAlbum }: { carId: string; heroFilename?: string; onAddGallery?: () => void; onManageAlbum?: (album: CarGalleryAlbum) => void }) {
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
                onManage={onManageAlbum ? () => onManageAlbum(album) : undefined}
              />
            ))}
          </View>
        ))}
        {onAddGallery && (
          <TouchableOpacity
            style={styles.addGalleryCard}
            onPress={onAddGallery}
            activeOpacity={0.7}
          >
            <Plus size={22} color="rgba(255,255,255,0.6)" />
            <Text style={styles.addGalleryText}>Add Gallery</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── Mod card ─────────────────────────────────────────────────────────────────

function ModCard({ mod, colors, onOptions }: { mod: Mod; colors: ReturnType<typeof useColors>; onOptions?: () => void }) {
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
          {onOptions && (
            <TouchableOpacity onPress={onOptions} hitSlop={8} style={modStyles.optionsBtn}>
              <MoreHorizontal size={18} color={colors.grey} />
            </TouchableOpacity>
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
  optionsBtn:{ padding: 2, marginLeft: 2 },
  desc:      { fontSize: 13, lineHeight: 18, marginTop: 6 },
});

// ── Animated bottom sheet ────────────────────────────────────────────────────

function BottomSheet({
  visible, onClose, title, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const c = useColors();
  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setRendered(true);
      slideY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        mountedRef.current = false;
        setRendered(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)', opacity: overlayOpacity }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[styles.sheet, { backgroundColor: c.cream, transform: [{ translateY: slideY }] }]}
        >
          <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
            <Text style={[styles.sheetTitle, { color: c.fg }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={c.grey} />
            </TouchableOpacity>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CarDetailScreen({ route }: { route: { params: { carId: string } } }) {
  const { carId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const localNav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryImages, setGalleryImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [editingMod, setEditingMod] = useState<Mod | null>(null);
  const [editModTitle, setEditModTitle] = useState('');
  const [editModType, setEditModType] = useState('general');
  const [editModBody, setEditModBody] = useState('');
  const [editingAlbum, setEditingAlbum] = useState<CarGalleryAlbum | null>(null);
  const [editAlbumTitle, setEditAlbumTitle] = useState('');
  const [editAlbumRemovedFilenames, setEditAlbumRemovedFilenames] = useState<string[]>([]);
  const [editAlbumNewImages, setEditAlbumNewImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [deleteCar] = useDeleteCarMutation();
  const [createCarGallery, { isLoading: creatingGallery }] = useCreateCarGalleryMutation();
  const [updateMod, { isLoading: updatingMod }] = useUpdateModMutation();
  const [deleteMod] = useDeleteModMutation();
  const [updateCarGallery, { isLoading: updatingGallery }] = useUpdateCarGalleryMutation();
  const [deleteCarGallery] = useDeleteCarGalleryMutation();

  const { data: car, isLoading } = useGetCarWithUserQuery(carId);
  const { data: coOwnerData } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  useGetCarTasksQuery(carId, { skip: !car });

  const { data: postsData, isFetching: postsFetching } = useGetPostsQuery(
    { car_id: carId, limit: 30 },
  );
  const posts = postsData?.entries ?? [];

  const { data: modsData, isFetching: modsFetching } = useGetCarModsQuery(
    carId,
    { skip: activeSheet !== 'mods' }
  );
  const mods = modsData?.entries ?? [];

  const isOwner = userInfo?.user_id === (car?.user_id ?? '');
  const isCoOwner = userInfo?.user_id === (car?.coowner_id ?? '');
  const isOwnerOrCoOwner = isOwner || isCoOwner;

  const handleMenuPress = useCallback(() => {
    if (!car) return;
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    Alert.alert(title, '', [
      { text: 'Add Mod',     onPress: () => appNav.navigate('ModCreate', { carId, carTitle: title }) },
      { text: 'Add Gallery', onPress: () => setActiveSheet('gallery') },
      { text: 'View Tasks',  onPress: () => setTasksOpen(true) },
      { text: 'Edit Car',    onPress: () => appNav.navigate('CarCreate', { carId }) },
      {
        text: 'Delete Car', style: 'destructive', onPress: () => {
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

  const pickGalleryImage = () => {
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) {
            const a = result.assets[0];
            setGalleryImages((prev) => [...prev, { uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }].slice(0, 20));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.85 });
          if (!result.canceled) {
            const newImgs = result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }));
            setGalleryImages((prev) => [...prev, ...newImgs].slice(0, 20));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreateGallery = async () => {
    if (!galleryTitle.trim()) { Alert.alert('Required', 'Please enter a title for this gallery.'); return; }
    const fd = new FormData();
    fd.append('car_id', carId);
    fd.append('title', galleryTitle.trim());
    galleryImages.forEach((img) => fd.append('gallery', { uri: img.uri, name: img.name, type: img.type } as any));
    try {
      await createCarGallery(fd).unwrap();
      setActiveSheet(null);
      setGalleryTitle('');
      setGalleryImages([]);
    } catch {
      Alert.alert('Error', 'Failed to create gallery. Please try again.');
    }
  };

  const handleModOptions = (mod: Mod) => {
    Alert.alert(mod.title ?? 'Mod', '', [
      {
        text: 'Edit', onPress: () => {
          setEditingMod(mod);
          setEditModTitle(mod.title ?? '');
          setEditModType(mod.type ?? 'general');
          setEditModBody(mod.body ?? '');
        },
      },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Delete Mod', `Remove "${mod.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try { await deleteMod({ internal_id: mod.internal_id }).unwrap(); }
                catch { Alert.alert('Error', 'Could not delete mod.'); }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUpdateMod = async () => {
    if (!editingMod || !editModTitle.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    const fd = new FormData();
    fd.append('internal_id', editingMod.internal_id);
    fd.append('car_id', carId);
    fd.append('title', editModTitle.trim());
    fd.append('type', editModType);
    if (editModBody.trim()) fd.append('body', editModBody.trim());
    try {
      await updateMod(fd).unwrap();
      setEditingMod(null);
    } catch {
      Alert.alert('Error', 'Could not update mod.');
    }
  };

  const handleAlbumOptions = (album: CarGalleryAlbum) => {
    Alert.alert(album.title ?? 'Gallery', '', [
      {
        text: 'Edit', onPress: () => {
          setEditingAlbum(album);
          setEditAlbumTitle(album.title ?? '');
          setEditAlbumRemovedFilenames([]);
          setEditAlbumNewImages([]);
          setActiveSheet('gallery-edit');
        },
      },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Delete Gallery', `Remove "${album.title ?? 'this gallery'}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try { await deleteCarGallery({ internal_id: album.internal_id }).unwrap(); }
                catch { Alert.alert('Error', 'Could not delete gallery.'); }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickEditAlbumImage = () => {
    Alert.alert('Add Photo', 'How would you like to add a photo?', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) {
            const a = result.assets[0];
            setEditAlbumNewImages((prev) => [...prev, { uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }].slice(0, 20));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.85 });
          if (!result.canceled) {
            const newImgs = result.assets.map((a) => ({ uri: a.uri, name: a.fileName ?? `photo_${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }));
            setEditAlbumNewImages((prev) => [...prev, ...newImgs].slice(0, 20));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUpdateAlbum = async () => {
    if (!editingAlbum || !editAlbumTitle.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    const fd = new FormData();
    fd.append('internal_id', editingAlbum.internal_id);
    fd.append('car_id', carId);
    fd.append('title', editAlbumTitle.trim());
    editAlbumRemovedFilenames.forEach((filename, i) => {
      fd.append(`modifyImage:remove:${i}`, filename);
    });
    editAlbumNewImages.forEach((img) => fd.append('gallery', { uri: img.uri, name: img.name, type: img.type } as any));
    try {
      await updateCarGallery(fd).unwrap();
      setActiveSheet(null);
      setEditingAlbum(null);
      setEditAlbumTitle('');
      setEditAlbumRemovedFilenames([]);
      setEditAlbumNewImages([]);
    } catch {
      Alert.alert('Error', 'Could not update gallery.');
    }
  };

  if (isLoading || !car) return <Spinner fullScreen />;

  const owner = car.user;
  const displayName = owner?.username || 'Unknown';
  const coOwnerName = coOwnerData?.username ?? '';

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
  ].filter((s) => s.value);

  const specPairs: (typeof specs)[] = [];
  for (let i = 0; i < specs.length; i += 2) specPairs.push(specs.slice(i, i + 2));

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.primaryAlt }]} edges={['top']}>
      <AppHeader />
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>

        {/* ── Gallery strip ── */}
        <View style={styles.galleryWrap}>
          <CarGalleryStrip
            carId={carId}
            heroFilename={heroFilename}
            onAddGallery={isOwnerOrCoOwner ? () => setActiveSheet('gallery') : undefined}
            onManageAlbum={isOwnerOrCoOwner ? handleAlbumOptions : undefined}
          />
        </View>

        {/* ── Title + owners ── */}
        <View style={[styles.titleSection, { backgroundColor: colors.bgDark }]}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              {car.title ? (
                <>
                  <Text style={[styles.carTitle, { color: colors.fg }]}>{car.title}</Text>
                  <Text style={[styles.carSubtitle, { color: colors.grey }]}>
                    {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
                  </Text>
                </>
              ) : (
                <Text style={[styles.carTitle, { color: colors.fg }]}>
                  {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
                </Text>
              )}
            </View>
            {isOwnerOrCoOwner ? (
              <TouchableOpacity onPress={handleMenuPress} hitSlop={8} style={styles.menuBtn}>
                <MoreHorizontal size={22} color={colors.fg} />
              </TouchableOpacity>
            ) : (
              <ReportButton contentType="car" contentId={carId} size={22} />
            )}
          </View>

          {/* Type + Category badges */}
          {(car.type || car.category) && (
            <View style={styles.badgeRow}>
              {car.type && (
                <View style={[styles.carBadge, { backgroundColor: colors.segment }]}>
                  <Text style={[styles.carBadgeText, { color: colors.grey }]}>{carTypeLabel(car.type)}</Text>
                </View>
              )}
              {car.category && (
                <View style={[styles.carBadge, { backgroundColor: colors.segment }]}>
                  <Text style={[styles.carBadgeText, { color: colors.grey }]}>{carCategoryLabel(car.category)}</Text>
                </View>
              )}
            </View>
          )}

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
                <Text style={[styles.ownerName, { color: colors.fg }]}>@{displayName}</Text>
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
                  <Text style={[styles.ownerName, { color: colors.fg }]}>@{coOwnerName}</Text>
                  <View style={[styles.coOwnerBadge, { backgroundColor: colors.segment }]}>
                    <Text style={[styles.coOwnerBadgeText, { color: colors.grey }]}>co-owner</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Mods button ── */}
        <View style={[styles.actionRow, { backgroundColor: colors.bgDark, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setActiveSheet('mods')}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, { color: colors.fg }]}>Mods</Text>
          </TouchableOpacity>
        </View>

        {/* ── Specs (always visible) ── */}
        <View style={[styles.specsSection, { backgroundColor: colors.bgDark }]}>
          <Text style={[styles.sectionTitle, { color: colors.fg }]}>Specs</Text>
          {specs.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.grey }]}>No specs added yet.</Text>
          ) : (
            <View style={[styles.specGrid, { borderColor: colors.border, borderWidth: 1 }]}>
              {specPairs.map((pair, rowIdx) => (
                <View
                  key={rowIdx}
                  style={[styles.specGridRow, rowIdx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                >
                  {pair.map((spec, colIdx) => (
                    <View
                      key={spec.label}
                      style={[
                        styles.specCell,
                        colIdx === 0 && pair.length === 2 && { borderRightWidth: 1, borderRightColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.specCellLabel, { color: colors.grey }]}>{spec.label}</Text>
                      <Text style={[styles.specCellValue, { color: colors.fg }]}>{spec.value}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Inline posts (Records) ── */}
        <View style={[styles.postsSection, { backgroundColor: colors.bgDark, borderTopColor: colors.border }]}>
          <View style={styles.postsSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.fg }]}>Records</Text>
            {isOwnerOrCoOwner && (
              <TouchableOpacity
                style={[styles.inlineCreateBtn, { backgroundColor: colors.primaryAlt }]}
                onPress={() => appNav.navigate('Create')}
                activeOpacity={0.85}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.inlineCreateBtnText}>Create</Text>
              </TouchableOpacity>
            )}
          </View>
          {postsFetching ? (
            <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginVertical: 32 }} />
          ) : posts.length === 0 ? (
            <EmptyState title="No records yet" />
          ) : (
            posts.map((item) => (
              <FeedItemCard
                key={item.internal_id}
                post={item}
                onPress={() => appNav.navigate('PostDetailModal', { postId: item.internal_id })}
              />
            ))
          )}
        </View>

      </ScrollView>

      {/* ── Mods sheet ── */}
      <BottomSheet
        visible={activeSheet === 'mods'}
        onClose={() => { setActiveSheet(null); setEditingMod(null); }}
        title={editingMod ? 'Edit Mod' : 'Mods'}
      >
        {editingMod ? (
          /* ── Edit form ── */
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
            <TextInput
              style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card, marginBottom: 20 }]}
              value={editModTitle}
              onChangeText={setEditModTitle}
              placeholder="Mod title"
              placeholderTextColor={colors.grey}
              autoCapitalize="sentences"
            />
            <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {MOD_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.modTypeChip, { borderColor: colors.border, backgroundColor: colors.card }, editModType === t.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }]}
                  onPress={() => setEditModType(t.key)}
                >
                  <Text style={[styles.modTypeChipText, { color: colors.fg }, editModType === t.key && { color: '#FFFFFF' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>
              Description <Text style={[styles.gallerySheetLabel, { color: colors.grey, fontWeight: '400' }]}>(optional)</Text>
            </Text>
            <TextInput
              style={[ss.input, ss.inputMulti, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card, marginBottom: 20 }]}
              value={editModBody}
              onChangeText={setEditModBody}
              placeholder="Describe this mod..."
              placeholderTextColor={colors.grey}
              multiline
              numberOfLines={4}
              autoCapitalize="sentences"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.sheetCreateBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => setEditingMod(null)}
                activeOpacity={0.85}
              >
                <Text style={[styles.sheetCreateBtnText, { color: colors.fg }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetCreateBtn, { flex: 2, backgroundColor: colors.primaryAlt, opacity: updatingMod ? 0.5 : 1 }]}
                onPress={handleUpdateMod}
                disabled={updatingMod}
                activeOpacity={0.85}
              >
                {updatingMod
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.sheetCreateBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          /* ── Mod list ── */
          <>
            {isOwnerOrCoOwner && (
              <TouchableOpacity
                style={[styles.sheetCreateBtn, { backgroundColor: colors.primaryAlt }]}
                onPress={() => { setActiveSheet(null); appNav.navigate('ModCreate', { carId, carTitle: [car.year, car.make, car.model].filter(Boolean).join(' ') }); }}
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
                <Text style={styles.sheetCreateBtnText}>Add Mod</Text>
              </TouchableOpacity>
            )}
            {modsFetching ? (
              <ActivityIndicator size="large" color={colors.primaryAlt} style={{ marginVertical: 40 }} />
            ) : mods.length === 0 ? (
              <EmptyState title="No mods yet" />
            ) : (
              <FlatList
                data={mods}
                keyExtractor={(m) => m.internal_id}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
                renderItem={({ item }) => (
                  <ModCard
                    mod={item}
                    colors={colors}
                    onOptions={isOwnerOrCoOwner ? () => handleModOptions(item) : undefined}
                  />
                )}
              />
            )}
          </>
        )}
      </BottomSheet>

      {/* ── Gallery create sheet ── */}
      <BottomSheet visible={activeSheet === 'gallery'} onClose={() => { setActiveSheet(null); setGalleryTitle(''); setGalleryImages([]); }} title="New Gallery">
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
          <TextInput
            style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card, marginBottom: 20 }]}
            value={galleryTitle}
            onChangeText={setGalleryTitle}
            placeholder="e.g. Build Photos"
            placeholderTextColor={colors.grey}
            autoCapitalize="sentences"
          />
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Photos</Text>
          <View style={styles.galleryImageGrid}>
            {galleryImages.map((img, i) => (
              <View key={i} style={styles.galleryThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.galleryThumb} contentFit="cover" />
                <TouchableOpacity style={styles.galleryThumbRemove} onPress={() => setGalleryImages((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={4}>
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            {galleryImages.length < 20 && (
              <TouchableOpacity style={[styles.galleryAddPhoto, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={pickGalleryImage}>
                <Plus size={20} color={colors.grey} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.sheetCreateBtn, { backgroundColor: colors.primaryAlt, opacity: creatingGallery ? 0.5 : 1, marginTop: 20 }]}
            onPress={handleCreateGallery}
            disabled={creatingGallery}
            activeOpacity={0.85}
          >
            {creatingGallery
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <><Plus size={16} color="#FFFFFF" /><Text style={styles.sheetCreateBtnText}>Create Gallery</Text></>
            }
          </TouchableOpacity>
        </ScrollView>
      </BottomSheet>

      {/* ── Gallery edit sheet ── */}
      <BottomSheet
        visible={activeSheet === 'gallery-edit'}
        onClose={() => { setActiveSheet(null); setEditingAlbum(null); setEditAlbumTitle(''); setEditAlbumRemovedFilenames([]); setEditAlbumNewImages([]); }}
        title="Edit Gallery"
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
          <TextInput
            style={[ss.input, { borderColor: colors.inputBorder, color: colors.fg, backgroundColor: colors.card, marginBottom: 20 }]}
            value={editAlbumTitle}
            onChangeText={setEditAlbumTitle}
            placeholder="Gallery title"
            placeholderTextColor={colors.grey}
            autoCapitalize="sentences"
          />
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Photos</Text>
          <View style={styles.galleryImageGrid}>
            {/* Existing images */}
            {(editingAlbum?.gallery ?? [])
              .filter((img) => img.filename && !editAlbumRemovedFilenames.includes(img.filename))
              .map((img, i) => (
                <View key={`existing-${i}`} style={styles.galleryThumbWrap}>
                  <Image source={{ uri: imageUrl(img.filename)! }} style={styles.galleryThumb} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.galleryThumbRemove}
                    onPress={() => img.filename && setEditAlbumRemovedFilenames((prev) => [...prev, img.filename!])}
                    hitSlop={4}
                  >
                    <X size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))
            }
            {/* New images */}
            {editAlbumNewImages.map((img, i) => (
              <View key={`new-${i}`} style={styles.galleryThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.galleryThumb} contentFit="cover" />
                <TouchableOpacity
                  style={styles.galleryThumbRemove}
                  onPress={() => setEditAlbumNewImages((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={4}
                >
                  <X size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.galleryAddPhoto, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={pickEditAlbumImage}
            >
              <Plus size={20} color={colors.grey} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
            <TouchableOpacity
              style={[styles.sheetCreateBtn, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => { setActiveSheet(null); setEditingAlbum(null); setEditAlbumTitle(''); setEditAlbumRemovedFilenames([]); setEditAlbumNewImages([]); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetCreateBtnText, { color: colors.fg }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetCreateBtn, { flex: 2, backgroundColor: colors.primaryAlt, opacity: updatingGallery ? 0.5 : 1 }]}
              onPress={handleUpdateAlbum}
              disabled={updatingGallery}
              activeOpacity={0.85}
            >
              {updatingGallery
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.sheetCreateBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>

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

  albumManageBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 4,
  },

  modTypeChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  modTypeChipText: { fontSize: 13, fontWeight: '600' },

  addGalleryCard: {
    width: ALBUM_COL_WIDTH, height: GALLERY_HEIGHT, borderRadius: 10,
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addGalleryText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

  gallerySheetLabel:  { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  galleryImageGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  galleryThumbWrap:   { position: 'relative' },
  galleryThumb:       { width: 72, height: 72, borderRadius: 8 },
  galleryThumbRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, padding: 3 },
  galleryAddPhoto:    { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  lightboxSafe:   { flex: 1, backgroundColor: '#000' },
  lightboxHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  lightboxTitle:  { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  lightboxCount:  { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  lightboxClose:  { padding: 8 },

  titleSection:   { padding: 16 },
  titleRow:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleLeft:      { flex: 1, marginRight: 12 },
  menuBtn:        { padding: 4 },
  carTitle:       { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  carSubtitle:    { fontSize: 14, marginTop: 3, fontWeight: '500' },
  badgeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  carBadge:       { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  carBadgeText:   { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  carDescription: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  likeRow:        { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },

  ownerCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: 10 },
  coOwnerCard:     { marginTop: 8, borderTopWidth: 1 },
  ownerInfo:       { flex: 1 },
  ownerName:       { fontSize: 15, fontWeight: '700' },
  ownerUsername:   { fontSize: 12, marginTop: 1 },
  coOwnerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coOwnerBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  coOwnerBadgeText: { fontSize: 11, fontWeight: '700' },

  actionRow:      {
    flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  actionBtn:      { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  actionBtnText:  { fontSize: 14, fontWeight: '700' },

  specsSection:    { padding: 16 },
  postsSection:    { paddingBottom: 32, borderTopWidth: 1 },
  postsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  inlineCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  inlineCreateBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  sectionTitle:    { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  specGrid:        { borderRadius: 10, overflow: 'hidden' },
  specGridRow:     { flexDirection: 'row' },
  specCell:        { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  specCellLabel:   { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  specCellValue:   { fontSize: 15, fontWeight: '700' },
  emptyText:       { fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  sheet:          { maxHeight: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  sheetHeader:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetTitle:     { fontSize: 17, fontWeight: '700' },
  sheetCreateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 12, padding: 12, borderRadius: 10,
  },
  sheetCreateBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
