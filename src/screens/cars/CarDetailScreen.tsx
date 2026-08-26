import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Dimensions, FlatList, Modal, StatusBar, SafeAreaView as RNSafeAreaView,
  ActivityIndicator, Alert, Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Images, MoreHorizontal, MoreVertical, Plus, ChevronDown, ChevronUp, ChevronRight, CheckSquare, Users, Warehouse, Car, MessageCircle, MessageSquarePlus, Wrench } from 'lucide-react-native';
import ReportButton from '../../components/ui/ReportButton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetCarWithUserQuery, useGetCarTasksQuery,
  useGetCarGalleriesQuery, useGetUserByIdQuery, useGetPostsQuery, useGetCarModsQuery,
  useDeletePostMutation,
  useDeleteCarMutation,
  useCreateModMutation, useUpdateModMutation, useDeleteModMutation,
  useDeleteCarGalleryMutation,
  useCreateCarGalleryShellMutation, useAddCarGalleryImageMutation,
  useRemoveCarGalleryImagesMutation, useUpdateCarGalleryMetaMutation,
  useGetCarFollowStatusQuery, useFollowCarMutation, useUnfollowCarMutation,
  useGetCarFollowersQuery, useGetCarGroupsQuery, useGetCarsQuery,
  apiService,
} from '../../api/apiService';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { CATEGORY_LABELS } from '../../components/ui/Badge';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import RecordRow from '../../components/social/RecordRow';
import Avatar from '../../components/ui/Avatar';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import LikeButton from '../../components/social/LikeButton';
import FollowButton from '../../components/social/FollowButton';
import CommentsSheet from '../../components/social/CommentsSheet';
import InlineComments from '../../components/social/InlineComments';
import CarCard from '../../components/cards/CarCard';
import TasksSheet from '../../components/cars/TasksSheet';
import TaskProgressPie from '../../components/cars/TaskProgressPie';
import TaggedPostsRow from '../../components/cars/TaggedPostsRow';
import TaggedPostsPane from '../../components/cars/TaggedPostsPane';
import BottomSheet from '../../components/ui/SharedModal';
import ActionSheet from '../../components/ui/ActionSheet';
import { formatDistanceToNow } from 'date-fns';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { stripHtml } from '../../utils/text';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useBrandTextColor, useIsPro } from '../../hooks/useBrandColor';
import { CAR_TYPES, CAR_CATEGORIES, MOD_TYPES } from '../../constants/carTypes';
import type { AppStackParamList, CarDetailAction } from '../../navigation/types';
import type { CarGalleryAlbum, GalleryItem, Mod, Post, Group } from '../../types/api';
import PostEditSheet from '../../components/social/PostEditSheet';
import { ss } from '../../styles/shared';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { useRefreshControl } from '../../hooks/useRefreshControl';

const ALL_CATEGORIES = Object.values(CAR_CATEGORIES).flat();
function carTypeLabel(key?: string) {
  return CAR_TYPES.find((t) => t.key === key)?.label ?? key ?? '';
}
function carCategoryLabel(key?: string) {
  return ALL_CATEGORIES.find((c) => c.key === key)?.label ?? key ?? '';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_WIDTH = SCREEN_WIDTH * 0.92;
const ALBUM_COL_WIDTH = 260;
// Derived from the hero's width so the main image lands on 4:3 rather than the
// near-square it was at a fixed 380. The album cards and the strip's frame are
// both sized off this, so they follow it down.
const GALLERY_HEIGHT = Math.round(HERO_WIDTH * 3 / 4);

type Sheet = 'mods' | 'gallery' | 'gallery-edit' | null;
type CarPane = 'specs' | 'posts' | 'mods' | 'galleries' | 'followers' | 'groups' | 'otherModel' | 'otherMake' | 'tagged' | null;

// The app's true accent blue (useColors() remaps primaryAlt→gold for pro/admin,
// so reference the raw token for a consistently-blue Follow button).
const ACCENT_BLUE = 'rgb(37, 162, 211)';

// Near-black surfaces for the shared bottom-sheet / pane modal.
const SHEET_BG = '#161616';
const SHEET_HEADER_BG = '#0B0B0B';
const SHEET_FG = '#ECECEC';
const SHEET_BORDER = '#2A2A2A';
const SHEET_PLACEHOLDER = '#2A2A2A';

// Car-type badge colors — mirrors CarCard so type badges read the same everywhere.
const CAR_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: '#F0D689', text: '#000' },
  'weekend':      { bg: '#35B5FF', text: '#000' },
  'project':      { bg: '#F36943', text: '#000' },
  'garage-queen': { bg: '#FF479C', text: '#000' },
  'part-out':     { bg: '#00FF3F', text: '#000' },
  'other':        { bg: '#F0D689', text: '#000' },
};

