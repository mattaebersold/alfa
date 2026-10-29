import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Pressable, Dimensions, FlatList, Modal, StatusBar, SafeAreaView as RNSafeAreaView, ActivityIndicator, Alert, Animated, Platform,
} from 'react-native';
import { Text } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { Image } from '../../components/ui/AppImage';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Camera, Images, Settings, Link2, CheckSquare, MoreHorizontal, MoreVertical, Plus, FileText, UsersRound, ChevronDown, ChevronUp, ChevronRight, Users, Warehouse, Car, MessageSquarePlus, Wrench, PenSquare, ArrowRightLeft, Trash2, BookOpen } from 'lucide-react-native';
import ReportButton from '../../components/ui/ReportButton';
import FormInput from '../../components/ui/FormInput';
import CarBookmarkButton from '../../components/cars/CarBookmarkButton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import ScreenHeading from '../../components/ui/ScreenHeading';
import { useSectionTabs } from '../../hooks/useSectionTabs';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetCarWithUserQuery, useGetCarTasksQuery,
  useGetCarGalleriesQuery, useGetUserByIdQuery, useGetPostsQuery,
  useGetCarModsPageQuery, useGetCarGalleriesPageQuery,
  useGetCarJournalQuery, useGetCarJournalEntryQuery, useDeleteCarJournalEntryMutation,
  useDeletePostMutation,
  useCreateModMutation, useUpdateModMutation, useDeleteModMutation,
  useDeleteCarGalleryMutation,
  useCreateCarGalleryShellMutation, useAddCarGalleryImageMutation,
  useRemoveCarGalleryImagesMutation, useUpdateCarGalleryMetaMutation,
  useGetCarFollowersQuery, useGetCarGroupsQuery, useGetCarsQuery, useGetCarModelsQuery,
  useGetRoutesQuery, useUpdateCarMutation,
  apiService,
  useGetCommentCountQuery,
} from '../../api/apiService';
import { skipToken } from '@reduxjs/toolkit/query';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { CATEGORY_LABELS } from '../../components/ui/Badge';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import UserByline from '../../components/members/UserByline';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import LikeButton from '../../components/social/LikeButton';
import CommentButton from '../../components/social/CommentButton';
import FollowButton from '../../components/social/FollowButton';
import CommentsSheet from '../../components/social/CommentsSheet';
import CarActivitySummaryModal, { type CarActivityTab } from '../../components/cars/CarActivitySummaryModal';
import { useSummary } from '../../providers/SummaryProvider';
import { userPreview } from '../../components/members/UserSummaryModal';
import PostSummaryModal, { PostSheet } from '../../components/social/PostSummaryModal';
import PostMediaCarousel from '../../components/media/PostMediaCarousel';
import InlineComments, { CommentsHeading } from '../../components/social/InlineComments';
import CarPosterCard from '../../components/cards/CarPosterCard';
import CarGridItem from '../../components/cars/CarGridItem';
import TasksSheet from '../../components/cars/TasksSheet';
import CarDeleteOptionsModal from '../../components/cars/CarDeleteOptionsModal';
import TaskProgressPie from '../../components/cars/TaskProgressPie';
import PostStrip, { PostCard, type PostCardLook } from '../../components/social/PostStrip';
import SubTabs from '../../components/ui/SubTabs';
import CarShelf, { ShelfTile, type ShelfCard } from '../../components/cars/CarShelf';
import TaggedPostsRow from '../../components/cars/TaggedPostsRow';
import MasonryGrid from '../../components/ui/MasonryGrid';
import TaggedPostsPane from '../../components/cars/TaggedPostsPane';
import CarListsRow from '../../components/cars/CarListsRow';
import CarSetupCard from '../../components/cars/CarSetupCard';
import AskForPhotosButton from '../../components/cars/AskForPhotosButton';
import RouteStrip, { ROUTE_STRIP_PREVIEW_COUNT } from '../../components/routes/RouteStrip';
import RoutesPane from '../../components/routes/RoutesPane';
import BottomSheet from '../../components/ui/SharedModal';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import SummaryModal, { SummaryTouchable, measureOrigin, type SummaryOrigin } from '../../components/ui/SummaryModal';
import ActionSheet from '../../components/ui/ActionSheet';
import { format, formatDistanceToNow } from 'date-fns';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { GestureHandlerRootView, FlatList as GHFlatList } from 'react-native-gesture-handler';
import { PortalHost } from '@ors/kit';
import PinchZoom from '../../components/media/PinchZoom';
import Lightbox from '../../components/media/GalleryLightbox';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { stripHtml } from '../../utils/text';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import { CAR_TYPES, CAR_CATEGORIES, CATEGORY_COLORS, MOD_TYPES } from '../../constants/carTypes';
import type { AppStackParamList, CarDetailAction } from '../../navigation/types';
import type { CarGalleryAlbum, CarJournalEntry, GalleryItem, GarageCar, Mod, Post, Group } from '../../types/api';
import JournalEntrySummaryModal from '../../components/cars/JournalEntrySummaryModal';
import PostEditSheet from '../../components/social/PostEditSheet';
import { ss } from '../../styles/shared';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { handleize } from '../../utils/handleize';
import {
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BADGE_DEFAULT,
  COLOR_BADGE_GARAGE,
  COLOR_BADGE_UPDATE,
  COLOR_BADGE_LISTING,
  COLOR_BADGE_RECORD,
  COLOR_BADGE_SPOT,
  COLOR_BLACK,
  COLOR_GRAY_11,
  COLOR_GRAY_141,
  COLOR_GRAY_22,
  COLOR_GRAY_236,
  COLOR_GRAY_26,
  COLOR_GRAY_42,
  COLOR_WHITE,
  SHEET_RADIUS,
} from '../../constants/config';
import { useGroupSummary } from '../../providers/GroupSummaryProvider';
import { FONT_INTER } from '../../constants/fonts'

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
/**
 * The tallest the strip's main photo may go — 4:5, a portrait phone shot with
 * a little off each end. At the fixed 4:3 a tall photo lost the roof and the
 * wheels; much past 4:5 and the strip pushes the car's details off the screen.
 */
const STRIP_TALLEST = 4 / 5;

type Sheet = 'mods' | 'gallery' | 'gallery-edit' | null;
type CarPane = 'journal' | 'posts' | 'mods' | 'galleries' | 'followers' | 'groups' | 'otherGen' | 'otherModel' | 'otherMake' | 'tagged' | 'routes' | null;
/** The panes that list cars — they run flush to the panel's foot. */
const CAR_PANES = new Set<CarPane>(['otherGen', 'otherModel', 'otherMake']);
/** The reactions pill's three icons, in its order — CarActivitySummaryModal's tabs on this page. */
const REACTION_TABS: CarActivityTab[] = ['followers', 'likes', 'comments'];


// Near-black surfaces for the shared bottom-sheet / pane modal.
const SHEET_BG = COLOR_GRAY_22;
const SHEET_HEADER_BG = COLOR_GRAY_11;
const SHEET_FG = COLOR_GRAY_236;
const SHEET_BORDER = COLOR_GRAY_42;
const SHEET_PLACEHOLDER = COLOR_GRAY_42;

// Car-type badge colors — mirrors CarPosterCard so type badges read the same everywhere.
const CAR_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'daily':        { bg: COLOR_BADGE_DEFAULT, text: COLOR_BLACK },
  'weekend':      { bg: COLOR_BADGE_RECORD, text: COLOR_BLACK },
  'project':      { bg: COLOR_BADGE_SPOT, text: COLOR_BLACK },
  'garage-queen': { bg: COLOR_BADGE_GARAGE, text: COLOR_BLACK },
  'overland':     { bg: COLOR_BADGE_UPDATE, text: COLOR_BLACK },
  'part-out':     { bg: COLOR_BADGE_LISTING, text: COLOR_BLACK },
  'other':        { bg: COLOR_BADGE_DEFAULT, text: COLOR_BLACK },
};

const CAR_TILES: {
  key: Exclude<CarPane, null>;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Singular and plural, so a row of one doesn't say "1 records". */
  noun: [string, string];
}[] = [
  { key: 'followers',  label: 'Followers', Icon: Users,      noun: ['follower', 'followers'] },
  { key: 'groups',     label: 'Groups',    Icon: UsersRound, noun: ['group', 'groups'] },
];

// ── Full-screen lightbox ─────────────────────────────────────────────────────
// The car gallery's viewer lives in components/media/GalleryLightbox now, so
// the marketplace's listing panel opens photos the same way.

// ── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({ album, onPress, onManage, height }: { album: CarGalleryAlbum; onPress: () => void; onManage?: () => void; /** Half the strip, less the gap — see CarGalleryStrip's stripH. */ height?: number }) {
  const thumb = album.gallery?.[0] ? imageUrl(album.gallery[0].filename) : null;
  return (
    <TouchableOpacity style={[styles.albumCard, height != null && { height }]} onPress={onPress} activeOpacity={0.85}>
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

/**
 * The owner's shortcut for swapping the car's main photo, sat in the hero's
 * bottom-right corner. Translucent so it doesn't fight the photograph.
 */
function ChangeHeroButton({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  return (
    <TouchableOpacity
      style={styles.changeHeroButton}
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.8}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Change main photo"
    >
      {busy ? <ActivityIndicator size="small" color={COLOR_WHITE} /> : <Camera size={18} color={COLOR_WHITE} />}
    </TouchableOpacity>
  );
}

function CarGalleryStrip({ carId, heroFilename, onAddGallery, onManageAlbum, onOpenAlbum, onChangeHero, heroBusy }: { carId: string; heroFilename?: string; onAddGallery?: () => void; onManageAlbum?: (album: CarGalleryAlbum) => void; onOpenAlbum: (album: CarGalleryAlbum) => void; onChangeHero?: () => void; heroBusy?: boolean; }) {
  const [lightbox, setLightbox] = useState<{ images: GalleryItem[]; index: number; title?: string } | null>(null);
  /**
   * The lone hero's true ratio, once the image reports it.
   *
   * Unclamped, unlike the feed's `usePosterRatio` — a feed is a column that has
   * to keep an even rhythm, and this is one photograph at the top of its own
   * screen with nothing to be even with. Starts at the old fixed shape so the
   * card doesn't jump from nothing.
   */
  const [heroRatio, setHeroRatio] = useState(4 / 3);
  const { data: galData } = useGetCarGalleriesQuery(carId);
  const albums = galData?.entries ?? [];
  // Fall back to the first gallery-album photo when the car has no profile/gallery image.
  const albumHeroFilename = albums.find((a) => a.gallery?.[0]?.filename)?.gallery?.[0]?.filename;
  const effectiveHero = heroFilename ?? albumHeroFilename;
  const heroUrl = effectiveHero ? imageUrl(effectiveHero) : null;

  /**
   * The strip's height, from the main photo: as tall as its shape asks, from
   * the old 4:3 up to STRIP_TALLEST. Wider than 4:3 still fills the 4:3 box —
   * a wide photo cropped at its ends loses sky, not car. The album cards
   * beside it take the same height, so the strip stays one even band.
   */
  const stripH = Math.round(HERO_WIDTH / Math.min(4 / 3, Math.max(STRIP_TALLEST, heroRatio)));

  // Two to a column; the owner's Add Gallery takes the next slot after the
  // last album, at an album's size — under it, or atop a column of its own.
  const slots: (CarGalleryAlbum | 'add')[] = onAddGallery ? [...albums, 'add'] : albums;
  const albumCols: (CarGalleryAlbum | 'add')[][] = [];
  for (let i = 0; i < slots.length; i += 2) albumCols.push(slots.slice(i, i + 2));

  /**
   * Single image with no additional galleries → the photograph itself, at the
   * shape it was taken.
   *
   * It used to be cropped into a fixed landscape box, which on a portrait shot
   * of a car cut the roof and the wheels off — the two ends of the thing you
   * came to look at. With one image and nothing to line it up against, there's
   * no reason to impose a shape on it at all: it's the top of the screen, not
   * an item in a row.
   */
  if (albums.length === 0 && heroUrl) {
    return (
      <>
        <TouchableOpacity
          // Someone else's car, with nothing to change on it: edge to edge.
          style={[styles.fullHero, !onChangeHero && styles.fullHeroBleed, { aspectRatio: heroRatio }]}
          activeOpacity={0.95}
          onPress={() => effectiveHero && setLightbox({ images: [{ filename: effectiveHero }], index: 0 })}
        >
          <Image
            source={{ uri: heroUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
            onLoad={(e) => {
              const w = e.source?.width;
              const h = e.source?.height;
              if (w && h) setHeroRatio(w / h);
            }}
          />
          {onChangeHero && <ChangeHeroButton onPress={onChangeHero} busy={heroBusy} />}
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
            style={[styles.heroSlide, { height: stripH }]}
            activeOpacity={0.92}
            onPress={() => effectiveHero && setLightbox({ images: [{ filename: effectiveHero }], index: 0 })}
          >
            <Image
              source={{ uri: heroUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              onLoad={(e) => {
                const w = e.source?.width;
                const h = e.source?.height;
                if (w && h) setHeroRatio(w / h);
              }}
            />
            {onChangeHero && <ChangeHeroButton onPress={onChangeHero} busy={heroBusy} />}
          </TouchableOpacity>
        ) : (
          <View style={styles.heroSlide}>
            <Image source={require('../../../assets/car-placeholder.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
            {onChangeHero && <ChangeHeroButton onPress={onChangeHero} busy={heroBusy} />}
          </View>
        )}
        {albumCols.map((pair, colIdx) => (
          <View key={colIdx} style={styles.albumCol}>
            {pair.map((album) => (album === 'add' ? (
              <TouchableOpacity
                key="add"
                style={[styles.addGalleryCard, { height: (stripH - 10) / 2 }]}
                onPress={onAddGallery}
                activeOpacity={0.7}
              >
                <Plus size={22} color="rgba(255,255,255,0.6)" />
                <Text style={styles.addGalleryText}>Add Gallery</Text>
              </TouchableOpacity>
            ) : (
              <AlbumCard
                key={album.internal_id}
                album={album}
                onPress={() => onOpenAlbum(album)}
                onManage={onManageAlbum ? () => onManageAlbum(album) : undefined}
                height={(stripH - 10) / 2}
              />
            )))}
          </View>
        ))}
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

/**
 * A mod in a summary panel: its card — photos, words, likes — and its comments
 * under it, the composer pinned to the panel's foot. What a mod tile opens,
 * from the shelf or from the list behind it.
 */
function ModSummaryModal({ mod, onClose, onPhoto }: {
  mod: Mod | null;
  onClose: () => void;
  onPhoto: (mod: Mod, index: number) => void;
}) {
  const colors = useColors();
  // Kept through the close, so it fades out on its mod rather than emptying.
  const last = useRef<Mod | null>(null);
  if (mod) last.current = mod;
  const shown = mod ?? last.current;
  return (
    <SummaryModal visible={!!mod} onClose={onClose}>
      {shown ? (
        <View>
          <ModCard mod={shown} colors={colors} onPhoto={(i) => onPhoto(shown, i)} bare />
          <CommentsHeading count={shown.comment_count ?? 0} style={{ paddingTop: 10, marginBottom: 6 }} />
          <InlineComments
            documentId={shown.internal_id}
            entryType="mod"
            title=""
            backgroundColor="transparent"
            variant="panel"
            pinComposer
          />
        </View>
      ) : null}
    </SummaryModal>
  );
}

function ModCard({ mod, colors, onOptions, onComments, onPhoto, bare = false }: {
  mod: Mod;
  colors: ReturnType<typeof useColors>;
  /**
   * No card of its own — no fill, margin or rounding — and its photos as the
   * feed's swipeable gallery, full width: for a panel that is already the card.
   */
  bare?: boolean;
  onOptions?: () => void;
  /** Opens the thread. Hoisted to the screen so one sheet serves the list. */
  onComments?: () => void;
  /** Opens the mod's photos in the car's lightbox, at the one tapped. */
  onPhoto?: (index: number) => void;
}) {
  const photos = (mod.gallery ?? []).filter((g) => g.filename && g.type !== 'video');
  const when = mod.created_at ? formatDistanceToNow(new Date(mod.created_at), { addSuffix: true }) : '';
  return (
    <View style={bare ? null : [modStyles.card, { backgroundColor: colors.card }]}>
      {/* In a panel: the photos as a record post's are — full width, swiped
          through, pinched into — rather than a strip of thumbnails. */}
      {bare && photos.length > 0 ? (
        <PostMediaCarousel
          media={photos.map((g) => ({ kind: 'image' as const, key: g.internal_id ?? g.filename!, url: imageUrl(g.filename)! }))}
          onPressItem={onPhoto}
          adaptiveHeight
          pinchZoom
        />
      ) : null}
      {/* One photo fills the top of the card; several sit in a strip, so a
          mod with a dozen install shots doesn't run a screen tall. */}
      {bare ? null : photos.length === 1 ? (
        <Pressable onPress={() => onPhoto?.(0)} accessibilityRole="imagebutton" accessibilityLabel="View photo">
          <Image source={{ uri: imageUrl(photos[0].filename)! }} style={modStyles.thumb} contentFit="cover" />
        </Pressable>
      ) : photos.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={modStyles.strip}
        >
          {photos.map((g, i) => (
            <Pressable
              key={g.internal_id ?? g.filename}
              onPress={() => onPhoto?.(i)}
              accessibilityRole="imagebutton"
              accessibilityLabel={`View photo ${i + 1} of ${photos.length}`}
            >
              <Image source={{ uri: imageUrl(g.filename)! }} style={modStyles.stripThumb} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={[modStyles.body, bare && modStyles.bodyBare]}>
        <View style={modStyles.titleRow}>
          <Text style={[modStyles.title, { color: colors.fg }]} numberOfLines={2}>{mod.title ?? 'Untitled'}</Text>
          {onOptions && (
            <TouchableOpacity onPress={onOptions} hitSlop={8} style={modStyles.optionsBtn}>
              <MoreHorizontal size={18} color={colors.grey} />
            </TouchableOpacity>
          )}
        </View>
        {when ? <Text style={[modStyles.when, { color: colors.grey }]}>{when}</Text> : null}
        {mod.body ? (
          <Text style={[modStyles.desc, { color: colors.muted }]} numberOfLines={3}>{stripHtml(mod.body)}</Text>
        ) : null}

        {/* The same like and comment a mod gets in the feed.
            Without these the car's own page was the one place a mod couldn't
            be reacted to — and, worse, the one place an existing like didn't
            show, since the document is the same either way. */}
        <View style={modStyles.actions}>
          <LikeButton
            documentId={mod.internal_id}
            entryType="mod"
            ownerId={mod.user_id}
            initialCount={mod.like_count ?? 0}
            initialLiked={mod.isLiked ?? false}
            color={colors.grey}
          />
          <CommentButton
            count={mod.comment_count ?? 0}
            documentId={mod.internal_id}
            onPress={() => onComments?.()}
            color={colors.grey}
          />
        </View>
      </View>
    </View>
  );
}

const modStyles = StyleSheet.create({
  card:      { marginHorizontal: 12, marginBottom: 8, borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  actions:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: -6 },
  thumb:     { width: '100%', height: 180 },
  strip:     { gap: 6, paddingHorizontal: 12, paddingTop: 12 },
  stripThumb:{ width: 120, height: 90, borderRadius: COMMON_RADIUS },
  body:      { padding: 12 },
  // In a panel, in line with the comments under it.
  bodyBare:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  titleRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title:     { flex: 1, fontSize: 15, fontFamily: FONT_INTER.bold, lineHeight: 20 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: PILL_RADIUS, flexShrink: 0 },
  typeText:  { fontSize: 11, fontFamily: FONT_INTER.bold },
  optionsBtn:{ padding: 2, marginLeft: 2 },
  when:      { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  desc:      { fontSize: 13, lineHeight: 18, marginTop: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 14, marginBottom: 8 },
  groupLabel:{ fontSize: 14, fontFamily: FONT_INTER.bold },
  groupCount:{ paddingHorizontal: 7, paddingVertical: 1, borderRadius: PILL_RADIUS },
  groupCountText: { fontSize: 11, fontFamily: FONT_INTER.bold },
});

// ── Animated bottom sheet ────────────────────────────────────────────────────

// ── Main screen ──────────────────────────────────────────────────────────────

export default function CarDetailScreen({ route }: { route: { params: { carId: string; action?: CarDetailAction; journalId?: string } } }) {
  const { carId, action, journalId } = route.params;
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const localNav = useNavigation();
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();
  const isPro = useIsPro();
  const headerPad = useHeaderPad();
  const onHeaderScroll = useHeaderScroll(headerPad);
  const insets = useSafeAreaInsets();
  // Clear the floating tab bar (matches MainTabNavigator's height). Computed
  // rather than read via useBottomTabBarHeight, which throws when this screen
  // is presented from a root modal route outside the tabs.
  const tabBarClearance = 88 + insets.bottom;
  const scrollRef = useRef<ScrollView>(null);
  const sectionTabs = useSectionTabs({ sections: CAR_SECTIONS, scrollRef: scrollRef as any, headerPad });
  // The header's back button lands here at the top — see useScrollTopOnBack.
  useScrollTopOnBack(scrollRef);
  // A caller can ask for a sheet on arrival — "Add Gallery" from the car's card
  // opens this screen purely to get at the composer that lives on it.
  const [activeSheet, setActiveSheet] = useState<Sheet>(action === 'gallery' ? 'gallery' : null);
  const [modsExpanded, setModsExpanded] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  /** The description as laid out in full, line by line — measured once, to cut it at three. */
  const [descLines, setDescLines] = useState<string[] | null>(null);
  const [pane, setPane] = useState<CarPane>(null);
  /** The section last opened — see shownPane. */
  const lastPaneRef = useRef<CarPane>(null);
  /** The fill for the panes' "New" buttons. */
  const brand = useBrandColor();
  /** A record (or a tagged post) open in its summary panel — from a shelf or a list. */
  const [recordSummary, setRecordSummary] = useState<Post | null>(null);
  /** A mod open in its summary panel — its details, its photos, its comments. */
  const [modSummary, setModSummary] = useState<Mod | null>(null);
  const [journalSummary, setJournalSummary] = useState<CarJournalEntry | null>(null);
  /** The followers / likes / comments panel, on the tab whose icon was tapped. */
  const [reactions, setReactions] = useState<{ tab: CarActivityTab; origin: SummaryOrigin | null } | null>(null);
  const commentBtnRef = useRef<View>(null);
  const { openUser } = useSummary();
  /** A mod or an album whose thread is open, and which document it is. */
  const [subComments, setSubComments] = useState<{ id: string; type: string } | null>(null);
  // Records pane filter — cleared whenever the pane leaves Records.
  const [recordCategory, setRecordCategory] = useState<string | null>(null);

  // "Other <make>" pane's model filter — "All" again whenever the pane changes.
  const [makeFilter, setMakeFilter] = useState<{ key: string; label: string; model: string; generation?: string } | null>(null);

  useEffect(() => {
    if (pane !== 'posts') setRecordCategory(null);
    if (pane !== 'otherMake') setMakeFilter(null);
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
  // The album's photos still kept in the edit sheet — the ones not marked for removal.
  const editAlbumKept = (editingAlbum?.gallery ?? [])
    .filter((img) => img.filename && !editAlbumRemovedFilenames.includes(img.filename));
  // Sequential upload progress: { current, total } while uploading, else null
  const [galleryProgress, setGalleryProgress] = useState<{ current: number; total: number } | null>(null);
  const [editProgress, setEditProgress] = useState<{ current: number; total: number } | null>(null);
  const creatingGallery = galleryProgress !== null;
  const updatingGallery = editProgress !== null;
  const dispatch = useAppDispatch();
  const [createCarGalleryShell] = useCreateCarGalleryShellMutation();
  const [addCarGalleryImage] = useAddCarGalleryImageMutation();
  const [removeCarGalleryImages] = useRemoveCarGalleryImagesMutation();
  const [updateCarGalleryMeta] = useUpdateCarGalleryMetaMutation();
  const [updateMod, { isLoading: updatingMod }] = useUpdateModMutation();
  const [deleteMod] = useDeleteModMutation();
  /** Which step of the remove sheet is open, or null for closed. */
  const [removeStep, setRemoveStep] = useState<'choose' | 'transfer' | null>(null);
  const [deleteCarGallery] = useDeleteCarGalleryMutation();

  const { data: car, isLoading, refetch: refetchCar } = useGetCarWithUserQuery(carId);

  // Arrived from a "new journal entry" notification: that entry, open over the
  // page once the page is there to sit under it. Once per entry asked for, so
  // closing it doesn't bring it back.
  const { data: arrivedEntry } = useGetCarJournalEntryQuery(journalId!, { skip: !journalId });
  const shownArrival = useRef<string | null>(null);
  useEffect(() => {
    if (!car || !arrivedEntry || arrivedEntry.car_id !== carId) return;
    if (shownArrival.current === arrivedEntry.internal_id) return;
    shownArrival.current = arrivedEntry.internal_id;
    setJournalSummary(arrivedEntry);
  }, [car, arrivedEntry, carId]);
  /**
   * The car's comment count, for the bubble beside the like. Asked for here
   * because the car's payload doesn't carry one; with the same argument
   * CommentButton reads, so a comment added or removed below updates the
   * bubble through the cache.
   */
  const { data: commentCount } = useGetCommentCountQuery(
    car?.internal_id ? { id: car.internal_id } : skipToken,
  );
  const { data: coOwnerData } = useGetUserByIdQuery(car?.coowner_id ?? '', { skip: !car?.coowner_id });
  // The active list carries both done and outstanding items — only archiving
  // removes one — so completion is a count over what's already loaded.
  const { data: tasksData } = useGetCarTasksQuery(carId, { skip: !car });
  const tasks = tasksData?.entries ?? [];
  const taskTotal = tasks.length;
  const tasksDone = tasks.filter((t) => t.completed).length;
  const tasksOpen = taskTotal - tasksDone;

  /**
   * The latest few records, mods and albums, for the shelves on the page —
   * see PostStrip and CarShelf. Each asks for SHELF_COUNT and the total.
   */
  const { data: postsData, refetch: refetchPosts } = useGetPostsQuery({ car_id: carId, limit: SHELF_COUNT });
  const { data: modsData, refetch: refetchMods } = useGetCarModsPageQuery(
    { carId, page: 0, limit: SHELF_COUNT }, { skip: !car },
  );
  const { data: albumsData, refetch: refetchGalleries } = useGetCarGalleriesPageQuery(
    { carId, page: 0, limit: SHELF_COUNT }, { skip: !car },
  );
  const { data: journalData } = useGetCarJournalQuery(
    { carId, page: 0, limit: SHELF_COUNT }, { skip: !car },
  );
  const shelfJournal = journalData?.entries ?? [];
  const shelfPosts = postsData?.entries ?? [];
  const shelfMods = modsData?.entries ?? [];
  const shelfAlbums = albumsData?.entries ?? [];

  /**
   * Everything, a page at a time, behind each shelf's "View all" — asked for
   * only while that list is open (or fading out), and grown by "Show more".
   */
  const listOpen = pane ?? lastPaneRef.current;
  const [postsPage, setPostsPage] = useState(0);
  const [modsPage, setModsPage] = useState(0);
  const [journalPage, setJournalPage] = useState(0);
  const [albumsPage, setAlbumsPage] = useState(0);
  // Back to the first page each time a list opens.
  useEffect(() => {
    if (pane === 'posts') setPostsPage(0);
    if (pane === 'mods') setModsPage(0);
    if (pane === 'journal') setJournalPage(0);
    if (pane === 'galleries') setAlbumsPage(0);
  }, [pane]);
  const { data: postsPageData, isFetching: postsPaging } = useGetPostsQuery(
    { car_id: carId, page: postsPage, limit: LIST_PAGE }, { skip: listOpen !== 'posts' },
  );
  const { data: modsPageData, isFetching: modsPaging } = useGetCarModsPageQuery(
    { carId, page: modsPage, limit: LIST_PAGE }, { skip: listOpen !== 'mods' },
  );
  const { data: albumsPageData, isFetching: albumsPaging } = useGetCarGalleriesPageQuery(
    { carId, page: albumsPage, limit: LIST_PAGE }, { skip: listOpen !== 'galleries' },
  );
  const posts = useAccumulated(postsPageData?.entries, postsPage);
  const mods = useAccumulated(modsPageData?.entries, modsPage);
  const { data: journalPageData, isFetching: journalPaging } = useGetCarJournalQuery(
    { carId, page: journalPage, limit: LIST_PAGE }, { skip: listOpen !== 'journal' },
  );
  const journal = useAccumulated(journalPageData?.entries, journalPage);
  const journalTotal = journalPageData?.total ?? journalData?.total ?? 0;
  const [deleteJournalEntry] = useDeleteCarJournalEntryMutation();
  const paneAlbums = useAccumulated(albumsPageData?.entries, albumsPage);
  const postsTotal = postsPageData?.total ?? postsData?.total ?? 0;
  const modsTotal = modsPageData?.total ?? modsData?.total ?? 0;
  const albumsTotal = albumsPageData?.total ?? albumsData?.total ?? 0;

  /**
   * The drives this car was in.
   *
   * `car_id` on the routes list covers both halves of that — a route recorded
   * against this car, and a route that tagged it ("Driven In") — merged and
   * de-duplicated server-side, so the shelf and the pane page through one
   * honest list rather than stitching two together and guessing at a total.
   *
   * No `scope` here: this is a page other people read, so it gets the public
   * list. A route its owner marked private, or shared only into groups the
   * viewer isn't in, is not in the response to be filtered out — which is also
   * why the owner's own private drives don't appear on their car's page. Their
   * profile is where those live.
   */
  const { data: carRoutesData, refetch: refetchCarRoutes } = useGetRoutesQuery(
    { car_id: carId, limit: ROUTE_STRIP_PREVIEW_COUNT },
    { skip: !car },
  );
  const carRoutes = carRoutesData?.entries ?? [];

  // The car, and the three lists the page is made of. The mod and gallery
  // queries are skipped until the car loads, so they only join in once there
  // is one.
  const refreshControl = useRefreshControl(() => Promise.all([
    refetchCar(),
    refetchPosts(),
    ...(car ? [refetchMods(), refetchGalleries(), refetchCarRoutes()] : []),
  ]));
  const { data: carFollowersData } = useGetCarFollowersQuery(carId, { skip: !car });
  const carFollowers = carFollowersData?.entries ?? [];
  // Asks the server which groups list this car, rather than reading
  // `car.group_id` — a car can be in a group purely because its owner is a
  // member and it matches the group's make/model, which never sets that field.
  const { data: carGroupsData } = useGetCarGroupsQuery(carId, { skip: !car });
  const carGroups = carGroupsData?.entries ?? [];
  /**
   * The slug the listing filters on — the car's own when it has one, otherwise
   * derived the same way the server derives it.
   *
   * It has to be a *handle*, not the display value. The deployed API matches
   * `make_handle` exactly, so sending "Porsche" finds nothing where "porsche"
   * finds 22. (The updated API also matches the display field
   * case-insensitively, so a handle works against both — which is the point of
   * sending one.)
   *
   * The previous fallbacks were hand-rolled and disagreed with each other:
   * `make.toLowerCase()` never turned spaces into dashes, so "Alfa Romeo" asked
   * for "alfa romeo" against a stored "alfa-romeo". `handleize` mirrors the
   * server's own rules, so both halves finally agree.
   */
  /**
   * Whether a listed car is this one. By the loaded car's own id as well as
   * the route's: a car reached by a link can be routed under another form of
   * its id, and then the route's alone let it into its own "other" lists.
   */
  const isThisCar = (c: { internal_id: string }) => c.internal_id === carId || (!!car?.internal_id && c.internal_id === car.internal_id);
  const makeQuery = car?.make_handle ?? (car?.make ? handleize(car.make) : undefined);
  const modelQuery = car?.model_handle ?? (car?.model ? handleize(car.model) : undefined);
  const { data: otherModelData } = useGetCarsQuery(
    { make: makeQuery, model: modelQuery, limit: 24 },
    { skip: !makeQuery || !modelQuery },
  );
  const otherModelCars = (otherModelData?.entries ?? []).filter((c) => !isThisCar(c));
  const { data: otherMakeData } = useGetCarsQuery(
    { make: makeQuery, limit: 24 },
    { skip: !makeQuery },
  );
  const otherMakeCars = (otherMakeData?.entries ?? []).filter((c) => !isThisCar(c));
  // The narrowest of the three: the same generation of the same model — the
  // other 993s, not every 911. Only for a car that has one set.
  const generationQuery = car?.generation_handle ?? (car?.generation ? handleize(car.generation) : undefined);
  const { data: otherGenData } = useGetCarsQuery(
    { make: makeQuery, model: modelQuery, generation: generationQuery, limit: 24 },
    { skip: !makeQuery || !modelQuery || !generationQuery },
  );
  const otherGenCars = (otherGenData?.entries ?? []).filter((c) => !isThisCar(c));
  /**
   * How many others there are: the server's total, less this car, which
   * matches its own make, model and generation. Seen in the page it's
   * certainly counted; past the page it's assumed to be. Never fewer than
   * the cars actually shown.
   */
  const othersCount = (data: { total?: number; entries?: { internal_id: string }[] } | undefined, shown: number) => {
    if (!data) return null;
    const entries = data.entries ?? [];
    const total = data.total ?? entries.length;
    const countsSelf = entries.some((c) => c.internal_id === carId) || entries.length < total;
    return Math.max(shown, countsSelf ? total - 1 : total);
  };

  /**
   * The "Other <make>" pane's sub tabs: All, then each of the make's models —
   * or each generation, for a model that has them — as the make's own page
   * lays them out, most-owned first. Picking one narrows the list to it.
   */
  const { data: makeModels = [] } = useGetCarModelsQuery(car?.make ?? '', { skip: !car?.make || pane !== 'otherMake' });
  const makeFilters = [...makeModels]
    .sort((a, b) => b.qty - a.qty || a.model.localeCompare(b.model))
    .flatMap((m) => (m.generations?.length
      ? m.generations.map((g) => ({
        key: `${m.model_handle}-${g.generation_handle}`,
        // "E30" reads on its own; "Mk2" needs its model.
        label: g.standalone ? g.generation : `${m.model} ${g.generation}`,
        model: m.model_handle,
        generation: g.generation_handle,
      }))
      : [{ key: m.model_handle, label: m.model, model: m.model_handle, generation: undefined as string | undefined }]));
  const { data: filteredMakeData, isFetching: filteringMake } = useGetCarsQuery(
    { make: makeQuery, model: makeFilter?.model, generation: makeFilter?.generation, limit: 24 },
    { skip: !makeQuery || !makeFilter },
  );
  const makePaneCars = makeFilter
    ? (filteredMakeData?.entries ?? []).filter((c) => !isThisCar(c))
    : otherMakeCars;
  const otherGenCount = othersCount(otherGenData, otherGenCars.length);
  const otherModelCount = othersCount(otherModelData, otherModelCars.length);
  const otherMakeCount = othersCount(otherMakeData, otherMakeCars.length);

  const isOwner = userInfo?.user_id === (car?.user_id ?? '');
  const isCoOwner = userInfo?.user_id === (car?.coowner_id ?? '');
  const isOwnerOrCoOwner = isOwner || isCoOwner;

  /** What to call this car in menus and in tags handed to other screens. */
  const carDisplayName =
    car?.title || [car?.year, car?.make, car?.model].filter(Boolean).join(' ') || 'this car';

  // Pro owners get the to-do list promoted above the gallery; everyone else
  // who can edit sees it in the action row below.

  /**
   * The to-do list, as a button beside the + by the car's name: the same
   * solid brand fill, the to-do glyph, how many are open and how far along,
   * all in black. A circle until there are tasks to count, then a pill.
   */
  const todosButton = (
    <TouchableOpacity
      style={[styles.cogBtn, styles.tasksPill, { backgroundColor: brand }]}
      onPress={() => appNav.navigate('CarTasks', {
        carId,
        carTitle: car?.title || [car?.year, car?.make, car?.model].filter(Boolean).join(' '),
      })}
      hitSlop={8}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={taskTotal > 0 ? `To-dos, ${tasksOpen} open` : 'To-dos'}
    >
      <CheckSquare size={18} color={COLOR_BLACK} strokeWidth={2.4} />
      {taskTotal > 0 && (
        <>
          <Text style={styles.tasksPillCount}>{tasksOpen}</Text>
          <TaskProgressPie completed={tasksDone} total={taskTotal} size={16} color={COLOR_BLACK} solid />
        </>
      )}
    </TouchableOpacity>
  );

  // Same three choices as the car's own card offers, in the same sheet — the
  // two + buttons lead to the same places.
  const [addSheet, setAddSheet] = useState(false);
  const handleAddPress = useCallback(() => setAddSheet(true), []);

  /**
   * The car's own menu.
   *
   * An ActionSheet rather than `Alert.alert`: with Transfer added this is four
   * choices plus a Cancel, and Android's platform dialog takes three and
   * silently drops the rest — see ActionSheet's own note.
   */
  const [menuSheet, setMenuSheet] = useState(false);
  const handleMenuPress = useCallback(() => setMenuSheet(true), []);

  // ── Main photo swap (owner / co-owner) ──
  const [updateCar, { isLoading: heroUploading }] = useUpdateCarMutation();
  const uploadHero = async (assets: ImagePicker.ImagePickerAsset[]) => {
    const [picked] = await normalizePickedAssets(assets.slice(0, 1));
    if (!picked) return;
    const fd = new FormData();
    fd.append('internal_id', carId);
    fd.append('profile_image', uploadFile(picked.uri));
    try {
      await updateCar(fd).unwrap();
    } catch {
      Alert.alert('Upload failed', "Couldn't update the main photo. Please try again.");
    }
  };
  const pickHeroImage = () => {
    Alert.alert('Change Main Photo', undefined, [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
          if (!result.canceled) await uploadHero(result.assets);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
          if (!result.canceled) await uploadHero(result.assets);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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

  /** A group tapped in the groups pane, opened once the pane has closed. */
  const pendingGroupRef = useRef<string | null>(null);
  const { openGroup } = useGroupSummary();

  /**
   * Something to do once the pane has finished closing — a navigation that
   * presents a modal of its own, which iOS won't do over the summary panel
   * while it's still on its way out.
   */
  const afterPaneRef = useRef<(() => void) | null>(null);
  const closePaneThen = (run: () => void) => {
    afterPaneRef.current = run;
    setPane(null);
  };

  /**
   * The other-cars lists, as the Cars screen shows cars: two columns, each card
   * its photo's shape, alternating rather than balanced (a card's height is
   * only known once its photo loads). A card closes the panel, then opens that
   * car — a second panel can't be presented over this one.
   */
  const carMosaic = (cars: GarageCar[]) => (
    <View style={styles.paneMosaic}>
      {[0, 1].map((col) => (
        <View key={col} style={styles.paneMosaicColumn}>
          {cars.filter((_, i) => i % 2 === col).map((c) => (
            <CarGridItem
              key={c.internal_id}
              item={c}
              overlay
              // Back to the top of the page as the panel goes, so the car
              // that's opened starts at its photo rather than down here.
              onPress={() => closePaneThen(() => {
                scrollRef.current?.scrollTo({ y: 0, animated: false });
                (localNav as any).navigate('CarDetail', { carId: c.internal_id });
              })}
            />
          ))}
        </View>
      ))}
    </View>
  );

  const handlePaneDismissed = () => {
    if (afterPaneRef.current) {
      const run = afterPaneRef.current;
      afterPaneRef.current = null;
      run();
    }
    if (pendingViewerRef.current) {
      setViewer(pendingViewerRef.current);
      pendingViewerRef.current = null;
    }
    if (pendingGroupRef.current) {
      openGroup(pendingGroupRef.current);
      pendingGroupRef.current = null;
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
    closePaneThen(() => appNav.navigate('PostDetailModal', { postId }));
  };

  /** A route detail, leaving the same breadcrumb a record does. */
  const openRoute = (routeId: string) => {
    restorePaneRef.current = pane;
    closePaneThen(() => appNav.navigate('RouteDetailModal', { routeId }));
  };

  const [deletePost] = useDeletePostMutation();
  const [editingPost, setEditingPost] = useState<Post | null>(null);

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

  /**
   * Miles as typed, or TMU — true mileage unknown, the term of art — when what
   * was typed doesn't read as a distance. Stored values are free text, so
   * "120,000", "120000 mi" and "120k" all turn up; anything else printed as
   * "NaN mi". Nothing typed at all is no tile, not a TMU one.
   */
  const formatMileage = (raw: unknown) => {
    const text = String(raw ?? '').trim().toLowerCase().replace(/[,\s]/g, '').replace(/(mi|miles)$/, '');
    if (!text) return undefined;
    const n = text.endsWith('k') ? Number(text.slice(0, -1)) * 1000 : Number(text);
    return Number.isFinite(n) && n >= 0 ? `${Math.round(n).toLocaleString()} mi` : 'TMU';
  };

  const specs: { label: string; value: string | undefined }[] = [
    { label: 'Year',      value: car.year },
    { label: 'Make',      value: car.make },
    { label: 'Model',     value: car.model },
    { label: 'Generation', value: car.generation ?? undefined },
    { label: 'Trim',      value: car.trim },
    { label: 'Color',     value: car.color },
    { label: 'Engine',    value: car.engine },
    { label: 'HP',        value: car.horsepower },
    { label: 'Torque',    value: car.torque },
    { label: 'Mileage',   value: formatMileage(car.mileage) },
    { label: 'Condition', value: car.condition },
  ].filter((s) => s.value);

  // Three to a row. Named for what it is rather than `specPairs`, which stopped
  // being true the moment the table gained a column.
  // The specs as columns of two — the carousel fills down, then across.
  const specColumns: (typeof specs)[] = [];
  for (let i = 0; i < specs.length; i += 2) {
    specColumns.push(specs.slice(i, i + 2));
  }

  /**
   * The sections this car actually has something in.
   *
   * An empty section is a row that opens onto "nothing here yet" — better not
   * offered than proved with a tap. Derived here rather than inline so the
   * wrapper can be dropped too when every one of them is empty, instead of
   * leaving a padded gap where the tiles used to be.
   */
  const visibleTiles = (isOwnerOrCoOwner ? CAR_TILES.filter((t) => t.key !== 'followers') : CAR_TILES)
    .map((t) => ({
      ...t,
      count:
        t.key === 'followers'  ? (carFollowersData?.total ?? carFollowers.length) :
        /* groups */             (carGroupsData?.total ?? carGroups.length),
    }))
    .filter((t) => t.count > 0);

  // The section last opened — held while the panel fades out, so it closes
  // on its contents rather than collapsing to nothing first.
  if (pane) lastPaneRef.current = pane;
  const shownPane = pane ?? lastPaneRef.current;

  const paneTitle =
    shownPane === 'otherGen'
      ? `Other ${[car.make, car.generation].filter(Boolean).join(' ')}s`
      : shownPane === 'otherModel'
      ? `Other ${[car.make, car.model].filter(Boolean).join(' ')}s`
      : shownPane === 'otherMake'
      ? `Other ${car.make} cars`
      : shownPane === 'tagged'
      ? 'Tagged in Posts'
      : shownPane === 'routes'
      ? 'Routes'
      : shownPane === 'journal'
      ? 'Journal'
      : shownPane === 'posts'
      ? 'Records'
      : shownPane === 'mods'
      ? 'Mods'
      : shownPane === 'galleries'
      ? 'Galleries'
      : CAR_TILES.find((t) => t.key === shownPane)?.label ?? '';

  // The last row ends at the panel's edge, so it has nothing to divide.
  const rowBorder = (i: number, n: number) => (i === n - 1 ? 'transparent' : SHEET_BORDER);

  /**
   * Each section of your own car that you can add to, and how: the same
   * three things the header's + offers, from inside the list they land in.
   * Run once the panel has closed — the create screen and the gallery sheet
   * are modals of their own. A record or a mod brings you back to the list.
   */
  const paneNew: Partial<Record<Exclude<CarPane, null>, { label: string; run: () => void }>> = isOwnerOrCoOwner ? {
    journal: { label: 'New entry', run: () => { restorePaneRef.current = 'journal'; closePaneThen(() => appNav.navigate('JournalCreate', { carId, carTitle: carDisplayName })); } },
    mods: { label: 'New mod', run: () => { restorePaneRef.current = 'mods'; closePaneThen(() => appNav.navigate('ModCreate', { carId, carTitle: carDisplayName })); } },
    galleries: { label: 'New gallery', run: () => closePaneThen(() => presentAfterDismiss(() => setActiveSheet('gallery'), true)) },
  } : {};
  const shownNew = shownPane ? paneNew[shownPane] : undefined;

  /**
   * A mod's photos in the car's viewer, from its summary panel: every panel
   * closes first — a viewer is a modal of its own, and iOS won't present one
   * over another still on its way out.
   */
  const openModPhotos = (mod: Mod, index: number) => {
    const album = {
      internal_id: mod.internal_id,
      car_id: mod.car_id,
      title: mod.title,
      gallery: (mod.gallery ?? []).filter((g) => g.filename && g.type !== 'video'),
      isMod: true,
    } as CarGalleryAlbum & { isMod: true };
    setModSummary(null);
    setPane(null);
    presentAfterDismiss(() => setViewer({ album, index }), true);
  };

  /** A mod as a shelf tile — its photo, its kind in a pill; it opens its details. */
  const modShelfCard = (mod: Mod): ShelfCard => {
    const photo = mod.gallery?.find((g) => g.filename && g.type !== 'video');
    return {
      key: mod.internal_id,
      image: photo?.filename ? imageUrl(photo.filename) : null,
      title: mod.title ?? 'Mod',
      badge: MOD_TYPES.find((t) => t.key === (mod.type || mod.category))?.label,
      onPress: () => setModSummary(mod),
    };
  };
  /**
   * A journal entry as a shelf tile — its first photo, if it has one, and its
   * title, with when it was written under it; it opens the entry in full.
   */
  const journalShelfCard = (entry: CarJournalEntry): ShelfCard => {
    const photo = entry.gallery?.find((g) => g.filename && g.type !== 'video');
    return {
      key: entry.internal_id,
      image: photo?.filename ? imageUrl(photo.filename) : null,
      title: entry.title ?? 'Entry',
      subtitle: entry.created_at ? format(new Date(entry.created_at), 'MMM d, yyyy') : undefined,
      onPress: () => setJournalSummary(entry),
    };
  };
  /** The owner's, from an entry's panel: the form on it, or it gone. */
  const editJournalEntry = (entry: CarJournalEntry) =>
    appNav.navigate('JournalCreate', { carId, carTitle: carDisplayName, entryId: entry.internal_id });
  const removeJournalEntry = (entry: CarJournalEntry) => {
    deleteJournalEntry({ internal_id: entry.internal_id, car_id: carId }).unwrap()
      .catch(() => Alert.alert("Couldn't delete that", 'Please try again.'));
  };

  /** An album as a shelf tile — its cover, its photo count in a pill; it opens the album. */
  const albumShelfCard = (album: CarGalleryAlbum): ShelfCard => ({
    key: album.internal_id,
    image: album.gallery?.[0]?.filename ? imageUrl(album.gallery[0].filename) : null,
    title: album.title ?? 'Album',
    badge: String(album.gallery?.length ?? 0),
    BadgeIcon: Images,
    onPress: () => openAlbum(album),
  });

  /**
   * The Records list's category filter — pinned as the panel's header, so it
   * stays put while the grid under it scrolls. Built from what this car
   * actually has, so a filter never offers a choice that returns nothing.
   */
  const categoryKeys = Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[];

  const recordFiltersEl = categoryKeys.length > 1 ? (
    <View style={[styles.recordFilters, { borderBottomColor: SHEET_BORDER }]}>
      {/* One row that scrolls sideways, rather than a block of wrapped
          chips above the list it filters. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recordFilterRow}
      >
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
      </ScrollView>
    </View>
  ) : null;

  const renderPane = () => {
    switch (shownPane) {
      case 'tagged':
        return (
          <TaggedPostsPane
            carId={car.internal_id}
            // In the post panel, over this list — see PostSummaryModal.
            onPostPress={(post) => setRecordSummary(post)}
          />
        );
      case 'routes':
        return (
          <RoutesPane
            params={{ car_id: car.internal_id }}
            emptyTitle="No routes for this car yet"
            // Closed and restored the same way a record is — the detail is a
            // native-stack modal and this pane is an RN <Modal>.
            onRoutePress={(r) => openRoute(r.internal_id)}
          />
        );
      case 'posts': {
        if (posts.length === 0) return postsPaging ? <PaneLoading /> : <EmptyState title="No records yet" />;

        const visiblePosts = recordCategory ? posts.filter((p) => p.category === recordCategory) : posts;

        return (
          <>
            {visiblePosts.length === 0
              ? <EmptyState title="No records match those filters" />
              : (
                // The shelf's cards, two up — the same PostCard, the same look.
                <MasonryGrid
                  style={styles.paneGrid}
                  items={visiblePosts}
                  keyOf={(p) => p.internal_id}
                  renderItem={(item, width) => (
                    <PostCard post={item} width={width} onPress={() => setRecordSummary(item)} naturalRatio {...RECORD_LOOK} />
                  )}
                />
              )}
            <ShowMore shown={posts.length} total={postsTotal} loading={postsPaging} onPress={() => setPostsPage((p) => p + 1)} />
          </>
        );
      }
      case 'journal':
        if (journal.length === 0) return journalPaging ? <PaneLoading /> : <EmptyState title="No journal entries yet" />;
        return (
          <>
          <MasonryGrid
            style={styles.paneGrid}
            items={journal}
            keyOf={(e) => e.internal_id}
            renderItem={(entry, width) => <ShelfTile card={journalShelfCard(entry)} width={width} naturalRatio />}
          />
          <ShowMore shown={journal.length} total={journalTotal} loading={journalPaging} onPress={() => setJournalPage((p) => p + 1)} />
          </>
        );
      case 'mods':
        if (mods.length === 0) return modsPaging ? <PaneLoading /> : <EmptyState title="No mods yet" />;
        return (
          <>
          {/* The shelf's tiles, two up; a tile opens the mod's details. */}
          <MasonryGrid
            style={styles.paneGrid}
            items={mods}
            keyOf={(m) => m.internal_id}
            renderItem={(mod, width) => <ShelfTile card={modShelfCard(mod)} width={width} naturalRatio />}
          />
          <ShowMore shown={mods.length} total={modsTotal} loading={modsPaging} onPress={() => setModsPage((p) => p + 1)} />
          </>
        );
      case 'galleries':
        if (paneAlbums.length === 0) return albumsPaging ? <PaneLoading /> : <EmptyState title="No galleries yet" />;
        return (
          <>
          {/* The shelf's tiles, two up; a tile opens the album. */}
          <MasonryGrid
            style={styles.paneGrid}
            items={paneAlbums}
            keyOf={(a) => a.internal_id}
            renderItem={(album, width) => <ShelfTile card={albumShelfCard(album)} width={width} naturalRatio />}
          />
          <ShowMore shown={paneAlbums.length} total={albumsTotal} loading={albumsPaging} onPress={() => setAlbumsPage((p) => p + 1)} />
          </>
        );
      case 'followers':
        if (carFollowers.length === 0) return <EmptyState title="No followers yet" />;
        return carFollowers.map((u, i) => (
          <UserByline
            key={u.user_id}
            user={u}
            size={40}
            gap={12}
            fill
            color={SHEET_FG}
            nameStyle={{ fontSize: 15, fontFamily: FONT_INTER.semibold }}
            style={[ss.listRow, { borderBottomColor: rowBorder(i, carFollowers.length) }]}
            onPress={() => closePaneThen(() => (localNav as any).navigate('UserDetail', { userId: u.user_id, username: u.username }))}
          />
        ));
      case 'otherGen':
        if (otherGenCars.length === 0) return <EmptyState title={`No other ${[car.make, car.generation].filter(Boolean).join(' ')}s on the site yet`} />;
        return carMosaic(otherGenCars);
      case 'otherModel':
        if (otherModelCars.length === 0) return <EmptyState title={`No other ${[car.make, car.model].filter(Boolean).join(' ')} on the site yet`} />;
        return carMosaic(otherModelCars);
      case 'otherMake':
        if (makeFilter && filteringMake && makePaneCars.length === 0) return <ActivityIndicator color={colors.grey} style={{ paddingVertical: 30 }} />;
        if (makePaneCars.length === 0) {
          return <EmptyState title={makeFilter ? `No other ${makeFilter.label}s on the site yet` : `No other ${car.make} cars on the site yet`} />;
        }
        return carMosaic(makePaneCars);
      case 'groups':
        if (carGroups.length === 0) return <EmptyState title="Not in any group" />;
        return carGroups.map((g: Group, i) => {
          const banner = firstGalleryUrl(g.banners) ?? firstGalleryUrl(g.gallery);
          return (
            <TouchableOpacity
              key={g.internal_id}
              style={[ss.listRow, { borderBottomColor: rowBorder(i, carGroups.length) }]}
              // Members to the page, everyone else to the summary — once the pane
              // has gone, since iOS won't present one modal over another that's
              // still dismissing.
              onPress={() => { pendingGroupRef.current = g.internal_id; setPane(null); }}
              activeOpacity={0.7}
            >
              {banner
                ? <Image source={{ uri: banner }} style={styles.recordThumb} contentFit="cover" />
                : <View style={[styles.recordThumb, { backgroundColor: SHEET_PLACEHOLDER }]} />}
              <Text style={{ flex: 1, color: SHEET_FG, fontSize: 15, fontFamily: FONT_INTER.bold }}>{g.title}</Text>
              <ChevronRight size={18} color={colors.grey} />
            </TouchableOpacity>
          );
        });
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader />
      {/* A FormScrollView for the comment field at the foot of the page:
          focused, it's scrolled up to sit on the keyboard. */}
      <FormScrollView
        refreshControl={refreshControl}
        ref={scrollRef as any}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerPad, paddingBottom: tabBarClearance + 16 }}
        onScroll={(e) => { onHeaderScroll(e); sectionTabs.onScroll(e); }}
        scrollEventThrottle={16}
      >

        {/* ── Gallery strip ── */}
        <View style={styles.galleryWrap}>
          <CarGalleryStrip
            carId={carId}
            heroFilename={heroFilename}
            onAddGallery={isOwnerOrCoOwner ? () => setActiveSheet('gallery') : undefined}
            onManageAlbum={isOwnerOrCoOwner ? handleAlbumOptions : undefined}
            onOpenAlbum={openAlbum}
            onChangeHero={isOwnerOrCoOwner ? pickHeroImage : undefined}
            heroBusy={heroUploading}
          />
        </View>

        {/* The car's name, under its photos and over its owners: the
            pictures lead the page, and the name reads as the caption to them.
            The spec sits under it, close to the name it describes. */}
        <ScreenHeading
          dense
          title={car.title || [car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
          // At the name's right — the car's own settings, apart from like and
          // comment, which are things you do to the car rather than to the page.
          right={
            isOwnerOrCoOwner ? (
              // Adding to the car, then its settings. The + on the brand colour
              // (blue, or Pro red) in black — it's the one that adds; the cog
              // an outline.
              <View style={styles.headerActions}>
                {/* A Pro member's to-do list, first in the row. */}
                {isPro && todosButton}
                <TouchableOpacity
                  onPress={handleAddPress}
                  hitSlop={8}
                  style={[styles.cogBtn, { backgroundColor: brand }]}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Add content to this car"
                >
                  <Plus size={24} color={COLOR_BLACK} strokeWidth={2.6} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleMenuPress}
                  hitSlop={8}
                  style={[styles.cogBtn, styles.cogOutline, { borderColor: colors.grey }]}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Car options"
                >
                  <Settings size={21} color={COLOR_WHITE} />
                </TouchableOpacity>
              </View>
            ) : (
              // Someone else's car: save it, or report it.
              <View style={styles.headerActions}>
                <View style={styles.headerMenuBtn}>
                  <CarBookmarkButton carId={carId} size={20} color={colors.grey} />
                </View>
                <View style={styles.headerMenuBtn}>
                  <ReportButton contentType="car" contentId={carId} size={18} />
                </View>
              </View>
            )
          }
          meta={car.title || car.type || car.category ? (
            <>
              {/* The spec, then what kind of car it is, under it. The spec
                  only appears when the name isn't already the spec. */}
              <View style={styles.metaLeft}>
              {car.title ? (
                <View style={styles.specChip}>
                  {/* Plain words under the name, not a chip. One line: a long
                      trim trails off rather than wrapping. */}
                  <Text style={[styles.specChipText, { color: COLOR_WHITE }]} numberOfLines={1}>
                    {[car.year, car.make, car.model, car.trim].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ) : null}
              {car.type || car.category ? (
                <View style={styles.carBadges}>
                  {car.type ? (
                    <View style={[styles.carBadge, { backgroundColor: (CAR_TYPE_COLORS[car.type] ?? CAR_TYPE_COLORS.other).bg }]}>
                      <Text style={[styles.carBadgeText, { color: (CAR_TYPE_COLORS[car.type] ?? CAR_TYPE_COLORS.other).text }]}>{carTypeLabel(car.type)}</Text>
                    </View>
                  ) : null}
                  {car.category ? (
                    <View style={[styles.carBadge, { backgroundColor: CATEGORY_COLORS[car.category]?.bg ?? colors.segment }]}>
                      <Text style={[styles.carBadgeText, { color: CATEGORY_COLORS[car.category]?.text ?? COLOR_WHITE }]}>{carCategoryLabel(car.category)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              </View>

            </>
          ) : undefined}
        />

        {/* ── Title + owners ── */}
        <View style={[styles.titleSection]}>
          <View style={styles.titleRow}>
            {/* Who owns the car, opposite what you can do to it. This used to
                sit on its own line below; in the row it fills the left side the
                actions were being pushed away from, and the two read as one
                band rather than two half-empty ones. */}
            <View style={styles.titleLeft}>
              {(owner || coOwnerData) && (
                <View style={styles.ownersRow}>
                  {owner && (
                    // Their summary first, grown from the chip — the profile
                    // is the summary's own button.
                    <UserByline
                      user={owner}
                      size={26}
                      gap={7}
                      name={displayName}
                      color={colors.fgDark}
                      nameStyle={styles.ownerChipName}
                      style={styles.ownerChip}
                      onPress={(o) => openUser(owner.user_id, o, userPreview(owner))}
                      activeOpacity={0.8}
                      accessibilityLabel={displayName}
                    />
                  )}
                  {coOwnerData && (
                    <>
                      {/* A link between the two: the second co-owns the first's car. */}
                      <Link2 size={14} color={colors.grey} strokeWidth={2.4} />
                      <UserByline
                        user={coOwnerData}
                        size={26}
                        gap={7}
                        name={coOwnerName}
                        color={colors.fgDark}
                        nameStyle={styles.ownerChipName}
                        style={styles.ownerChip}
                        onPress={(o) => openUser(coOwnerData.user_id, o, userPreview(coOwnerData))}
                        activeOpacity={0.8}
                        accessibilityLabel={coOwnerName}
                      />
                    </>
                  )}
                </View>
              )}
            </View>
            {/* Liking and commenting sit with the car's other controls rather
                than in a bar of their own below the description — they are two
                icons, and a full-width rule under a paragraph to hold them read
                as the end of the page. */}
            <View style={styles.titleActions}>
              {/* Like and comment in one solid black pill — the feed cards'
                  actions pill, so the car's reactions look the same everywhere. */}
              <View style={styles.actionsPill}>
                {/* Who follows the car, first. Followers, likers and comments
                    are one panel, tabbed, opened on whichever was tapped. */}
                <SummaryTouchable
                  style={styles.pillItem}
                  onPress={(o) => setReactions({ tab: 'followers', origin: o })}
                  activeOpacity={0.7}
                  accessibilityLabel={`${carFollowersData?.total ?? carFollowers.length} followers`}
                >
                  <Users size={18} color={COLOR_WHITE} />
                  <Text style={styles.pillItemCount}>{carFollowersData?.total ?? carFollowers.length}</Text>
                </SummaryTouchable>
                {/* The count stays white; only the heart goes red, and only
                    once you've liked it. Your own car — owner or co-owner —
                    can't be liked: its heart opens who did. */}
                <LikeButton
                  documentId={car.internal_id}
                  entryType={(car as any).entry_type ?? 'garagecar'}
                  ownerId={car.user_id}
                  isOwn={isOwnerOrCoOwner}
                  initialCount={(car as any).like_count ?? 0}
                  initialLiked={(car as any).isLiked ?? false}
                  size={18}
                  color={COLOR_WHITE}
                  countColor={COLOR_WHITE}
                  onShowLikers={(o) => setReactions({ tab: 'likes', origin: o })}
                />
                <View ref={commentBtnRef} collapsable={false}>
                  <CommentButton
                    documentId={car.internal_id}
                    count={commentCount ?? 0}
                    onPress={() => measureOrigin(commentBtnRef.current, (o) => setReactions({ tab: 'comments', origin: o }))}
                    color={COLOR_WHITE}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* What's still missing on your own car — a photo, its specs, a first
              mod — each finished in a panel right here. Nothing once done. */}
          {isOwnerOrCoOwner && <CarSetupCard car={car} modCount={modsData?.total ?? shelfMods.length} />}

          {/* Someone else's car with no photos: ask its owner for some. Signed
              in only — the ask is sent from someone. */}
          {!isOwnerOrCoOwner && !!userInfo && !car.gallery?.length && !car.profile_image && (
            <AskForPhotosButton carId={car.internal_id} ownerName={(car as any).user?.username} />
          )}

          {car.body ? (
            <View style={styles.descWrap}>
              {/* Laid out once in full to learn where its lines break, then
                  shown cut to three with "… more" on the end of the third, in
                  the same run of text — a link on a line of its own read as a
                  button. The third line gives up a few characters to make
                  room. Expanded, "less" trails the last line the same way. */}
              {(() => {
                const full = stripHtml(car.body);
                const long = !!descLines && descLines.length > DESC_LINES;
                const toggle = (
                  <Text
                    style={[styles.moreLink, { color: colors.fgDark }]}
                    onPress={() => setDescExpanded((v) => !v)}
                    suppressHighlighting
                  >
                    {descExpanded ? 'less' : 'more'}
                  </Text>
                );
                if (!long) {
                  return (
                    <Text
                      style={[styles.carDescription, { color: colors.fgDark }]}
                      onTextLayout={descLines == null ? (e) => setDescLines(e.nativeEvent.lines.map((l) => l.text)) : undefined}
                    >
                      {full}
                    </Text>
                  );
                }
                if (descExpanded) {
                  return (
                    <Text style={[styles.carDescription, { color: colors.fgDark }]}>
                      {full} {toggle}
                    </Text>
                  );
                }
                const lines = descLines!.slice(0, DESC_LINES);
                const last = lines[DESC_LINES - 1].replace(/\s+$/, '');
                const cut = last.slice(0, Math.max(0, last.length - MORE_ROOM)).replace(/\s+$/, '');
                return (
                  <Text style={[styles.carDescription, { color: colors.fgDark }]} numberOfLines={DESC_LINES}>
                    {lines.slice(0, -1).join('')}{cut}… {toggle}
                  </Text>
                );
              })()}
            </View>
          ) : null}

        </View>

        {/* ── Specs ──
            On the page rather than behind a tile. Specs are what someone came
            to read about a car; a tap and a full-screen sheet to reach ten
            short facts was a lot of ceremony for the shortest list here.
            `specRows` chunks them three at a time — it was already being built
            as pairs and never used. */}
        {/* Two rows that scroll sideways, each tile most of the screen wide, so
            a long spec reads in full and the next column peeks in. */}
        {specs.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.specsTable}
            snapToInterval={SPEC_TILE_W + 8}
            snapToAlignment="start"
            decelerationRate="fast"
          >
            {specColumns.map((col) => (
              <View key={col.map((sp) => sp.label).join('-')} style={styles.specsColumn}>
                {col.map((spec) => (
                  <View key={spec.label} style={styles.specsCell}>
                    <Text style={[styles.specsLabel, { color: COLOR_GRAY_141 }]} numberOfLines={1}>{spec.label}</Text>
                    <Text style={[styles.specsValue, { color: colors.fg }]} numberOfLines={1}>
                      {spec.value}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Records, mods and galleries ── */}
        {/* The latest few of each as a shelf, the rest behind "View all" —
            the list behind it pages in the whole lot. The owner gets an Add on
            each, straight to that one form. */}
        {/* The sections below, as sub tabs that pin under the header — the
            profile's pattern (useSectionTabs). */}
        {sectionTabs.row}
        {/* The car's journal — its owner's notes, history and memories —
            ahead of the records: the story of the car before the log of it. */}
        <View onLayout={sectionTabs.measure('journal')}>
        <CarShelf
          title="Journal"
          splitPair
          total={journalData?.total}
          cards={shelfJournal.map(journalShelfCard)}
          onViewAll={() => setPane('journal')}
          onAdd={isOwnerOrCoOwner ? () => appNav.navigate('JournalCreate', { carId, carTitle: carDisplayName }) : undefined}
          addLabel="Add entry"
        />
        </View>
        <View onLayout={sectionTabs.measure('records')}>
        <PostStrip
          title="Records"
          // One line, no time — a record's title is what tells them apart.
          {...RECORD_LOOK}
          splitPair
          posts={shelfPosts}
          total={postsData?.total}
          alwaysViewAll
          // In a summary panel, as the home feed shows a post — see PostSummaryModal.
          onPostPress={(post) => setRecordSummary(post)}
          onViewAll={() => setPane('posts')}
          onAdd={isOwnerOrCoOwner ? () => appNav.navigate('Create', { carId, carTitle: carDisplayName }) : undefined}
          addLabel="Add record"
        />
        </View>
        <View onLayout={sectionTabs.measure('mods')}>
        <CarShelf
          title="Mods"
          splitPair
          total={modsData?.total}
          cards={shelfMods.map(modShelfCard)}
          onViewAll={() => setPane('mods')}
          onAdd={isOwnerOrCoOwner ? () => appNav.navigate('ModCreate', { carId, carTitle: carDisplayName }) : undefined}
          addLabel="Add mod"
        />
        </View>
        <View onLayout={sectionTabs.measure('galleries')}>
        <CarShelf
          title="Galleries"
          splitPair
          total={albumsData?.total}
          cards={shelfAlbums.map(albumShelfCard)}
          onViewAll={() => setPane('galleries')}
          onAdd={isOwnerOrCoOwner ? () => setActiveSheet('gallery') : undefined}
          addLabel="Add gallery"
        />
        </View>

        {/* ── Section tiles — open panes like the profile page ── */}
        {/* Close under the specs when nothing sits between them — no records,
            mods or galleries to show (and, not being yours, none to add). */}
        <View
          style={[styles.tilesWrap, !(isOwnerOrCoOwner || shelfJournal.length || shelfPosts.length || shelfMods.length || shelfAlbums.length) && styles.tilesWrapTight]}
          onLayout={sectionTabs.measure('related')}
        >
          {visibleTiles.length > 0 && (
          <View style={styles.carTilesGrid}>
            {visibleTiles.map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.carTile, { backgroundColor: colors.inputBg, borderColor: colors.borderDark }]}
                  onPress={() => setPane(t.key)}
                  activeOpacity={0.75}
                >
                  <View style={styles.carTileIcon}>
                    <t.Icon size={20} color={colors.fg} strokeWidth={2} />
                  </View>
                  <View style={styles.carTileText}>
                    <Text style={[styles.carTileLabel, { color: colors.fg }]} numberOfLines={1}>{t.label}</Text>
                    <Text style={[styles.carTileCount, { color: colors.grey }]} numberOfLines={1}>
                      {t.count} {t.count === 1 ? t.noun[0] : t.noun[1]}
                    </Text>
                  </View>
                  <View style={[styles.carTileGo, { backgroundColor: colors.secondary }]}>
                    <ChevronRight size={16} color={colors.fg} />
                  </View>
                </TouchableOpacity>
            ))}
          </View>
          )}

          {/* ── Discovery tiles — related cars ── */}
          {/* Same row as the sections above — these are another way to leave
              this page, so making them a different shape only implied they
              behaved differently. */}
          <View style={styles.discoverTilesRow}>
            {/* Narrowest first: this generation, then the model, then the
                make. Each with how many others there really are, and gone
                when there are none — a tile onto "nothing yet" is a dead end. */}
            {([
              { key: 'otherGen' as const, show: !!car.generation, label: `Other ${car.make} ${car.generation}s`, count: otherGenCount },
              { key: 'otherModel' as const, show: !!car.model, label: `Other ${car.make} ${car.model}s`, count: otherModelCount },
              { key: 'otherMake' as const, show: !!car.make, label: `Other ${car.make}s`, count: otherMakeCount },
            ]).filter((t) => t.show && t.count !== 0).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.carTile, { backgroundColor: colors.inputBg, borderColor: colors.borderDark }]}
                onPress={() => setPane(t.key)}
                activeOpacity={0.75}
              >
                <View style={styles.carTileIcon}>
                  <Car size={20} color={colors.fg} strokeWidth={2} />
                </View>
                <View style={styles.carTileText}>
                  <Text style={[styles.carTileLabel, { color: colors.fg }]} numberOfLines={1}>
                    {t.label}
                  </Text>
                  <Text style={[styles.carTileCount, { color: colors.grey }]} numberOfLines={1}>
                    {t.count == null ? ' ' : `${t.count} ${t.count === 1 ? 'car' : 'cars'}`}
                  </Text>
                </View>
                <View style={[styles.carTileGo, { backgroundColor: colors.secondary }]}>
                  <ChevronRight size={16} color={colors.fg} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Where this car has turned up in other people's posts ── */}
        <View onLayout={sectionTabs.measure('tagged')}>
        <TaggedPostsRow
          carId={car.internal_id}
          onPostPress={(post) => setRecordSummary(post)}
          onViewAll={() => setPane('tagged')}
        />
        </View>

        {/* ── The roads it's actually driven ── */}
        {/* Renders nothing when there are none — see RouteStrip. Sits on the
            page rather than behind a tile, next to the tagged posts, because
            both answer the same question: where has this car been. */}
        <View onLayout={sectionTabs.measure('routes')}>
        <RouteStrip
          title="Routes"
          routes={carRoutes}
          total={carRoutesData?.total ?? carRoutes.length}
          onRoutePress={(r) => openRoute(r.internal_id)}
          onViewAll={() => setPane('routes')}
        />
        </View>

        {/* ── What its owner has written down about it ── */}
        {/* After where it's been, because this is where it's going: mods
            planned, cars that inspired it. Renders nothing for a visitor when
            there are none; a Pro owner or co-owner gets the way to add one —
            the server accepts a list on a car from either. */}
        {/* Hidden for now — and with it, its sub tab, which only shows for a
            section that's on the page. */}
        {SHOW_CAR_LISTS && (
          <View onLayout={sectionTabs.measure('lists')}>
            <CarListsRow carId={car.internal_id} canAdd={isOwnerOrCoOwner && isPro} />
          </View>
        )}


      </FormScrollView>
      {/* The sub tabs, pinned under the header once the row scrolls up to it. */}
      {sectionTabs.pinned}

      {/* ── Mod edit sheet ── */}
      <BottomSheet
        visible={activeSheet === 'mods'}
        onClose={() => { setActiveSheet(null); setEditingMod(null); }}
        title="Edit Mod"
      >
        <FormScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
          <FormInput
            style={{ marginBottom: 20 }}
            value={editModTitle}
            onChangeText={setEditModTitle}
            placeholder="Mod title"
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
                <Text style={[styles.modTypeChipText, { color: colors.fg }, editModType === t.key && { color: COLOR_WHITE }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>
            Description <Text style={[styles.gallerySheetLabel, { color: colors.grey, fontWeight: '400' }]}>(optional)</Text>
          </Text>
          <FormInput
            style={{ marginBottom: 20 }}
            value={editModBody}
            onChangeText={setEditModBody}
            placeholder="Describe this mod..."
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
                ? <ActivityIndicator size="small" color={COLOR_WHITE} />
                : <Text style={styles.sheetCreateBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          </View>
        </FormScrollView>
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
        // No heading and no Cancel: the options say what they are, and a tap
        // outside or the grabber closes it.
        showCancel={false}
        options={[
          {
            label: 'Journal Entry',
            Icon: BookOpen,
            onPress: () => appNav.navigate('JournalCreate', { carId, carTitle: carDisplayName }),
          },
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
        <FormScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
          <FormInput
            style={{ marginBottom: 20 }}
            value={galleryTitle}
            onChangeText={setGalleryTitle}
            placeholder="e.g. Build Photos"
            autoCapitalize="sentences"
          />
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Photos</Text>
          {/* Nothing added yet: the full photo well. Once there are photos the
              grid's + tile is enough. */}
          {galleryImages.length === 0 ? (
            <PhotoPickerField onPress={pickGalleryImage} style={styles.galleryPhotoField} />
          ) : (
          <View style={styles.galleryImageGrid}>
            {galleryImages.map((img, i) => (
              <View key={i} style={styles.galleryThumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.galleryThumb} contentFit="cover" />
                <TouchableOpacity style={styles.galleryThumbRemove} onPress={() => setGalleryImages((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={4}>
                  <X size={12} color={COLOR_WHITE} />
                </TouchableOpacity>
              </View>
            ))}
            {galleryImages.length < 20 && (
              <TouchableOpacity style={[styles.galleryAddPhoto, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={pickGalleryImage}>
                <Plus size={20} color={colors.grey} />
              </TouchableOpacity>
            )}
          </View>
          )}
          <TouchableOpacity
            style={[styles.sheetCreateBtn, { backgroundColor: colors.primaryAlt, opacity: creatingGallery ? 0.5 : 1, marginTop: 20 }]}
            onPress={handleCreateGallery}
            disabled={creatingGallery}
            activeOpacity={0.85}
          >
            {creatingGallery
              ? <>
                  <ActivityIndicator size="small" color={COLOR_WHITE} />
                  <Text style={styles.sheetCreateBtnText}>
                    {galleryProgress && galleryProgress.total > 0
                      ? `Uploading ${galleryProgress.current} of ${galleryProgress.total}…`
                      : 'Creating…'}
                  </Text>
                </>
              : <><Plus size={16} color={COLOR_WHITE} /><Text style={styles.sheetCreateBtnText}>Create Gallery</Text></>
            }
          </TouchableOpacity>
        </FormScrollView>
      </BottomSheet>

      {/* ── Gallery edit sheet ── */}
      <BottomSheet
        visible={activeSheet === 'gallery-edit'}
        onClose={() => { setActiveSheet(null); setEditingAlbum(null); setEditAlbumTitle(''); setEditAlbumRemovedFilenames([]); setEditAlbumNewImages([]); }}
        title="Edit Gallery"
      >
        <FormScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Title *</Text>
          <FormInput
            style={{ marginBottom: 20 }}
            value={editAlbumTitle}
            onChangeText={setEditAlbumTitle}
            placeholder="Gallery title"
            autoCapitalize="sentences"
          />
          <Text style={[styles.gallerySheetLabel, { color: colors.fg }]}>Photos</Text>
          {/* Every photo removed and none added: the full photo well again. */}
          {editAlbumKept.length === 0 && editAlbumNewImages.length === 0 ? (
            <PhotoPickerField onPress={pickEditAlbumImage} style={styles.galleryPhotoField} />
          ) : (
          <View style={styles.galleryImageGrid}>
            {/* Existing images */}
            {editAlbumKept
              .map((img, i) => (
                <View key={`existing-${i}`} style={styles.galleryThumbWrap}>
                  <Image source={{ uri: imageUrl(img.filename)! }} style={styles.galleryThumb} contentFit="cover" />
                  <TouchableOpacity
                    style={styles.galleryThumbRemove}
                    onPress={() => img.filename && setEditAlbumRemovedFilenames((prev) => [...prev, img.filename!])}
                    hitSlop={4}
                  >
                    <X size={12} color={COLOR_WHITE} />
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
                  <X size={12} color={COLOR_WHITE} />
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
          )}
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
                    <ActivityIndicator size="small" color={COLOR_WHITE} />
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
        </FormScrollView>
      </BottomSheet>

      {/* ── Section pane ── */}
      {/* A summary panel rather than a slide-up sheet, like every other list
          that opens from a tap. It sizes to the section — up to most of the
          screen, then scrolls — and keeps the title pinned above. */}
      <SummaryModal
        visible={pane !== null}
        onClose={() => setPane(null)}
        onClosed={handlePaneDismissed}
        minHeightRatio={0.45}
        header={shownPane === 'posts' ? (recordFiltersEl ?? undefined) : (
          <View>
          <View style={styles.paneHead}>
            <Text style={[styles.paneTitle, { color: SHEET_FG }]} numberOfLines={1}>{paneTitle}</Text>
            {shownNew ? (
              <TouchableOpacity
                style={[styles.paneNewBtn, { backgroundColor: brand }]}
                onPress={shownNew.run}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={shownNew.label}
              >
                <Plus size={14} color={COLOR_BLACK} strokeWidth={3} />
                <Text style={styles.paneNewText}>{shownNew.label}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {/* The make's models, to narrow the list by — pinned with the title. */}
          {shownPane === 'otherMake' && makeFilters.length > 1 ? (
            <View style={styles.paneTabs}>
              <SubTabs
                options={[{ key: '', label: 'All' }, ...makeFilters.map((f) => ({ key: f.key, label: f.label }))]}
                value={makeFilter?.key ?? ''}
                onChange={(key) => setMakeFilter(makeFilters.find((f) => f.key === key) ?? null)}
              />
            </View>
          ) : null}
          </View>
        )}
        // Stacked inside the panel's own Modal, so editing layers over the list
        // rather than forcing it closed the way the detail screen has to.
        // Rendered inside the list's panel, so they present over it — see
        // SummaryModal's "Stacking". The same two sit at the page's level
        // below for when they're opened from a shelf.
        stacked={(
          <>
            {editingPost ? (
              <PostEditSheet
                post={editingPost}
                visible={!!editingPost}
                onClose={() => setEditingPost(null)}
              />
            ) : null}
            {/* From a list, a post slides up as a sheet — closed, you're back
                on the list where you were. */}
            <PostSheet post={pane ? recordSummary : null} onClose={() => setRecordSummary(null)} />
            <ModSummaryModal mod={pane ? modSummary : null} onClose={() => setModSummary(null)} onPhoto={openModPhotos} />
            <JournalEntrySummaryModal
              entry={pane ? journalSummary : null}
              onClose={() => setJournalSummary(null)}
              // From the list: the list closes too, then the form.
              onEdit={isOwnerOrCoOwner ? (e) => { restorePaneRef.current = 'journal'; closePaneThen(() => editJournalEntry(e)); } : undefined}
              onDelete={isOwnerOrCoOwner ? removeJournalEntry : undefined}
            />
          </>
        )}
      >
        {/* A list of cars runs to the panel's foot — the last card's photo
            meets the edge rather than floating over a strip of panel. */}
        <View style={{ paddingBottom: CAR_PANES.has(shownPane as CarPane) ? 0 : 24 }}>
          {renderPane()}
        </View>
      </SummaryModal>

      {/* ── A record from the shelf, as the feed shows a post ── */}
      <PostSummaryModal
        post={pane ? null : recordSummary}
        onClose={() => setRecordSummary(null)}
      />
      <ModSummaryModal mod={pane ? null : modSummary} onClose={() => setModSummary(null)} onPhoto={openModPhotos} />
      <JournalEntrySummaryModal
        entry={pane ? null : journalSummary}
        onClose={() => setJournalSummary(null)}
        onEdit={isOwnerOrCoOwner ? editJournalEntry : undefined}
        onDelete={isOwnerOrCoOwner ? removeJournalEntry : undefined}
      />

      {/* ── Followers, likes, comments ── */}
      {/* One panel behind the pill's three icons, a tab each, opened on the
          one tapped — rather than three panels that each answered a third of
          "how has this car been received". */}
      <CarActivitySummaryModal
        car={{ ...(car as any), comment_count: commentCount ?? (car as any).comment_count }}
        only={REACTION_TABS}
        tab={reactions?.tab ?? null}
        origin={reactions?.origin}
        onClose={() => setReactions(null)}
      />

      {/* One sheet for the car's sub-items — a mod, an album — rather than one
          per row. `subComments` names which document is being read. */}
      {subComments && (
        <CommentsSheet
          postId={subComments.id}
          entryType={subComments.type}
          visible={!!subComments}
          onClose={() => setSubComments(null)}
        />
      )}

      {viewer && (
        <Lightbox
          images={viewer.album.gallery ?? []}
          initialIndex={viewer.index}
          title={viewer.album.title}
          onClose={() => setViewer(null)}
          // A mod's photos open here too; the album menu isn't theirs.
          onManage={isOwnerOrCoOwner && !(viewer.album as { isMod?: boolean }).isMod ? () => handleAlbumOptions(viewer.album) : undefined}
        />
      )}

      <ActionSheet
        visible={menuSheet}
        onClose={() => setMenuSheet(false)}
        showCancel={false}
        options={[
          {
            label: 'Edit Car',
            Icon: PenSquare,
            onPress: () => appNav.navigate('CarCreate', { carId }),
          },
          // Owner only: the server refuses a transfer from anyone else, and
          // the co-owner can still reach Archive through Remove.
          ...(isOwner ? [{
            label: 'Transfer Car',
            Icon: ArrowRightLeft,
            onPress: () => setRemoveStep('transfer'),
          }] : []),
          {
            label: 'Remove Car',
            Icon: Trash2,
            destructive: true,
            onPress: () => setRemoveStep('choose'),
          },
        ]}
      />

      {/* Archive, transfer or erase. Whichever it is, this car is no longer in
          the garage this screen was opened from, so it goes back. */}
      <CarDeleteOptionsModal
        visible={removeStep !== null}
        car={car}
        initialStep={removeStep ?? 'choose'}
        onClose={() => setRemoveStep(null)}
        onDeleted={() => appNav.goBack()}
      />
    </SafeAreaView>
  );
}

/** The car's lists at the foot of the page. Off for now. */
const SHOW_CAR_LISTS = false;

/** A spec tile's width in the carousel — most of the screen, so the next column peeks in. */
const SPEC_TILE_W = Math.round(Dimensions.get('window').width * 0.45);

/** The page's sections under the specs, in order — each a sub tab that scrolls to it. */
const CAR_SECTIONS: { key: 'journal' | 'records' | 'mods' | 'galleries' | 'related' | 'tagged' | 'routes' | 'lists'; label: string }[] = [
  { key: 'journal',   label: 'Journal' },
  { key: 'records',   label: 'Records' },
  { key: 'mods',      label: 'Mods' },
  { key: 'galleries', label: 'Galleries' },
  { key: 'related',   label: 'More' },
  { key: 'tagged',    label: 'Tagged' },
  { key: 'routes',    label: 'Routes' },
  { key: 'lists',     label: 'Lists' },
];

/** How a record's card looks — on the shelf and in the list behind it. */
const RECORD_LOOK: PostCardLook = {
  showByline: false,
  showTime: false,
  captionLines: 1,
  captionOnImage: true,
  kindBadge: true,
};

/** How many of each a shelf shows. */
const SHELF_COUNT = 6;
/** How many more each "Show more" brings in a "View all" list. */
const LIST_PAGE = 12;

/**
 * Pages of a list, joined as they arrive — page 0 starts it again, any later
 * page adds what it doesn't already have.
 */
function useAccumulated<T extends { internal_id: string }>(entries: T[] | undefined, page: number): T[] {
  const [all, setAll] = useState<T[]>([]);
  useEffect(() => {
    if (!entries) return;
    setAll((prev) => {
      if (page === 0) return entries;
      const seen = new Set(prev.map((e) => e.internal_id));
      return [...prev, ...entries.filter((e) => !seen.has(e.internal_id))];
    });
  }, [entries, page]);
  return all;
}

/** The foot of a "View all" list: more to load, or nothing. */
function ShowMore({ shown, total, loading, onPress }: { shown: number; total: number; loading: boolean; onPress: () => void }) {
  if (shown >= total) return null;
  return (
    <TouchableOpacity style={styles.showMore} onPress={onPress} disabled={loading} activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator size="small" color={COLOR_WHITE} />
        : <Text style={styles.showMoreText}>Show more ({total - shown})</Text>}
    </TouchableOpacity>
  );
}

/** A list opening before its first page is in. */
function PaneLoading() {
  return <ActivityIndicator style={{ marginVertical: 40 }} color={COLOR_WHITE} />;
}

/** Lines of description shown before "… more". */
const DESC_LINES = 3;
/** Characters the third line gives up so "… more" fits on the end of it. */
const MORE_ROOM = 9;

/** The owners pill and the like/comment pill, one height so the row reads as a pair. */
const PILL_ROW_H = 38;

const styles = StyleSheet.create({
  paneGrid: { paddingHorizontal: 12, paddingTop: 12 },
  showMore: {
    alignSelf: 'center', marginTop: 14, minWidth: 160, alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  showMoreText: { fontSize: 13.5, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  /**
   * Sizes to what's in it.
   *
   * It was pinned to `GALLERY_HEIGHT + 24` — the height of the scrolling strip
   * — which was right while the hero was cropped to that same box. Now that a
   * lone photo takes its own proportions, a wide one leaves the difference as
   * a band of black under it. The strip's own children carry explicit heights,
   * so it still measures correctly without this. No ground of its own: the
   * photos sit on the page's.
   */
  galleryWrap:    {},
  galleryStrip:   { paddingTop: 0, paddingBottom: 4, paddingLeft: 12, gap: 10, alignItems: 'flex-start' },
  heroSlide:      { width: HERO_WIDTH, height: GALLERY_HEIGHT, borderRadius: 12, overflow: 'hidden' },
  // A lone photo is inset and rounded rather than run to the edges: with no
  // second card beside it there's no strip to be part of, so full-bleed made it
  // read as a banner rather than as the car's one picture. `overflow: hidden`
  // is what actually clips the image to the corners — the radius alone does
  // nothing to a child on absolute fill.
  // Height comes from the photo's own ratio — see CarGalleryStrip.
  // On a car that isn't yours, the one photo runs to the screen's edges —
  // its corners still rounded, as the inset one's are.
  fullHeroBleed: { width: SCREEN_WIDTH, marginHorizontal: 0 },
  fullHero: {
    width: SCREEN_WIDTH - 24,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addGalleryOverlay: {
    // 12 to clear the photo's own inset, plus 12 inside it.
    position: 'absolute', top: 12, right: 24,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: COMMON_RADIUS,
  },
  changeHeroButton: {
    position: 'absolute', right: 10, bottom: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  addGalleryOverlayText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: FONT_INTER.bold },
  albumCol:       { gap: 10 },
  albumCard:      { width: ALBUM_COL_WIDTH, height: (GALLERY_HEIGHT - 10) / 2, borderRadius: COMMON_RADIUS, overflow: 'hidden' },
  albumOverlay:   {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  albumTitle:     { flex: 1, color: COLOR_WHITE, fontSize: 12, fontFamily: FONT_INTER.bold, marginRight: 6 },
  albumCountRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  albumCount:     { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: FONT_INTER.semibold },

  albumManageBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: COMMON_RADIUS, padding: 4,
  },

  modTypeChip:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  modTypeChipText: { fontSize: 13, fontFamily: FONT_INTER.semibold },

  addGalleryCard: {
    width: ALBUM_COL_WIDTH, borderRadius: COMMON_RADIUS,
    borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  addGalleryText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: FONT_INTER.semibold },

  gallerySheetLabel:  { fontSize: 13, fontFamily: FONT_INTER.bold, marginBottom: 6 },
  galleryImageGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  galleryThumbWrap:   { position: 'relative' },
  galleryThumb:       { width: 72, height: 72, borderRadius: 8 },
  galleryThumbRemove: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, padding: 3 },
  galleryAddPhoto:    { width: 72, height: 72, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  galleryPhotoField:  { marginTop: 0, marginBottom: 4 },


  // The page's 12 at the sides, as the heading, specs and shelves have.
  titleSection: {
    paddingHorizontal: 12,
    // Tight to the gallery above it — the owner row belongs to the photo, not
    // to the block of controls under it.
    paddingTop: 6,
    paddingBottom: 16,
  },
  // Centred, not top-aligned: the actions are 34pt tall and the subtitle is one
  // small line, so flex-start left it hanging off the top of the buttons.
  // On the section's own side padding — the rest of the page's.
  titleRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleLeft:      { flex: 1, marginRight: 8 },
  // No circle behind it. The width stays so the glyph keeps a real tap target
  // and the heading's right edge doesn't shift with it.
  headerMenuBtn: {
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    height: PILL_ROW_H, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: COLOR_BLACK,
  },
  // The to-do button: the + button's disc, widening to a pill for its count.
  tasksPill:      { width: undefined, minWidth: 38, flexDirection: 'row', gap: 5, paddingHorizontal: 9 },
  tasksPillCount: { fontSize: 14, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  // The cog: an outline, beside the filled to-do and + — settings, not an action.
  cogOutline:     { backgroundColor: 'transparent', borderWidth: 1.5 },
  pillItem:       { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 },
  pillItemCount:  { fontSize: 13, fontFamily: FONT_INTER.medium, color: COLOR_WHITE },
  cogBtn:         { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR_BLACK },
  titleActions:   { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  // `flexShrink` on the left group only: a long spec truncates before it can
  // push the type and category chips off the row.
  metaLeft:       { flexShrink: 1, minWidth: 0 },
  // Under the name at the heading's own meta spacing.
  specChip:       { marginTop: 0 },
  specChipText:   { fontSize: 13, fontFamily: FONT_INTER.medium },
  carBadge:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: PILL_RADIUS },
  // Under the spec line, the type's colour then the category.
  carBadges:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  carBadgeText:   { fontSize: 11, fontFamily: FONT_INTER.bold, textTransform: 'capitalize' },
  descWrap:       { marginTop: 12 },
  carDescription: { fontSize: 14, lineHeight: 20 },
  // Inline after the text: the description's size, a step bolder, underlined.
  moreLink:       { fontFamily: FONT_INTER.semibold, textDecorationLine: 'underline' },
  // No rule across the top: the row already reads as its own thing, and the
  // line under a description looked like the end of the page rather than the
  // start of a control.
  actionBtn: {
    height: 34, minWidth: 34, borderRadius: COMMON_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    // The like button brings its own padding; the comment icon has none, so it
    // gets the horizontal room here instead.
    paddingHorizontal: 6,
  },
  // Wider than a square icon button: it holds a word, not a glyph.


  // The owners in one solid black pill, the height of the like/comment pill beside it.
  ownersRow:       {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1,
    height: PILL_ROW_H, paddingLeft: 6, paddingRight: 12, borderRadius: 999,
    // As wide as the names in it, no wider.
    backgroundColor: COLOR_BLACK, alignSelf: 'flex-start',
  },
  ownerChip:       { flexShrink: 1 },
  ownerChipName:   { fontSize: 14, fontFamily: FONT_INTER.bold },
  coOwnerAvatarWrap: { marginLeft: -8 },
  ownerCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 12, borderRadius: COMMON_RADIUS },
  coOwnerCard:     { marginTop: 8, borderTopWidth: 1 },
  ownerInfo:       { flex: 1 },
  ownerName:       { fontSize: 15, fontFamily: FONT_INTER.bold },
  ownerUsername:   { fontSize: 12, marginTop: 1 },
  coOwnerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  modsSection:          { borderTopWidth: 1 },
  modsSectionPadding:   { padding: 16 },
  modsAccordionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  modsAccordionBtnText: { fontSize: 16, fontFamily: FONT_INTER.bold },
  modsSectionRight:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modsContainer:        { marginTop: 10, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  modRow:               {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modRowThumb:          { width: 54, height: 54, borderRadius: 8 },
  modRowInfo:           { flex: 1 },
  modRowTitle:          { fontSize: 14, fontFamily: FONT_INTER.semibold },
  modRowType:           { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },

  // The row runs to the panel's edges; its inset is the content's padding.
  // The panel's header now, so it brings the room from the panel's top edge.
  recordFilters:   { paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1 },
  recordFilterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  filterChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  filterChipText:  { fontSize: 12, fontFamily: FONT_INTER.bold },

  // No box of its own — the cells are the boxes, and a border around a set of
  // bordered cells was a frame around a frame. This just holds the margins and
  // the spacing between rows.
  // The carousel's row: from the page's edge, the columns 8 apart.
  specsTable: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 12, marginTop: 4, marginBottom: 14,
  },
  specsColumn: { width: SPEC_TILE_W, gap: 8 },
  // `minWidth: 0` so a long value truncates inside its own box.
  // Filled and borderless: these are facts, not buttons, and an outline was
  // the one thing making them look like the tappable tiles below.
  specsCell: {
    flex: 1, minWidth: 0,
    paddingTop: 8, paddingBottom: 11, paddingLeft: 12, paddingRight: 9, gap: 8,
    borderRadius: 9,
    backgroundColor: COLOR_GRAY_26,
  },
  // Sentence case, a shade under the value — the label, not a heading.
  specsLabel:  { fontSize: 11.5, fontFamily: FONT_INTER.semibold },
  specsValue:  { fontSize: 14, fontFamily: FONT_INTER.bold },
  // 12, to line the tiles up with the specs table and the heading above them —
  // they were the one block on the page still inset at 16.
  // The room above is the tiles' own, not the last shelf's: a shelf with
  // nothing in it isn't drawn, and its space went with it.
  tilesWrap:       { paddingHorizontal: 12, paddingTop: 26, paddingBottom: 20 },
  // Straight under the specs, whose own margin is the gap.
  tilesWrapTight:  { paddingTop: 0 },
  // Full-width rows rather than a two-up grid. Half-width tiles had to shorten
  // their label to fit and had nowhere to say what the number counted — "12"
  // over "Records" instead of "12 records".
  carTilesGrid:    { gap: 8 },
  carTile: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 10, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 10,
  },
  // No chip behind it — but a fixed width all the same, so the labels start on
  // the same line down the column whatever shape the glyph is.
  carTileIcon: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  // Takes the middle, so the chevron stays pinned right whatever the label.
  carTileText:     { flex: 1, minWidth: 0, gap: 1 },
  carTileLabel:    { fontSize: 15, fontFamily: FONT_INTER.bold, letterSpacing: 0.1 },
  paneTabs: { paddingBottom: 10 },
  // The Cars screen's mosaic, inside the panel.
  paneMosaic: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  paneMosaicColumn: { flex: 1 },
  paneHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  paneTitle: { flex: 1, fontSize: 18, fontFamily: FONT_INTER.extrabold },
  paneNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS },
  paneNewText: { fontSize: 13, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  carTileCount:    { fontSize: 12.5, fontFamily: FONT_INTER.semibold },
  carTileGo: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  discoverTilesRow: { gap: 8, marginTop: 8 },
  paneAlbumGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12 },
  paneAlbumCell:   { width: '47%' },

  specsSection:    { padding: 16 },
  postsSection:    { paddingBottom: 32, borderTopWidth: 1 },
  filterRow:       { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  recordThumb:     { width: 58, height: 58, borderRadius: 6 },
  // `alignSelf` keeps the pill hugging its label now that it's on its own line
  // rather than sharing a row.
  postsSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  inlineCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: COMMON_RADIUS },
  inlineCreateBtnText: { color: COLOR_WHITE, fontSize: 13, fontFamily: FONT_INTER.bold },
  sectionTitle:    { fontSize: 15, fontFamily: FONT_INTER.bold, marginBottom: 12 },
  specGrid:        { borderRadius: 10, overflow: 'hidden' },
  specGridRow:     { flexDirection: 'row' },
  specCell:        { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  specCellLabel:   { fontSize: 11, fontFamily: FONT_INTER.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  specCellValue:   { fontSize: 15, fontFamily: FONT_INTER.bold },
  emptyText:       { fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  sheet:          { minHeight: SCREEN_HEIGHT * 0.5, maxHeight: '90%', borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: 'hidden' },
  sheetHeader:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  sheetTitle:     { fontSize: 17, fontFamily: FONT_INTER.bold },
  sheetCreateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 12, padding: 12, borderRadius: COMMON_RADIUS,
  },
  sheetCreateBtnText: { color: COLOR_WHITE, fontSize: 14, fontFamily: FONT_INTER.bold },
});