const CAR_TILES: { key: Exclude<CarPane, null>; label: string }[] = [
  { key: 'specs',      label: 'Specs' },
  { key: 'posts',      label: 'Records' },
  { key: 'mods',       label: 'Mods' },
  { key: 'galleries',  label: 'Galleries' },
  { key: 'followers',  label: 'Followers' },
  { key: 'groups',     label: 'Groups' },
];

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
  images, initialIndex, title, onClose, onManage,
}: { images: GalleryItem[]; initialIndex: number; title?: string; onClose: () => void; onManage?: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [listHeight, setListHeight] = useState(SCREEN_HEIGHT - 80);
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <RNSafeAreaView style={styles.lightboxSafe}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.lightboxHeader}>
          <View style={{ flex: 1 }}>
            {title ? <Text style={styles.lightboxTitle}>{title}</Text> : null}
            <Text style={styles.lightboxCount}>{index + 1} / {images.length}</Text>
          </View>
          {onManage && (
            <TouchableOpacity onPress={onManage} style={styles.lightboxClose} hitSlop={6}>
              <MoreHorizontal size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
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

function CarGalleryStrip({ carId, heroFilename, onAddGallery, onManageAlbum, onOpenAlbum }: { carId: string; heroFilename?: string; onAddGallery?: () => void; onManageAlbum?: (album: CarGalleryAlbum) => void; onOpenAlbum: (album: CarGalleryAlbum) => void }) {
  const [lightbox, setLightbox] = useState<{ images: GalleryItem[]; index: number; title?: string } | null>(null);
  const { data: galData } = useGetCarGalleriesQuery(carId);
  const albums = galData?.entries ?? [];
  // Fall back to the first gallery-album photo when the car has no profile/gallery image.
  const albumHeroFilename = albums.find((a) => a.gallery?.[0]?.filename)?.gallery?.[0]?.filename;
  const effectiveHero = heroFilename ?? albumHeroFilename;
  const heroUrl = effectiveHero ? imageUrl(effectiveHero) : null;

  const albumCols: CarGalleryAlbum[][] = [];
  for (let i = 0; i < albums.length; i += 2) albumCols.push(albums.slice(i, i + 2));

  // Single image with no additional galleries → show it full-bleed instead of a card.
  if (albums.length === 0 && heroUrl) {
    return (
      <>
        <TouchableOpacity
          style={styles.fullHero}
          activeOpacity={0.95}
          onPress={() => effectiveHero && setLightbox({ images: [{ filename: effectiveHero }], index: 0 })}
        >
          <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </TouchableOpacity>
        {onAddGallery && (
          <TouchableOpacity style={styles.addGalleryOverlay} onPress={onAddGallery} activeOpacity={0.8}>
            <Plus size={15} color="rgba(255,255,255,0.85)" />
            <Text style={styles.addGalleryOverlayText}>Add Gallery</Text>
          </TouchableOpacity>
        )}
        {lightbox && (
          <Lightbox images={lightbox.images} initialIndex={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)} />
        )}
      </>
    );
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
        {heroUrl ? (
          <TouchableOpacity
            style={styles.heroSlide}
            activeOpacity={0.92}
            onPress={() => effectiveHero && setLightbox({ images: [{ filename: effectiveHero }], index: 0 })}
          >
            <Image source={{ uri: heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </TouchableOpacity>
        ) : (
          <Image source={require('../../../assets/car-placeholder.jpg')} style={[styles.heroSlide, { width: HERO_WIDTH }]} contentFit="cover" />
        )}
        {albumCols.map((pair, colIdx) => (
          <View key={colIdx} style={styles.albumCol}>
            {pair.map((album) => (
              <AlbumCard
                key={album.internal_id}
                album={album}
                onPress={() => onOpenAlbum(album)}
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
        <RowEndSpacer />
      </ScrollView>
      {lightbox && (
        <Lightbox images={lightbox.images} initialIndex={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── Filter chip (Records category filter) ────────────────────────────────────

function FilterChip({ label, active, onPress, accent }: { label: string; active: boolean; onPress: () => void; accent: string }) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        { borderColor: SHEET_BORDER },
        active && { backgroundColor: accent, borderColor: accent },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.filterChipText, { color: active ? pillTextColor(accent) : SHEET_FG }]}>{label}</Text>
    </TouchableOpacity>
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

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CarDetailScreen({ route }: { route: { params: { carId: string; action?: CarDetailAction } } }) {
  const { carId, action } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const localNav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const brandTextColor = useBrandTextColor();
  const isPro = useIsPro();
  const headerPad = useHeaderPad();
  const onHeaderScroll = useHeaderScroll(headerPad);
  const insets = useSafeAreaInsets();
  // Clear the floating tab bar (matches MainTabNavigator's height). Computed
  // rather than read via useBottomTabBarHeight, which throws when this screen
  // is presented from a root modal route outside the tabs.
  const tabBarClearance = 88 + insets.bottom;
  const scrollRef = useRef<ScrollView>(null);
  // A caller can ask for a sheet on arrival — "Add Gallery" from the car's card
  // opens this screen purely to get at the composer that lives on it.
  const [activeSheet, setActiveSheet] = useState<Sheet>(action === 'gallery' ? 'gallery' : null);
  const [modsExpanded, setModsExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descLines, setDescLines] = useState<number | null>(null);
  const [pane, setPane] = useState<CarPane>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Records pane filter — cleared whenever the pane leaves Records.
  const [recordCategory, setRecordCategory] = useState<string | null>(null);

  useEffect(() => {
    if (pane !== 'posts') setRecordCategory(null);
  }, [pane]);
  // Single top-level gallery viewer (lightbox). Opening it from inside the
  // galleries pane is deferred until the pane's modal has fully dismissed —
  // iOS can't present a modal on top of one that's still on screen.
  const [viewer, setViewer] = useState<{ album: CarGalleryAlbum; index: number } | null>(null);
  const pendingViewerRef = useRef<{ album: CarGalleryAlbum; index: number } | null>(null);
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [recordTypeFilter, setRecordTypeFilter] = useState<string | null>(null);
  const [recordCategoryFilter, setRecordCategoryFilter] = useState<string | null>(null);
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
  // Sequential upload progress: { current, total } while uploading, else null
  const [galleryProgress, setGalleryProgress] = useState<{ current: number; total: number } | null>(null);
  const [editProgress, setEditProgress] = useState<{ current: number; total: number } | null>(null);
  const creatingGallery = galleryProgress !== null;
  const updatingGallery = editProgress !== null;
  const dispatch = useAppDispatch();
  const [deleteCar] = useDeleteCarMutation();
  const [createCarGalleryShell] = useCreateCarGalleryShellMutation();
  const [addCarGalleryImage] = useAddCarGalleryImageMutation();
  const [removeCarGalleryImages] = useRemoveCarGalleryImagesMutation();
  const [updateCarGalleryMeta] = useUpdateCarGalleryMetaMutation();
  const [updateMod, { isLoading: updatingMod }] = useUpdateModMutation();
  const [deleteMod] = useDeleteModMutation();
  const [deleteCarGallery] = useDeleteCarGalleryMutation();

  const { data: car, isLoading, refetch: refetchCar } = useGetCarWithUserQuery(carId);
  const { data: coOwnerData } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  // The active list carries both done and outstanding items — only archiving
  // removes one — so completion is a count over what's already loaded.
  const { data: tasksData } = useGetCarTasksQuery(carId, { skip: !car });
  const tasks = tasksData?.entries ?? [];
  const taskTotal = tasks.length;
  const tasksDone = tasks.filter((t) => t.completed).length;
  const tasksOpen = taskTotal - tasksDone;

  const { data: postsData, isFetching: postsFetching, refetch: refetchPosts } = useGetPostsQuery(
    { car_id: carId, limit: 30 },
  );
  const posts = postsData?.entries ?? [];

  const { data: modsData, isFetching: modsFetching, refetch: refetchMods } = useGetCarModsQuery(
    carId,
    { skip: !car }
  );
  const mods = modsData?.entries ?? [];

  const { data: paneGalData, refetch: refetchGalleries } = useGetCarGalleriesQuery(carId, { skip: !car });
  const paneAlbums = paneGalData?.entries ?? [];

  // The car, and the three lists the page is made of. The mod and gallery
  // queries are skipped until the car loads, so they only join in once there
  // is one.
  const refreshControl = useRefreshControl(() => Promise.all([
    refetchCar(),
    refetchPosts(),
    ...(car ? [refetchMods(), refetchGalleries()] : []),
  ]));
  const { data: carFollowersData } = useGetCarFollowersQuery(carId, { skip: !car });
  const carFollowers = carFollowersData?.entries ?? [];
  // Asks the server which groups list this car, rather than reading
  // `car.group_id` — a car can be in a group purely because its owner is a
  // member and it matches the group's make/model, which never sets that field.
  const { data: carGroupsData } = useGetCarGroupsQuery(carId, { skip: !car });
  const carGroups = carGroupsData?.entries ?? [];
  // The backend filters on make_handle/model_handle (slugs), not display values.
  const makeHandle = car?.make_handle ?? car?.make?.toLowerCase();
  const modelHandle = car?.model_handle ?? car?.model?.toLowerCase().replace(/ /g, '-');
  const { data: otherModelData } = useGetCarsQuery(
    { make: makeHandle, model: modelHandle, limit: 24 },
    { skip: !makeHandle || !modelHandle },
  );
  const otherModelCars = (otherModelData?.entries ?? []).filter((c) => c.internal_id !== carId);
  const { data: otherMakeData } = useGetCarsQuery(
    { make: makeHandle, limit: 24 },
    { skip: !makeHandle },
  );
  const otherMakeCars = (otherMakeData?.entries ?? []).filter((c) => c.internal_id !== carId);

  const isOwner = userInfo?.user_id === (car?.user_id ?? '');
  const isCoOwner = userInfo?.user_id === (car?.coowner_id ?? '');
  const isOwnerOrCoOwner = isOwner || isCoOwner;

  /** What to call this car in menus and in tags handed to other screens. */
  const carDisplayName =
    car?.title || [car?.year, car?.make, car?.model].filter(Boolean).join(' ') || 'this car';

  // Pro owners get the to-do list promoted above the gallery; everyone else
  // who can edit sees it in the action row below.
  const showTodosAboveGallery = isOwnerOrCoOwner && isPro;

  const todosButton = (
    <TouchableOpacity
      style={[styles.tasksBtn, { backgroundColor: colors.primaryAlt }]}
      onPress={() => appNav.navigate('CarTasks', {
        carId,
        carTitle: car?.title || [car?.year, car?.make, car?.model].filter(Boolean).join(' '),
      })}
      activeOpacity={0.85}
    >
      {/* Both sides reserve the same width so the label sits on the button's
          centre line, not on the centre of whatever space is left over. */}
      <View style={styles.tasksBtnSide}>
        <CheckSquare size={18} color={brandTextColor} />
      </View>

      <Text style={[styles.tasksBtnText, styles.tasksBtnLabel, { color: brandTextColor }]}>
        To-dos
      </Text>

      <View style={[styles.tasksBtnSide, styles.tasksBtnSideEnd]}>
        {taskTotal > 0 && (
          <>
            <View style={[styles.taskCount, { backgroundColor: brandTextColor }]}>
              <Text style={[styles.taskCountText, { color: colors.primaryAlt }]}>
                {tasksOpen}
              </Text>
            </View>
            <TaskProgressPie completed={tasksDone} total={taskTotal} size={18} color={brandTextColor} />
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const { data: carFollowStatus } = useGetCarFollowStatusQuery(carId, { skip: !carId || isOwnerOrCoOwner });
  const [followCar, { isLoading: followingCar }] = useFollowCarMutation();
  const [unfollowCar, { isLoading: unfollowingCar }] = useUnfollowCarMutation();
  const isFollowingCar = carFollowStatus?.following ?? false;
  const carFollowBusy = followingCar || unfollowingCar;
  const followCarNow = useCallback(async () => {
    if (carFollowBusy || isFollowingCar) return;
    try {
      await followCar({ car_id: carId }).unwrap();
    } catch (e: any) {
      const msg = e?.data?.error ?? e?.data?.message ?? (typeof e?.error === 'string' ? e.error : '') ?? '';
      Alert.alert('Could not follow', msg || 'Please try again.');
    }
  }, [carFollowBusy, isFollowingCar, followCar, carId]);
  const handleCarFollowMenu = useCallback(() => {
    Alert.alert('Following this car', undefined, [
      {
        text: 'Unfollow',
        style: 'destructive',
        onPress: async () => {
          try {
            await unfollowCar({ car_id: carId }).unwrap();
          } catch {
            Alert.alert('Could not unfollow', 'Please try again.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [unfollowCar, carId]);

  // Same three choices as the car's own card offers, in the same sheet — the
  // two + buttons lead to the same places.
  const [addSheet, setAddSheet] = useState(false);
  const handleAddPress = useCallback(() => setAddSheet(true), []);

  const handleMenuPress = useCallback(() => {
    if (!car) return;
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    Alert.alert(title, undefined, [
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
            const picked = await normalizePickedAssets(result.assets);
            setGalleryImages((prev) => [...prev, ...picked].slice(0, 20));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
          if (!result.canceled) {
            const newImgs = await normalizePickedAssets(result.assets);
            setGalleryImages((prev) => [...prev, ...newImgs].slice(0, 20));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreateGallery = async () => {
    if (!galleryTitle.trim()) { Alert.alert('Required', 'Please enter a title for this gallery.'); return; }
    const images = galleryImages;
    setGalleryProgress({ current: 0, total: images.length });
    try {
      // 1. Create the empty gallery shell
      const { _id } = await createCarGalleryShell({ car_id: carId, title: galleryTitle.trim() }).unwrap();

      // 2. Upload each image one at a time, tracking progress
      let uploaded = 0;
      for (const img of images) {
        const fd = new FormData();
        fd.append('internal_id', _id);
        fd.append('gallery', uploadFile(img.uri));
        await addCarGalleryImage(fd).unwrap();
        uploaded += 1;
        setGalleryProgress({ current: uploaded, total: images.length });
      }

      // 3. Refresh the gallery list for this car
      dispatch(apiService.util.invalidateTags([{ type: 'CarGallery', id: carId }]));
      setActiveSheet(null);
      setGalleryTitle('');
      setGalleryImages([]);
    } catch {
      // The shell/some images may already have saved — refresh so the user sees what landed
      dispatch(apiService.util.invalidateTags([{ type: 'CarGallery', id: carId }]));
      Alert.alert('Upload incomplete', 'Some photos could not be uploaded. The gallery was saved — you can add the rest by editing it.');
      setActiveSheet(null);
      setGalleryTitle('');
      setGalleryImages([]);
    } finally {
      setGalleryProgress(null);
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

  // Open a gallery in the top-level viewer. If a pane (modal) is open, close it
  // first and open the viewer once it has dismissed — see pendingViewerRef.
  const openAlbum = (album: CarGalleryAlbum, index = 0) => {
    if (!album.gallery?.length) return;
    if (pane !== null) {
      pendingViewerRef.current = { album, index };
      setPane(null);
    } else {
      setViewer({ album, index });
    }
  };

  const handlePaneDismissed = () => {
    if (pendingViewerRef.current) {
      setViewer(pendingViewerRef.current);
      pendingViewerRef.current = null;
    }
  };

  /**
   * Reopens the pane you left when a record detail sends you away.
   *
   * The detail is a native-stack modal and the pane is an RN `<Modal>`; iOS
   * won't present one over the other, which is why the pane has to close first.
   * Remembering which pane it was and restoring it on the way back is the next
   * best thing — you land where you were instead of back on the car.
   */
  const restorePaneRef = useRef<CarPane>(null);
  useFocusEffect(
    useCallback(() => {
      if (restorePaneRef.current) {
        const p = restorePaneRef.current;
        restorePaneRef.current = null;
        setPane(p);
      }
    }, []),
  );

  const openRecord = (postId: string) => {
    restorePaneRef.current = pane;
    setPane(null);
    appNav.navigate('PostDetailModal', { postId });
  };

  const [deletePost] = useDeletePostMutation();
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const openRecordMenu = (post: Post) => {
    Alert.alert(post.title ?? 'Record', undefined, [
      { text: 'Edit', onPress: () => setEditingPost(post) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => Alert.alert('Delete record?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deletePost({ internal_id: post.internal_id }) },
        ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // iOS can't present a new modal until the current one has finished
  // dismissing; give it a beat. Android stacks modals fine, so run immediately.
  const presentAfterDismiss = (fn: () => void, hadModalOpen: boolean) => {
    if (hadModalOpen && Platform.OS === 'ios') setTimeout(fn, 350);
    else fn();
  };

  const openEditAlbum = (album: CarGalleryAlbum) => {
    const hadModalOpen = viewer !== null || pane !== null;
    setViewer(null);
    setPane(null);
    setEditingAlbum(album);
    setEditAlbumTitle(album.title ?? '');
    setEditAlbumRemovedFilenames([]);
    setEditAlbumNewImages([]);
    presentAfterDismiss(() => setActiveSheet('gallery-edit'), hadModalOpen);
  };

  const handleAlbumOptions = (album: CarGalleryAlbum) => {
    Alert.alert(album.title ?? 'Gallery', '', [
      {
        text: 'Edit', onPress: () => openEditAlbum(album),
      },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          Alert.alert('Delete Gallery', `Remove "${album.title ?? 'this gallery'}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await deleteCarGallery({ internal_id: album.internal_id }).unwrap();
                  // Close whichever surface the delete was triggered from
                  setViewer(null);
                  setPane(null);
                } catch { Alert.alert('Error', 'Could not delete gallery.'); }
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
            const picked = await normalizePickedAssets(result.assets);
            setEditAlbumNewImages((prev) => [...prev, ...picked].slice(0, 20));
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85 });
          if (!result.canceled) {
            const newImgs = await normalizePickedAssets(result.assets);
            setEditAlbumNewImages((prev) => [...prev, ...newImgs].slice(0, 20));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUpdateAlbum = async () => {
    if (!editingAlbum || !editAlbumTitle.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    const galleryId = editingAlbum.internal_id;
    const removed = editAlbumRemovedFilenames;
    const newImages = editAlbumNewImages;
    // Progress counts each unit of work: the removal batch (if any) + each new image
    const total = newImages.length + (removed.length ? 1 : 0);
    setEditProgress({ current: 0, total });
    try {
      let done = 0;

      // 1. Metadata (title) — cheap, do it first
      await updateCarGalleryMeta({ internal_id: galleryId, title: editAlbumTitle.trim() }).unwrap();

      // 2. Removals in a single request (no uploads, deletes from S3 server-side)
      if (removed.length) {
        await removeCarGalleryImages({ internal_id: galleryId, filenames: removed }).unwrap();
        done += 1;
        setEditProgress({ current: done, total });
      }

      // 3. Add each new image one at a time
      for (const img of newImages) {
        const fd = new FormData();
        fd.append('internal_id', galleryId);
        fd.append('gallery', uploadFile(img.uri));
        await addCarGalleryImage(fd).unwrap();
        done += 1;
        setEditProgress({ current: done, total });
      }

      dispatch(apiService.util.invalidateTags([{ type: 'CarGallery', id: carId }]));
      setActiveSheet(null);
      setEditingAlbum(null);
      setEditAlbumTitle('');
      setEditAlbumRemovedFilenames([]);
      setEditAlbumNewImages([]);
    } catch {
      dispatch(apiService.util.invalidateTags([{ type: 'CarGallery', id: carId }]));
      Alert.alert('Update incomplete', 'Some changes could not be saved. Please reopen the gallery to review and retry.');
      setActiveSheet(null);
      setEditingAlbum(null);
      setEditAlbumTitle('');
      setEditAlbumRemovedFilenames([]);
      setEditAlbumNewImages([]);
    } finally {
      setEditProgress(null);
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

  const paneTitle =
    pane === 'otherModel'
      ? `Other ${[car.make, car.model].filter(Boolean).join(' ')}`
      : pane === 'otherMake'
      ? `Other ${car.make} cars`
      : pane === 'tagged'
      ? 'Tagged in Posts'
      : CAR_TILES.find((t) => t.key === pane)?.label ?? '';

  const renderPane = () => {
    switch (pane) {
      case 'tagged':
        return (
          <TaggedPostsPane
            carId={car.internal_id}
            // Same route the records list opens, so the pane is closed and
            // restored on the way back rather than left under the post.
            onPostPress={(post) => openRecord(post.internal_id)}
          />
        );
      case 'specs':
        if (specs.length === 0) return <EmptyState title="No specs added yet" />;
        return (
          <View style={styles.paneSpecsWrap}>
            {specs.map((spec) => (
              <View key={spec.label} style={[styles.paneSpecRow, { borderBottomColor: SHEET_BORDER }]}>
                <Text style={[styles.paneSpecLabel, { color: colors.grey }]}>{spec.label}</Text>
                <Text style={[styles.paneSpecValue, { color: SHEET_FG }]}>{spec.value}</Text>
              </View>
            ))}
          </View>
        );
      case 'posts': {
        if (posts.length === 0) return <EmptyState title="No records yet" />;

        // Built from what this car actually has, so a filter never offers a
        // choice that returns nothing.
        const categoryKeys = Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[];
        const visiblePosts = recordCategory ? posts.filter((p) => p.category === recordCategory) : posts;

        const filtersEl = categoryKeys.length > 1 ? (
          <View style={[styles.recordFilters, { borderBottomColor: SHEET_BORDER }]}>
            <View style={styles.recordFilterRow}>
              <FilterChip label="All" active={!recordCategory} accent={colors.primaryAlt} onPress={() => setRecordCategory(null)} />
              {categoryKeys.map((c) => (
                <FilterChip
                  key={c}
                  label={CATEGORY_LABELS[c] ?? c}
                  active={recordCategory === c}
                  accent={categoryColor(c)}
                  onPress={() => setRecordCategory(recordCategory === c ? null : c)}
                />
              ))}
            </View>
          </View>
        ) : null;

        return (
          <>
            {filtersEl}
            {visiblePosts.length === 0
              ? <EmptyState title="No records match those filters" />
              : visiblePosts.map((item) => {
                  const thumb = firstGalleryUrl(item.gallery);
                  const title = item.title ?? (item.body ? stripHtml(item.body) : null);
                  const timeAgo = item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true }) : '';
                  return (
                    <RecordRow
                      key={item.internal_id}
                      title={title}
                      imageUri={thumb}
                      meta={timeAgo}
                      category={item.category}
                      onPress={() => openRecord(item.internal_id)}
                      onMenuPress={isOwnerOrCoOwner ? () => openRecordMenu(item) : undefined}
                      fg={SHEET_FG}
                      border={SHEET_BORDER}
                      placeholder={SHEET_PLACEHOLDER}
                    />
                  );
                })}
          </>
        );
      }
      case 'mods':
        if (mods.length === 0) return <EmptyState title="No mods yet" />;
        return mods.map((mod) => <ModCard key={mod.internal_id} mod={mod} colors={colors} />);
      case 'galleries':
        if (paneAlbums.length === 0) return <EmptyState title="No galleries yet" />;
        return paneAlbums.map((album) => {
          const thumb = album.gallery?.[0] ? imageUrl(album.gallery[0].filename) : null;
          return (
            <TouchableOpacity
              key={album.internal_id}
              style={[ss.listRow, { borderBottomColor: SHEET_BORDER }]}
              onPress={() => openAlbum(album)}
              activeOpacity={0.7}
            >
              {thumb
                ? <Image source={{ uri: thumb }} style={styles.recordThumb} contentFit="cover" />
                : <View style={[styles.recordThumb, { backgroundColor: SHEET_PLACEHOLDER }]} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: SHEET_FG, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{album.title ?? 'Album'}</Text>
                <Text style={{ color: colors.grey, fontSize: 12, marginTop: 2 }}>{album.gallery?.length ?? 0} photos</Text>
              </View>
              {isOwnerOrCoOwner ? (
                <TouchableOpacity onPress={() => handleAlbumOptions(album)} hitSlop={8} style={{ padding: 4 }}>
                  <MoreHorizontal size={20} color={colors.grey} />
                </TouchableOpacity>
              ) : (
                <ChevronRight size={18} color={colors.grey} />
              )}
            </TouchableOpacity>
          );
        });
      case 'followers':
        if (carFollowers.length === 0) return <EmptyState title="No followers yet" />;
        return carFollowers.map((u) => (
          <TouchableOpacity
            key={u.user_id}
            style={[ss.listRow, { borderBottomColor: SHEET_BORDER }]}
            onPress={() => { setPane(null); (localNav as any).navigate('UserDetail', { userId: u.user_id, username: u.username }); }}
            activeOpacity={0.7}
          >
            <Avatar user={u} size={40} />
            <Text style={{ flex: 1, color: SHEET_FG, fontSize: 15, fontWeight: '600' }}>@{u.username}</Text>
          </TouchableOpacity>
        ));
      case 'otherModel':
        if (otherModelCars.length === 0) return <EmptyState title={`No other ${[car.make, car.model].filter(Boolean).join(' ')} on the site yet`} />;
        return otherModelCars.map((c) => (
          <CarCard key={c.internal_id} car={c} onBeforeNavigate={() => setPane(null)} />
        ));
      case 'otherMake':
        if (otherMakeCars.length === 0) return <EmptyState title={`No other ${car.make} cars on the site yet`} />;
        return otherMakeCars.map((c) => (
          <CarCard key={c.internal_id} car={c} onBeforeNavigate={() => setPane(null)} />
        ));
      case 'groups':
        if (carGroups.length === 0) return <EmptyState title="Not in any group" />;
        return carGroups.map((g: Group) => {
          const banner = firstGalleryUrl(g.banners) ?? firstGalleryUrl(g.gallery);
          return (
            <TouchableOpacity
              key={g.internal_id}
              style={[ss.listRow, { borderBottomColor: SHEET_BORDER }]}
              onPress={() => { setPane(null); (appNav as any).navigate('GroupDetail', { groupId: g.internal_id }); }}
              activeOpacity={0.7}
            >
              {banner
                ? <Image source={{ uri: banner }} style={styles.recordThumb} contentFit="cover" />
                : <View style={[styles.recordThumb, { backgroundColor: SHEET_PLACEHOLDER }]} />}
              <Text style={{ flex: 1, color: SHEET_FG, fontSize: 15, fontWeight: '700' }}>{g.title}</Text>
              <ChevronRight size={18} color={colors.grey} />
            </TouchableOpacity>
          );
        });
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      {/* Lifts the page clear of the keyboard when the comment box is focused,
          matching the post pane. The offset is 0 rather than the post pane's 90
          because AppHeader floats absolutely here — this view already starts at
          the top of the screen. */}
      <KeyboardAvoidingView
        style={ss.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        refreshControl={refreshControl}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: tabBarClearance + 16 }}
        onScroll={onHeaderScroll}
        scrollEventThrottle={16}
        // Without this the first tap on Post is swallowed dismissing the
        // keyboard, so posting a comment takes two taps.
        keyboardShouldPersistTaps="handled"
      >

        {/* Car title leads the page and scrolls away with the content. */}
        <ScreenHeading
          title={car.title || [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
        />

        {/* Pro owners get their to-do list up front, ahead of the gallery. */}
        {showTodosAboveGallery && (
          <View style={styles.todosAbove}>{todosButton}</View>
        )}

        {/* ── Gallery strip ── */}
        <View style={styles.galleryWrap}>
          <CarGalleryStrip
            carId={carId}
            heroFilename={heroFilename}
            onAddGallery={isOwnerOrCoOwner ? () => setActiveSheet('gallery') : undefined}
            onManageAlbum={isOwnerOrCoOwner ? handleAlbumOptions : undefined}
            onOpenAlbum={openAlbum}
          />
        </View>

        {/* ── Title + owners ── */}
        <View style={[styles.titleSection]}>
          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              {/* The name is the page heading above; this line carries the
                  year/make/model detail, and only when it adds something. */}
              {car.title ? (
                <Text style={[styles.carSubtitle, { color: colors.grey }]}>
                  {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
                </Text>
              ) : null}
            </View>
            {/* Liking and commenting sit with the car's other controls rather
                than in a bar of their own below the description — they are two
                icons, and a full-width rule under a paragraph to hold them read
                as the end of the page. */}
            <View style={styles.titleActions}>
              <LikeButton
                documentId={car.internal_id}
                entryType={(car as any).entry_type ?? 'garagecar'}
                initialCount={(car as any).like_count ?? 0}
                initialLiked={(car as any).isLiked ?? false}
                size={20}
              />
              <TouchableOpacity
                style={styles.commentBtn}
                onPress={() => setCommentsOpen(true)}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Comments"
              >
                <MessageCircle size={20} color={colors.fg} />
              </TouchableOpacity>
              {isOwnerOrCoOwner ? (
                <>
                  <TouchableOpacity onPress={handleAddPress} hitSlop={8} style={[styles.addBtn, { backgroundColor: colors.primaryAlt }]}>
                    <Plus size={20} color={brandTextColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleMenuPress} hitSlop={8} style={styles.menuBtn}>
                    <MoreHorizontal size={22} color={colors.fg} />
                  </TouchableOpacity>
                </>
              ) : (
                <ReportButton contentType="car" contentId={carId} size={22} />
              )}
            </View>
          </View>

          {/* Type + Category badges */}
          {(car.type || car.category) && (
            <View style={styles.badgeRow}>
              {car.type && (
                <View style={[styles.carBadge, { backgroundColor: (CAR_TYPE_COLORS[car.type] ?? CAR_TYPE_COLORS.other).bg }]}>
                  <Text style={[styles.carBadgeText, { color: (CAR_TYPE_COLORS[car.type] ?? CAR_TYPE_COLORS.other).text }]}>{carTypeLabel(car.type)}</Text>
                </View>
              )}
              {car.category && (
                <View style={[styles.carBadge, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                  <Text style={[styles.carBadgeText, { color: '#FFFFFF' }]}>{carCategoryLabel(car.category)}</Text>
                </View>
              )}
            </View>
          )}

          {/* Owners — avatar + username chips */}
          {(owner || coOwnerData) && (
            <View style={styles.ownersRow}>
              {owner && (
                <TouchableOpacity
                  style={styles.ownerChip}
                  onPress={() => (localNav as any).navigate('UserDetail', { userId: owner.user_id })}
                  activeOpacity={0.8}
                >
                  <Avatar user={owner} size={34} />
                  <Text style={[styles.ownerChipName, { color: colors.fgDark }]} numberOfLines={1}>@{displayName}</Text>
                </TouchableOpacity>
              )}
              {coOwnerData && (
                <TouchableOpacity
                  style={styles.ownerChip}
                  onPress={() => appNav.navigate('UserDetail', { userId: coOwnerData.user_id })}
                  activeOpacity={0.8}
                >
                  <Avatar user={coOwnerData} size={34} />
                  <Text style={[styles.ownerChipName, { color: colors.fgDark }]} numberOfLines={1}>@{coOwnerName}</Text>
                  <View style={[styles.coOwnerBadge, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                    <Text style={[styles.coOwnerBadgeText, { color: '#FFFFFF' }]}>co</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {car.body ? (
            <View style={styles.descWrap}>
              <Text
                style={[styles.carDescription, { color: colors.fgDark }]}
                numberOfLines={descLines == null ? undefined : (descExpanded ? undefined : 3)}
                onTextLayout={descLines == null ? (e) => setDescLines(e.nativeEvent.lines.length) : undefined}
              >
                {stripHtml(car.body)}
              </Text>
              {descLines != null && descLines > 3 && (
                <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} hitSlop={6}>
                  <Text style={[styles.moreLink, { color: colors.fgDark }]}>{descExpanded ? 'Less' : 'More'}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {!isOwnerOrCoOwner && (
            <View style={[styles.followRow, { borderTopColor: colors.border }]}>
              <View style={styles.likeRowRight}>
                <TouchableOpacity
                  style={[
                    styles.followInlineBtn,
                    isFollowingCar
                      ? { backgroundColor: ACCENT_BLUE, borderColor: colors.border, borderWidth: 1.5 }
                      : { backgroundColor: ACCENT_BLUE },
                    carFollowBusy && { opacity: 0.6 },
                  ]}
                  onPress={isFollowingCar ? handleCarFollowMenu : followCarNow}
                  disabled={carFollowBusy}
                  activeOpacity={0.85}
                >
                  {carFollowBusy ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={[styles.followInlineText, { color: '#000000' }]}>
                      {isFollowingCar ? '✓ Following' : 'Follow Car'}
                    </Text>
                  )}
                </TouchableOpacity>
                {isFollowingCar && !carFollowBusy && (
                  <TouchableOpacity
                    style={styles.followMenuBlack}
                    onPress={handleCarFollowMenu}
                    hitSlop={8}
                    activeOpacity={0.8}
                  >
                    <MoreHorizontal size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {isOwnerOrCoOwner && (
            <>
              {/* Pro owners get this above the gallery instead — see todosButton. */}
              {!showTodosAboveGallery && todosButton}
              <TouchableOpacity
                style={[styles.followersBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setPane('followers')}
                activeOpacity={0.85}
              >
                <Users size={16} color={colors.fg} />
                <Text style={[styles.followersBtnText, { color: colors.fg }]}>
                  Followers ({carFollowersData?.total ?? carFollowers.length})
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Section tiles — open panes like the profile page ── */}
        <View style={[styles.tilesWrap]}>
          <View style={styles.carTilesGrid}>
            {(isOwnerOrCoOwner ? CAR_TILES.filter((t) => t.key !== 'followers') : CAR_TILES).map((t) => {
              const count =
                t.key === 'specs'      ? specs.length :
                t.key === 'posts'      ? (postsData?.total ?? posts.length) :
                t.key === 'mods'       ? (modsData?.total ?? mods.length) :
                t.key === 'galleries'  ? paneAlbums.length :
                t.key === 'followers'  ? (carFollowersData?.total ?? carFollowers.length) :
                /* groups */             (carGroupsData?.total ?? carGroups.length);
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.carTile, { backgroundColor: '#2C2C2C', borderColor: colors.borderDark }]}
                  onPress={() => setPane(t.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.carTileText}>
                    <Text style={[styles.carTileLabel, { color: colors.fgDark }]}>{t.label}</Text>
                    <Text style={[styles.carTileCount, { color: colors.primaryAlt }]}>{count}</Text>
                  </View>
                  <ChevronRight size={16} color={colors.grey} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Discovery tiles — related cars ── */}
          <View style={styles.discoverTilesRow}>
            {car.make ? (
              <TouchableOpacity
                style={[styles.discoverTile, { backgroundColor: '#2C2C2C', borderColor: colors.borderDark }]}
                onPress={() => setPane('otherMake')}
                activeOpacity={0.75}
              >
                <Car size={32} color={colors.primaryAlt} />
                <Text style={[styles.discoverTileLabel, { color: colors.fgDark }]} numberOfLines={2}>
                  Other {car.make}s
                </Text>
              </TouchableOpacity>
            ) : null}
            {car.model ? (
              <TouchableOpacity
                style={[styles.discoverTile, { backgroundColor: '#2C2C2C', borderColor: colors.borderDark }]}
                onPress={() => setPane('otherModel')}
                activeOpacity={0.75}
              >
                <Car size={32} color={colors.primaryAlt} />
                <Text style={[styles.discoverTileLabel, { color: colors.fgDark }]} numberOfLines={2}>
                  Other {car.make} {car.model}s
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Where this car has turned up in other people's posts ── */}
        <TaggedPostsRow
          carId={car.internal_id}
          onPostPress={(post) => openRecord(post.internal_id)}
          onViewAll={() => setPane('tagged')}
        />

        {/* ── Comments on this car ── */}
        <InlineComments
          documentId={car.internal_id}
          entryType={(car as any).entry_type ?? 'garagecar'}
          // Comments are the last section, so scrolling to the end puts the
          // input just above the keyboard. Shrinking the viewport alone leaves
          // it off-screen when the page is scrolled up.
          onInputFocus={() => {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
          }}
        />

      </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Mod edit sheet ── */}
      <BottomSheet
        visible={activeSheet === 'mods'}
        onClose={() => { setActiveSheet(null); setEditingMod(null); }}
        title="Edit Mod"
      >
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
              onPress={() => { setActiveSheet(null); setEditingMod(null); }}
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
      </BottomSheet>

      {/* ── Mod detail sheet ── */}
      <BottomSheet
        visible={!!selectedMod}
        onClose={() => setSelectedMod(null)}
        title={selectedMod?.title ?? 'Mod'}
      >
        {selectedMod && (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {selectedMod.gallery?.[0] && (
              <Image
                source={{ uri: imageUrl(selectedMod.gallery[0].filename)! }}
                style={{ width: '100%', height: 220 }}
                contentFit="cover"
              />
            )}
            <View style={{ padding: 16 }}>
              {selectedMod.type && (
                <View style={[modStyles.typeBadge, { backgroundColor: colors.segment, alignSelf: 'flex-start', marginBottom: 12 }]}>
                  <Text style={[modStyles.typeText, { color: colors.grey }]}>{selectedMod.type}</Text>
                </View>
              )}
              {selectedMod.body ? (
                <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>{stripHtml(selectedMod.body)}</Text>
              ) : null}
              {isOwnerOrCoOwner && (
                <TouchableOpacity
                  style={[styles.sheetCreateBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 20 }]}
                  onPress={() => { setSelectedMod(null); handleModOptions(selectedMod); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sheetCreateBtnText, { color: colors.fg }]}>Edit / Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      <ActionSheet
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        title={`Add to ${carDisplayName}`}
        options={[
          {
            label: 'New Post',
            Icon: MessageSquarePlus,
            onPress: () => appNav.navigate('Create', { carId, carTitle: carDisplayName }),
          },
          {
            label: 'Add Mod',
            Icon: Wrench,
            onPress: () => appNav.navigate('ModCreate', { carId, carTitle: carDisplayName }),
          },
          {
            label: 'Add Gallery',
            Icon: Images,
            onPress: () => setActiveSheet('gallery'),
          },
        ]}
      />

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
              ? <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.sheetCreateBtnText}>
                    {galleryProgress && galleryProgress.total > 0
                      ? `Uploading ${galleryProgress.current} of ${galleryProgress.total}…`
                      : 'Creating…'}
                  </Text>
                </>
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
                ? <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.sheetCreateBtnText}>
                      {editProgress && editProgress.total > 0
                        ? `Saving ${editProgress.current} of ${editProgress.total}…`
                        : 'Saving…'}
                    </Text>
                  </>
                : <Text style={styles.sheetCreateBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </BottomSheet>

      {/* ── Section pane ── */}
      {/* Fixed height: these panes range from two rows to fifty, and a sheet
          that resizes itself per section is disorienting to move between. */}
      <BottomSheet visible={pane !== null} onClose={() => setPane(null)} onDismissed={handlePaneDismissed} title={paneTitle} heightRatio={0.92}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {renderPane()}
        </ScrollView>
        {/* Inside the pane's own Modal, so editing layers over the list rather
            than forcing it closed the way the detail screen has to. */}
        {editingPost && (
          <PostEditSheet
            post={editingPost}
            visible={!!editingPost}
            onClose={() => setEditingPost(null)}
          />
        )}
      </BottomSheet>

      {/* ── Comments ── */}
      <CommentsSheet
        postId={car.internal_id}
        entryType={(car as any).entry_type ?? 'garagecar'}
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />

      {viewer && (
        <Lightbox
          images={viewer.album.gallery ?? []}
          initialIndex={viewer.index}
          title={viewer.album.title}
          onClose={() => setViewer(null)}
          onManage={isOwnerOrCoOwner ? () => handleAlbumOptions(viewer.album) : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  galleryWrap:    { height: GALLERY_HEIGHT + 24, backgroundColor: '#000' },
  galleryStrip:   { paddingVertical: 12, paddingLeft: 12, gap: 10, alignItems: 'flex-start' },
  heroSlide:      { width: HERO_WIDTH, height: GALLERY_HEIGHT, borderRadius: 12, overflow: 'hidden' },
  fullHero:       { width: SCREEN_WIDTH, height: GALLERY_HEIGHT + 24 },
  addGalleryOverlay: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  addGalleryOverlayText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
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
  // Centred, not top-aligned: the actions are 34pt tall and the subtitle is one
  // small line, so flex-start left it hanging off the top of the buttons.
  titleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLeft:      { flex: 1, marginRight: 12 },
  menuBtn:        { padding: 4 },
  titleActions:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn:         { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tasksBtn:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, marginBottom: 18,
    paddingVertical: 17, paddingHorizontal: 16, borderRadius: 14,
  },
  tasksBtnText:   { fontSize: 16, fontWeight: '800' },
  tasksBtnLabel:  { flex: 1, textAlign: 'center' },
  // Matched widths on both flanks — wide enough for the badge and pie together.
  tasksBtnSide:   { minWidth: 56, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tasksBtnSideEnd:{ justifyContent: 'flex-end' },
  taskCount:      {
    minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  taskCountText:  { fontSize: 12, fontWeight: '800' },
  // Above-gallery placement supplies its own gutters; the in-row copy inherits
  // the action row's padding.
  todosAbove:     { paddingHorizontal: 16, marginBottom: 4 },
  followersBtn:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 10, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5,
  },
  followersBtnText: { fontSize: 15, fontWeight: '800' },
  carSubtitle:    { fontSize: 14, marginTop: 3, fontWeight: '500' },
  badgeRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  carBadge:       { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
  carBadgeText:   { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  descWrap:       { marginTop: 12 },
  carDescription: { fontSize: 14, lineHeight: 20 },
  moreLink:       { fontSize: 13, fontWeight: '900', textDecorationLine: 'underline', marginTop: 4 },
  followRow:      { marginTop: 12, paddingTop: 12, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center' },
  likeRowRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentBtn:     { padding: 4 },
  followInlineBtn: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center'
  },
  followInlineText: { fontSize: 14, fontWeight: '800' },
  followMenuBlack: {
    backgroundColor: '#000000', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },

  ownersRow:       { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 },
  ownerChip:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerChipName:   { fontSize: 14, fontWeight: '700', maxWidth: 160 },
  coOwnerAvatarWrap: { marginLeft: -8 },
  ownerCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: 10 },
  coOwnerCard:     { marginTop: 8, borderTopWidth: 1 },
  ownerInfo:       { flex: 1 },
  ownerName:       { fontSize: 15, fontWeight: '700' },
  ownerUsername:   { fontSize: 12, marginTop: 1 },
  coOwnerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coOwnerBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  coOwnerBadgeText: { fontSize: 11, fontWeight: '700' },

  modsSection:          { borderTopWidth: 1 },
  modsSectionPadding:   { padding: 16 },
  modsAccordionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1,
  },
  modsAccordionBtnText: { fontSize: 16, fontWeight: '700' },
  modsSectionRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modsContainer:        { marginTop: 10, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  modRow:               {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modRowThumb:          { width: 54, height: 54, borderRadius: 8 },
  modRowInfo:           { flex: 1 },
  modRowTitle:          { fontSize: 14, fontWeight: '600' },
  modRowType:           { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },

  recordFilters:   { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 1, gap: 8 },
  recordFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  filterChipText:  { fontSize: 12, fontWeight: '700' },

  tilesWrap:       { paddingHorizontal: 16, paddingBottom: 20 },
  carTilesGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  carTile:         {
    flexBasis: '47%', flexGrow: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  carTileText:     { gap: 1 },
  carTileLabel:    { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  carTileCount:    { fontSize: 18, fontWeight: '800' },
  discoverTilesRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  discoverTile:    {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  discoverTileLabel: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  paneAlbumGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  paneAlbumCell:   { width: '47%' },
  paneSpecsWrap:   { paddingHorizontal: 4 },
  paneSpecRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  paneSpecLabel:   { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  paneSpecValue:   { fontSize: 15, fontWeight: '700' },

  specsSection:    { padding: 16 },
  postsSection:    { paddingBottom: 32, borderTopWidth: 1 },
  filterRow:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  recordThumb:     { width: 58, height: 58, borderRadius: 6 },
  // `alignSelf` keeps the pill hugging its label now that it's on its own line
  // rather than sharing a row.
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

  sheet:          { minHeight: SCREEN_HEIGHT * 0.5, maxHeight: '90%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
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
