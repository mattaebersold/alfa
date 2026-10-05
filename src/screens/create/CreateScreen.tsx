import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { FormScrollView, KeyboardStickyView, KEYBOARD_GAP } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, ChevronDown, ChevronUp, Check, Play, Camera, Images, Video, Send } from 'lucide-react-native';
import {
  useCreatePostMutation, useGetUserGroupsQuery, useSyncPostTagsMutation,
  useCreateMuxUploadUrlMutation, useAddPostImageMutation, apiService,
} from '../../api/apiService';
import { useAppSelector, useAppDispatch } from '../../store/store';
import ActionSheet from '../../components/ui/ActionSheet';
import MentionInput from '../../components/ui/MentionInput';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import PostTagPicker, { type TagItem as PickerTagItem, type TagKind as PickerTagKind } from '../../components/social/PostTagPicker';
import PostOptionalFields, { EMPTY_OPTIONAL_FIELDS, type OptionalFieldValues } from '../../components/social/PostOptionalFields';
import StickyFormFooter from '../../components/ui/StickyFormFooter';
import PostToSelector from '../../components/social/PostToSelector';
import PollEditor, { emptyPollDraft, pollDraftToInput, type PollDraft } from '../../components/social/PollEditor';
import { ListingCreateSheet } from '../marketplace/ListingCreateScreen';
import { colors } from '../../constants/colors';
import { CREATABLE_POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { uploadVideoToMux, compressVideo } from '../../utils/muxUpload';
import { useColors } from '../../hooks/useColors';
import { contrastText, useBrandColor } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_GRAY_42, COLOR_WHITE, INPUT_LINE_HEIGHT, INPUT_TEXT, COLOR_BLACK, COLOR_GRAY_46 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type AppNav = NativeStackNavigationProp<AppStackParamList>;

// ── Tag types ─────────────────────────────────────────────────────────────────

// Tag types come from the picker so widening its TagKind (e.g. adding groups)
// can't silently drift from what this screen handles.
type TagKind = PickerTagKind;
type TagItem = PickerTagItem;

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
      <TouchableOpacity
        style={[styles.sectionHeader, { backgroundColor: colors.card }]}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <Text style={[styles.sectionLabel, { color: colors.fg }]}>{label}</Text>
        {open ? <ChevronUp size={16} color={colors.grey} /> : <ChevronDown size={16} color={colors.grey} />}
      </TouchableOpacity>
      {open && <View style={{ backgroundColor: colors.card }}>{children}</View>}
    </View>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.fieldRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.fieldLabel, { color: colors.grey }]}>{label}</Text>
      <View style={styles.fieldValue}>{children}</View>
    </View>
  );
}

// ── Video preview (first frame + remove) ──────────────────────────────────────

// ── Draft media ───────────────────────────────────────────────────────────────

/**
 * A photo or a video the author has added, before any of it is uploaded.
 *
 * One list rather than two. A post used to be photos *or* a single video, which
 * the form enforced by silently emptying one when you touched the other —
 * picking a video after three photos threw the photos away. They now share a
 * list, and its order is the order they'll appear in on the post, so a video
 * can sit in the middle of the photos instead of only in front of them.
 */
type DraftMedia =
  | { key: string; kind: 'image'; uri: string; name: string; type: string }
  | { key: string; kind: 'video'; uri: string; poster: string | null };

let _mediaSeq = 0;
const nextMediaKey = () => `m${++_mediaSeq}_${Date.now()}`;

/** How much media one post can carry. */
const MAX_MEDIA = 10;

/**
 * Whether there is a camera to open at all.
 *
 * The Simulator has none, and expo-image-picker doesn't answer that with a
 * rejected promise — it raises a native exception ("Source type 1 not
 * available") and the app is gone. Nothing in the installed modules says
 * "simulator" outright (expo-constants dropped `isDevice`; expo-device isn't
 * linked), so this reads the one tell that's left: since iOS 16 a real device
 * reports its name as the bare model — "iPhone", "iPad" — unless the app
 * holds an entitlement this one doesn't, while the Simulator reports the
 * device it's pretending to be ("iPhone 16 Pro"). Wrong only on a device too
 * old for that rule, where the cost is the library picker instead of the
 * camera — never a crash. Android emulators have a camera, so no check there.
 */
const HAS_CAMERA = Platform.OS !== 'ios' || /^(iPhone|iPad|iPod touch)$/.test(Constants.deviceName ?? '');

/** The tabs under the header — what the thing being made is. */
type CreateKind = 'post' | 'poll' | 'listing';
const CREATE_KINDS: { key: CreateKind; label: string }[] = [
  { key: 'post',    label: 'Post' },
  { key: 'poll',    label: 'Poll' },
  { key: 'listing', label: 'Marketplace listing' },
];

/**
 * One added item, with the handle to remove it.
 *
 * A video shows a still rather than a live player. A row of four autoplaying
 * previews is four decoders running to render four thumbnails, and it competes
 * with the form for the very resources typing needs.
 */
function MediaThumb({ item, onRemove }: { item: DraftMedia; onRemove: () => void }) {
  const uri = item.kind === 'image' ? item.uri : item.poster;
  return (
    <View style={styles.thumbWrap}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      {item.kind === 'video' && (
        <View style={styles.videoPlayBadge}><Play size={14} color={COLOR_WHITE} fill={COLOR_WHITE} /></View>
      )}
      <TouchableOpacity style={styles.thumbRemove} onPress={onRemove} hitSlop={6}>
        <X size={11} color={COLOR_WHITE} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
  const route = useRoute<RouteProp<AppStackParamList, 'Create'>>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const brand = useBrandColor();

  // No native header — this draws its own bar below, which sits lower and runs
  // straight into the form in the same card colour. It's switched off where
  // the route is registered (AppNavigator), not from here.
  const { userInfo } = useAppSelector((s) => s.auth);

  // Opened from a car ("New post" on your own car's card), the post starts with
  // that car already tagged — the tag is the whole reason you started there.
  const prefilledCar: TagItem[] = route.params?.carId
    ? [{ id: route.params.carId, label: route.params.carTitle || 'Car', kind: 'car' }]
    : [];

  /**
   * What's being made: a post, a poll, or a marketplace listing — the tabs
   * under the header. One form for the first two (a poll is a post with a
   * question on it); the listing has a form of its own, which opens over this
   * one with the photos carried across.
   */
  const [kind, setKind] = useState<CreateKind>('post');

  // Core
  const [postType, setPostType]   = useState<PostType>('general');
  // The first of the type's categories, chosen up front — see handleTypeChange.
  const [category, setCategory]   = useState(() => POST_CATEGORIES.general[0]?.key ?? '');
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [media, setMedia]         = useState<DraftMedia[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  /** Which video, of how many, which step it's on, and how far through that step (0–1). */
  const [videoProgress, setVideoProgress] = useState<{
    current: number; total: number; step: 'compressing' | 'uploading'; fraction: number;
  } | null>(null);
  /**
   * Videos already on Mux, by file. A post that fails after its first video
   * made it — the second one, or the create itself — is tried again with the
   * same Post tap, and re-sending a video that already arrived is minutes of
   * someone's data for nothing.
   */
  const sentVideos = useRef(new Map<string, string>());
  // Photos upload one-at-a-time after the post is created — this is the progress.
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number } | null>(null);

  // Optional fields, in one bag — the shared block owns their shape.
  const [optional, setOptional] = useState<OptionalFieldValues>(EMPTY_OPTIONAL_FIELDS);
  const { year, make, model, trim, price, mileage, condition, vin, partNumber } = optional;

  // Groups. Opened from a group's own page, that group starts ticked — and
  // only that one; the rest are the author's to add.
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    route.params?.groupId ? [route.params.groupId] : [],
  );
  const [isPublic, setIsPublic]                 = useState(true);

  // Poll — off until the author switches it on; the editor owns the shape.
  const [poll, setPoll] = useState<PollDraft>(emptyPollDraft);

  // Tags (people, cars, events) — the search/autocomplete lives in PostTagPicker
  const [taggedUsers, setTaggedUsers]   = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars]     = useState<TagItem[]>(prefilledCar);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);
  const [taggedSpots, setTaggedSpots]   = useState<TagItem[]>([]);

  // A pin made from the picker's "Create a new pin" comes back as route params
  // once saved — see PhotoSpotCreateScreen — and joins the tags here.
  const returnedSpotId = route.params?.spotId;
  const returnedSpotTitle = route.params?.spotTitle;
  useEffect(() => {
    if (!returnedSpotId) return;
    setTaggedSpots((prev) => prev.some((t) => t.id === returnedSpotId)
      ? prev
      : [...prev, { id: returnedSpotId, label: returnedSpotTitle || 'Photo spot', kind: 'spot' }]);
  }, [returnedSpotId, returnedSpotTitle]);

  const [createPost, { isLoading: submitting }] = useCreatePostMutation();
  const [createMuxUploadUrl] = useCreateMuxUploadUrlMutation();
  const [addPostImage] = useAddPostImageMutation();
  const dispatch = useAppDispatch();
  const [syncTags] = useSyncPostTagsMutation();
  const { data: rawGroups } = useGetUserGroupsQuery(userInfo?.user_id ?? '', {
    skip: !userInfo?.user_id,
  });
  const userGroups: any[] = Array.isArray(rawGroups) ? rawGroups : (rawGroups as any)?.entries ?? [];

  const currentCategories = POST_CATEGORIES[postType];

  // Never, now: a price belongs to a marketplace listing, and a post can no
  // longer be one. Kept as a named constant rather than deleted, so the field
  // block below still reads as "these are the optional fields, price excluded".
  const showPrice    = false;
  // Mileage is offered on every kind of post, not just listings and records:
  // a spot, a show photo or a general update is as likely to be worth stamping
  // with the number on the clock.
  const showMileage  = true;

  // A new type brings a new list of categories, with its first one chosen.
  const handleTypeChange = (t: PostType) => {
    setPostType(t);
    setCategory(POST_CATEGORIES[t][0]?.key ?? '');
  };

  /** Room left before the post hits its media limit. */
  const mediaRoom = useCallback(() => MAX_MEDIA - media.length, [media.length]);

  const appendMedia = useCallback((items: DraftMedia[]) => {
    if (items.length === 0) return;
    setMedia((prev) => [...prev, ...items].slice(0, MAX_MEDIA));
  }, []);

  /**
   * A still from the first moment of a video, for its tile in the form.
   *
   * Best-effort: a codec the extractor can't open still gives a usable draft —
   * the tile falls back to a plain placeholder, and nothing about the upload
   * depends on it.
   */
  const posterFor = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const { uri: poster } = await VideoThumbnails.getThumbnailAsync(uri, { time: 0 });
      return poster;
    } catch {
      return null;
    }
  }, []);

  const toDraft = useCallback(async (
    assets: ImagePicker.ImagePickerAsset[],
  ): Promise<DraftMedia[]> => {
    const videos = assets.filter((a) => a.type === 'video');
    const photos = assets.filter((a) => a.type !== 'video');

    // Photos are transcoded to uploadable JPEGs in one pass; videos only need a
    // poster frame, since the file itself goes to Mux untouched.
    const normalized = photos.length > 0 ? await normalizePickedAssets(photos) : [];
    const photoDrafts: DraftMedia[] = normalized.map((n) => ({
      key: nextMediaKey(), kind: 'image', ...n,
    }));
    const videoDrafts: DraftMedia[] = await Promise.all(
      videos.map(async (v) => ({
        key: nextMediaKey(),
        kind: 'video' as const,
        uri: v.uri,
        poster: await posterFor(v.uri),
      })),
    );

    // Back into the order they were picked in, rather than photos-then-videos:
    // that order is the order they'll appear in on the post.
    const byUri = new Map<string, DraftMedia>();
    normalized.forEach((n, i) => byUri.set(photos[i].uri, photoDrafts[i]));
    videos.forEach((v, i) => byUri.set(v.uri, videoDrafts[i]));
    return assets.map((a) => byUri.get(a.uri)).filter((d): d is DraftMedia => !!d);
  }, [posterFor]);

  const addFromLibrary = useCallback(async () => {
    const room = mediaRoom();
    if (room <= 0) return;
    // Photos and videos in one pass — the author picks what they want in the
    // order they want it, instead of choosing a lane first.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.85,
      videoMaxDuration: 120,
      // iOS hands library videos over untouched by default — often 4K, and
      // several hundred MB for two minutes, which is what timed out on a
      // phone connection. 1080p is what the post plays at anyway (Mux
      // streams it adaptively), and any preset but Passthrough also fetches
      // an iCloud-only video instead of failing to load it.
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
    });
    if (result.canceled) return;
    appendMedia(await toDraft(result.assets));
  }, [mediaRoom, appendMedia, toDraft]);

  const addFromCamera = useCallback(async () => {
    if (!HAS_CAMERA) {
      Alert.alert('No camera', 'This device has no camera. Choose from the library instead.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access needed', 'Please allow camera access in Settings to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    appendMedia(await toDraft(result.assets));
  }, [appendMedia, toDraft]);

  const addVideoFromCamera = useCallback(async () => {
    if (!HAS_CAMERA) {
      Alert.alert('No camera', 'This device has no camera. Choose from the library instead.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access needed', 'Please allow camera access in Settings to record video.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets[0]) return;
    appendMedia(await toDraft(result.assets));
  }, [appendMedia, toDraft]);

  // A sheet rather than Alert.alert: Android's platform dialog takes three
  // buttons and drops the rest, so the extra options and the Cancel never made
  // it to the screen — and what was left couldn't be dismissed by tapping
  // outside or by the back button.
  const [mediaSheet, setMediaSheet] = useState(false);
  const pickImage = useCallback(() => {
    Keyboard.dismiss();
    if (media.length >= MAX_MEDIA) {
      Alert.alert('Media limit reached', `A post can carry up to ${MAX_MEDIA} photos and videos.`);
      return;
    }
    setMediaSheet(true);
  }, [media.length]);

  const removeMedia = useCallback((key: string) => {
    setMedia((prev) => prev.filter((m) => m.key !== key));
  }, []);

  /**
   * Opened from the tab bar's +: the camera comes up before the form does,
   * for a photo or a video, and the form starts with what it took. Backing
   * out of the camera offers the library instead — the system camera has no
   * way into the roll of its own — and backing out of that leaves an empty
   * form, with the media field first thing on it.
   */
  const captured = useRef(false);
  useEffect(() => {
    if (!route.params?.capture || captured.current) return;
    captured.current = true;
    const run = async () => {
      try {
        const { status } = HAS_CAMERA
          ? await ImagePicker.requestCameraPermissionsAsync()
          : { status: 'denied' as const };
        if (status === 'granted') {
          const shot = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.85,
            videoMaxDuration: 120,
            videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
          });
          if (!shot.canceled && shot.assets.length) {
            appendMedia(await toDraft(shot.assets));
            return;
          }
        }
        await addFromLibrary();
      } catch (e) {
        // The picker failing to present is not worth the form: it's still
        // here, with the media field first on it.
        console.warn('[Create] capture failed:', e);
      }
    };
    // Not until this screen has finished arriving. The camera is a native
    // modal, and iOS refuses — or worse — to present one over a screen that
    // is itself still being presented. `transitionEnd` is that moment; the
    // timer is for a host that never fires it (a screen already settled).
    let fired = false;
    const go = () => { if (!fired) { fired = true; void run(); } };
    const unsub = appNav.addListener('transitionEnd' as any, go);
    const timer = setTimeout(go, 600);
    return () => { unsub(); clearTimeout(timer); };
  }, [route.params?.capture, appendMedia, toDraft, addFromLibrary, appNav]);

  // ── Tag helpers ─────────────────────────────────────────────────────────────

  const toggleTag = useCallback((tag: TagItem) => {
    // Posts don't offer group tagging, so the picker never emits one here.
    if (tag.kind === 'group') return;
    const setter = tag.kind === 'user' ? setTaggedUsers
      : tag.kind === 'car' ? setTaggedCars
      : tag.kind === 'spot' ? setTaggedSpots
      : setTaggedEvents;
    setter((prev) => {
      const exists = prev.some(t => t.id === tag.id);
      return exists ? prev.filter(t => t.id !== tag.id) : [...prev, tag];
    });
  }, []);

  // ── Group toggle ─────────────────────────────────────────────────────────────

  const toggleGroup = useCallback((gid: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
    );
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    // The poll goes only from the Poll tab; a draft left on it while posting
    // from the Post tab stays here.
    const draft: PollDraft = { ...poll, enabled: kind === 'poll' };
    if (kind === 'post' && !title.trim() && !body.trim() && media.length === 0) {
      Alert.alert('Content required', 'Please add a title, body, photo or video.');
      return;
    }
    // Checked before anything uploads: a video takes a while to reach Mux, and
    // learning the poll was one option short *after* that is the wrong order.
    const pollInput = pollDraftToInput(draft);
    if (pollInput.error) {
      Alert.alert('Check the poll', pollInput.error);
      return;
    }

    const fd = new FormData();
    fd.append('type', postType);
    fd.append('entry_type', postType);
    if (category)           fd.append('category', category);
    if (title.trim())       fd.append('title', title.trim());
    if (body.trim())        fd.append('body', body.trim());
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    if (year.trim())        fd.append('year', year.trim());
    if (make.trim())        fd.append('make', make.trim());
    if (model.trim())       fd.append('model', model.trim());
    if (trim.trim())        fd.append('trim', trim.trim());
    if (price.trim())       fd.append('price', price.trim());
    if (mileage.trim())     fd.append('mileage', mileage.trim());
    if (condition.trim())   fd.append('condition', condition.trim());
    if (vin.trim())         fd.append('vin', vin.trim());
    if (partNumber.trim())  fd.append('part_number', partNumber.trim());

    if (selectedGroupIds.length > 0) {
      fd.append('group_ids', JSON.stringify(selectedGroupIds));
      if (isPublic) fd.append('also_public', 'true');
    }

    // One JSON field inside the multipart body — see PollInput.
    if (pollInput.poll) fd.append('poll', JSON.stringify(pollInput.poll));

    // Videos go straight to Mux (never through our API). Each one is sent with
    // the position it occupies in the post's media, because Mux takes minutes to
    // encode and the server has to hold the slot in the meantime — without the
    // index a video would land wherever it happened to finish.
    const videoItems = media
      .map((m, index) => ({ m, index }))
      .filter((x): x is { m: Extract<DraftMedia, { kind: 'video' }>; index: number } =>
        x.m.kind === 'video');

    if (videoItems.length > 0) {
      setVideoUploading(true);
      const uploads: { upload_id: string; index: number }[] = [];
      try {
        for (const [n, { m, index }] of videoItems.entries()) {
          let id = sentVideos.current.get(m.uri);
          if (!id) {
            const at = { current: n + 1, total: videoItems.length };
            setVideoProgress({ ...at, step: 'compressing', fraction: 0 });
            const file = await compressVideo(
              m.uri,
              (fraction) => setVideoProgress({ ...at, step: 'compressing', fraction }),
            );
            setVideoProgress({ ...at, step: 'uploading', fraction: 0 });
            id = await uploadVideoToMux(
              file,
              () => createMuxUploadUrl().unwrap(),
              (fraction) => setVideoProgress({ ...at, step: 'uploading', fraction }),
            );
            sentVideos.current.set(m.uri, id);
          }
          uploads.push({ upload_id: id, index });
        }
        fd.append('mux_uploads', JSON.stringify(uploads));
      } catch (e) {
        console.warn('[CreatePost] video upload failed:', e);
        setVideoUploading(false);
        setVideoProgress(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Video upload failed',
          "We couldn't get the video through after a few tries — usually a weak connection. "
            + 'Anything that already made it is kept, so tapping Post again picks up where it stopped.',
        );
        return;
      }
      setVideoUploading(false);
      setVideoProgress(null);
    }
    // NOTE: photos are NOT attached here — they're added one-at-a-time after the
    // post exists (below), so we never send one giant multipart request.

    try {
      const result = await createPost(fd).unwrap();
      const postId =
        (result as any)?._id ??
        (result as any)?.entry?.internal_id ??
        (result as any)?.internal_id;

      // Upload photos sequentially, then refresh the feed so they appear. Each
      // carries its position in the media list — the server can't infer it,
      // since a video may already be holding a slot among these photos.
      const photoItems = media
        .map((m, index) => ({ m, index }))
        .filter((x): x is { m: Extract<DraftMedia, { kind: 'image' }>; index: number } =>
          x.m.kind === 'image');

      if (photoItems.length > 0 && postId) {
        setImageProgress({ current: 0, total: photoItems.length });
        let done = 0;
        for (const { m, index } of photoItems) {
          const ifd = new FormData();
          ifd.append('internal_id', postId);
          ifd.append('index', String(index));
          ifd.append('gallery', uploadFile(m.uri));
          try { await addPostImage(ifd).unwrap(); } catch { /* keep going; partial upload */ }
          done += 1;
          setImageProgress({ current: done, total: photoItems.length });
        }
        setImageProgress(null);
        dispatch(apiService.util.invalidateTags(['Post', 'UserEntries']));
      }

      const hasAnyTags = taggedUsers.length > 0 || taggedCars.length > 0 || taggedEvents.length > 0 || taggedSpots.length > 0;
      if (hasAnyTags && postId) {
        // Await so the request finishes before we navigate away (unmounting was
        // racing the fire-and-forget call), and surface failures instead of
        // swallowing them.
        try {
          await syncTags({
            post_id: postId,
            tagged_users: taggedUsers.map(t => t.id),
            tagged_cars: taggedCars.map(t => t.id),
            tagged_events: taggedEvents.map(t => t.id),
            tagged_photospots: taggedSpots.map(t => t.id),
          }).unwrap();
        } catch (e) {
          console.warn('[CreatePost] tag sync failed:', JSON.stringify(e));
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appNav.goBack();
    } catch (err: any) {
      setImageProgress(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Surface the real reason instead of a generic message.
      console.error('[CreatePost] failed:', JSON.stringify(err, null, 2));
      const status = err?.status;
      const serverMsg = err?.data?.error ?? err?.data?.message ?? (typeof err?.data === 'string' ? err.data : '');
      const rawMsg = typeof err?.error === 'string' ? err.error : '';
      const detail =
        status === 'FETCH_ERROR'   ? `Network request failed.\nError: ${rawMsg || 'n/a'}` :
        status === 'TIMEOUT_ERROR' ? 'The request timed out.' :
        status === 'PARSING_ERROR' ? `Server returned an unexpected response (HTTP ${err?.originalStatus}).` :
        status === 401 || status === 403 ? 'You appear to be signed out. Please log in again.' :
        serverMsg ? serverMsg :
        typeof status === 'number' ? `Server error (HTTP ${status}).` :
        `Unknown error: ${rawMsg || JSON.stringify(err)}`;
      Alert.alert('Post failed', detail);
    }
  }, [
    kind, postType, category, title, body, mentionedUserIds, optional, selectedGroupIds, isPublic, poll,
    taggedUsers, taggedCars, taggedEvents, media,
    createPost, createMuxUploadUrl, addPostImage, dispatch, syncTags, appNav, taggedSpots,
  ]);

  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }];

  // The Done footer is only there while the keyboard is — see below.
  const keyboardUp = useKeyboardState((st) => st.isVisible);
  const busy = submitting || videoUploading || imageProgress !== null;

  return (
    // One ground from top to bottom: the card colour the type row and photos
    // sit on, so the sections below don't read as a second surface.
    // No bottom edge: the form runs to the foot of the screen, under the home
    // indicator, and its own end padding (below) is what clears it.
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.card }]} edges={[]}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
        <View style={styles.headerBar}>
          <Text style={[styles.headerTitle, { color: colors.fg }]}>Create</Text>
          <TouchableOpacity
            style={styles.headerClose}
            onPress={() => appNav.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={22} color={colors.fg} />
          </TouchableOpacity>
        </View>
        {/* What this becomes. The listing tab opens the marketplace's own
            form over this one, with the photos; closing it lands back here. */}
        <View style={styles.kindRow} accessibilityRole="tablist">
          {CREATE_KINDS.map(({ key, label }) => {
            const on = kind === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.kindTab, on && { backgroundColor: brand }]}
                onPress={() => setKind(key)}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.kindLabel, { color: on ? COLOR_BLACK : colors.muted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      <FormScrollView
        style={styles.scroll}
        keyboardDismissMode="on-drag"
        // The Done footer floats on the keyboard over the form, so the focused
        // field is kept clear of it too, and with the keyboard up the tail has
        // room for the Post button to scroll out from under it.
        bottomOffset={KEYBOARD_GAP + DONE_FOOTER_H}
        extraKeyboardSpace={DONE_FOOTER_H}
        // Clear of the home indicator / navigation bar once scrolled to the end.
        contentContainerStyle={{ paddingBottom: insets.bottom + (Platform.OS === 'android' ? 40 : 24) }}
      >
        {/* Photos / video */}
        <View style={[styles.photosSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <PhotoPickerField
            onPress={pickImage}
            title={media.length ? 'Add More Media' : 'Add Photos or Video'}
            hint=""
            muted
            compact={media.length > 0}
            style={styles.photoField}
          />
          {media.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbRow}
              keyboardShouldPersistTaps="handled"
            >
              {media.map((item) => (
                <MediaThumb key={item.key} item={item} onRemove={() => removeMedia(item.key)} />
              ))}
            </ScrollView>
          )}
        </View>

        {kind === 'post' && (<>
        {/* Type selector */}
        <View style={[styles.typeRow, { backgroundColor: colors.card }]}>
          {CREATABLE_POST_TYPES.map(({ type, label, color }) => {
            const active = postType === type;
            const fill = active ? color : colors.inputBg;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, { backgroundColor: fill }]}
                onPress={() => handleTypeChange(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeLabel, { color: contrastText(fill) }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category chips — straight under the types, no rule between */}
        {currentCategories.length > 0 && (
          <View style={[styles.catRow, { backgroundColor: colors.card }]}>
            {currentCategories.map(({ key, label }) => {
              const active = category === key;
              const fill = active ? colors.primaryAlt : colors.inputBg;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.catChip, { backgroundColor: fill }]}
                  onPress={() => setCategory(active ? '' : key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catLabel, { color: contrastText(fill) }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}


        {/* Title */}
        <View style={[styles.inputBlock, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.titleInput, { backgroundColor: colors.inputBg, color: colors.fg }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title..."
            placeholderTextColor={colors.grey}
            returnKeyType="next"
          />
        </View>
        </>)}

        {/* ── The poll, on its tab: the question and its choices, and no
            switch — here the poll is the post. ── */}
        {kind === 'poll' && (
          <View style={styles.pollBlock}>
            <PollEditor draft={poll} onChange={setPoll} fixed />
          </View>
        )}

        {/* Body */}
        <View style={[styles.inputBlock, { backgroundColor: colors.card, paddingBottom: 12 }]}>
          <MentionInput
            style={[styles.bodyInput, { backgroundColor: colors.inputBg, color: colors.fg }]}
            value={body}
            onChangeText={(text, ids) => { setBody(text); setMentionedUserIds(ids); }}
            placeholder={kind === 'poll' ? 'Say something about it (optional)' : "What's on your mind?"}
            placeholderTextColor={colors.grey}
            multiline
          />
        </View>

        {/* ── Optional fields — a post's; a poll has none. ── */}
        {kind === 'post' && (
          <PostOptionalFields
            values={optional}
            onChange={(patch) => setOptional((prev) => ({ ...prev, ...patch }))}
            showPrice={showPrice}
          />
        )}

        {/* ── Tag people, cars & events — always visible (no accordion). No
            label over it: the picker's own search says what it's for. ── */}
        <View style={styles.tagSection}>
          <PostTagPicker
            users={taggedUsers}
            cars={taggedCars}
            events={taggedEvents}
            spots={taggedSpots}
            onToggle={toggleTag}
            // The pin form opens over this one and hands the new pin back — see returnedSpotId.
            onCreateSpot={(name) => appNav.navigate('PhotoSpotCreate', { name: name || undefined, pickFor: { screen: 'Create' } })}
          />
        </View>

        {/* ── Post to ── */}
        {/* Framed and headed like the tag cards and Optional Details above it. */}
        <View style={[styles.postToCard, { backgroundColor: colors.card, borderColor: COLOR_GRAY_46 }]}>
          <View style={styles.postToHead}>
            <Send size={15} color={COLOR_WHITE} />
            <Text style={[styles.postToTitle, { color: colors.fg }]}>Post To</Text>
          </View>
          <PostToSelector
            bleed={POST_TO_PAD}
            isPublic={isPublic}
            onTogglePublic={() => setIsPublic((v) => !v)}
            groups={userGroups}
            selectedGroupIds={selectedGroupIds}
            onToggleGroup={toggleGroup}
          />
          {userGroups.length === 0 && (
            <Text style={[styles.postToEmpty, { color: colors.grey }]}>
              You're not a member of any groups yet.
            </Text>
          )}
        </View>

        {/* ── Post button ──
            Ends the form, full width, rather than floating over it: posting is
            the last thing you do here, after the fields above it, and pinned
            over the scroll it sat on top of whatever was being filled in. */}
        <TouchableOpacity
          // The brand colour — Pro gold or blue — with black on it, like every
          // other brand-filled button.
          style={[styles.submitBtn, { backgroundColor: brand }, busy && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={kind === 'poll' ? 'Create poll' : 'Create post'}
        >
          {busy ? (
            <>
              <ActivityIndicator color={COLOR_BLACK} size="small" />
              {videoUploading ? (
                <Text style={[styles.submitText, { marginLeft: 8 }]}>
                  {videoProgress
                    ? `${videoProgress.step === 'compressing' ? 'Preparing' : 'Uploading'} video${videoProgress.total > 1 ? ` ${videoProgress.current} of ${videoProgress.total}` : ''}… ${Math.round(videoProgress.fraction * 100)}%`
                    : 'Uploading video…'}
                </Text>
              ) : imageProgress ? (
                <Text style={[styles.submitText, { marginLeft: 8 }]}>Uploading {imageProgress.current} of {imageProgress.total}…</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.submitText}>{kind === 'poll' ? 'Create poll' : 'Post'}</Text>
          )}
        </TouchableOpacity>
      </FormScrollView>

      {/* The marketplace's own form, over this one, with the photos taken so
          far. It has its steps, its allowance check and its own Post; closing
          it comes back to the Post tab. */}
      {kind === 'listing' && (
        <ListingCreateSheet
          initialKind="sale"
          initialGroupId={route.params?.groupId}
          initialImages={media.filter((m): m is Extract<DraftMedia, { kind: 'image' }> => m.kind === 'image')
            .map((m) => ({ uri: m.uri, name: m.name, type: m.type }))}
          onDismissed={() => setKind('post')}
        />
      )}

      {/* The body field is multiline, so its return key inserts a newline and
          can't double as a dismiss. Without this the only way out of the
          keyboard is to know that dragging the form closes it. Only while the
          keyboard is up — the Post button no longer lives down here. */}
      {keyboardUp && (
        <KeyboardStickyView style={styles.doneDock}>
        <StickyFormFooter color={colors.card} bottomInset={10} style={styles.doneFooter}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              onPress={() => Keyboard.dismiss()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss keyboard"
            >
              <Text style={[styles.doneText, { color: colors.fg }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </StickyFormFooter>
        </KeyboardStickyView>
      )}

      <ActionSheet
        visible={mediaSheet}
        onClose={() => setMediaSheet(false)}
        title="Add media"
        message="Photos and videos can be mixed, in any order."
        options={[
          { label: 'Choose from Library', Icon: Images, onPress: addFromLibrary },
          { label: 'Take Photo',          Icon: Camera, onPress: addFromCamera },
          { label: 'Record Video',        Icon: Video,  onPress: addVideoFromCamera },
        ]}
      />
    </SafeAreaView>
  );
}

/** How tall the floating Done footer stands: its fade, the button, its gap. */
const DONE_FOOTER_H = 76;

/** The Post To card's padding — its group cards bleed out past it. */
const POST_TO_PAD = 14;

const styles = StyleSheet.create({
  scroll:       { flex: 1 },

  // Lower than the stack's header: the title and the close, and no more.
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 20,
  },
  headerClose: { position: 'absolute', right: 20, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: FONT_INTER.extrabold },
  // Under the header: three pills in a row, the lit one in the brand colour.
  kindRow:   { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  kindTab:   { paddingHorizontal: 14, paddingVertical: 8, borderRadius: PILL_RADIUS, backgroundColor: 'rgba(255,255,255,0.06)' },
  kindLabel: { fontSize: 13, fontFamily: FONT_INTER.bold },
  pollBlock: { paddingTop: 4 },
  // Tight to the header above — the header's own padding is the gap.
  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 12 },
  typeBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: COMMON_RADIUS },
  typeLabel:    { fontSize: 12, fontFamily: FONT_INTER.bold },

  catRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 10 },
  // A step down from the type pills above: these refine the type.
  catChip:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS },
  catLabel:     { fontSize: 11, fontFamily: FONT_INTER.semibold },

  inputBlock:   { paddingHorizontal: 12, paddingTop: 12 },
  titleInput:   { paddingHorizontal: 14, paddingVertical: 12, ...INPUT_TEXT, borderRadius: 10 },
  bodyInput:    { paddingHorizontal: 14, paddingVertical: 12, ...INPUT_TEXT, lineHeight: INPUT_LINE_HEIGHT, minHeight: 110, borderRadius: 10, textAlignVertical: 'top' as const },

  photosSection:{ borderBottomWidth: 1, paddingBottom: 10 },
  // The width of the form, like the fields under it — the well's own default
  // is a narrower box centred on the page.
  photoField:   { alignSelf: 'stretch', maxWidth: '100%', marginHorizontal: 14, marginTop: 12, marginBottom: 4 },
  thumbRow:     { paddingHorizontal: 14 },
  thumbWrap:    { marginRight: 8, position: 'relative' },
  thumb:        { width: 72, height: 72, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: COLOR_GRAY_42 },
  videoPlayBadge: {
    position: 'absolute', top: '50%', left: '50%', marginTop: -16, marginLeft: -16,
    width: 32, height: 32, borderRadius: PILL_RADIUS, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbRemove:  {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  // The gap the label used to leave, without the label.
  tagSection:    { marginTop: 12 },
  sectionLabel:  { fontSize: 14, fontFamily: FONT_INTER.bold },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  fieldLabel:    { fontSize: 13, fontFamily: FONT_INTER.semibold, width: 90 },
  fieldValue:    { flex: 1 },
  input:         { flex: 1, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderRadius: 8 },

  postToCard: {
    marginHorizontal: 12, marginTop: 12,
    padding: POST_TO_PAD, borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  // The tag cards' head: a white icon and a title.
  postToHead:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  postToTitle: { fontSize: 15, fontFamily: FONT_INTER.bold },
  postToEmpty: { paddingTop: 12, fontSize: 13 },

  // Tags
  selectedTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  tagChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tagChipText:     { fontSize: 12, fontFamily: FONT_INTER.semibold, maxWidth: 120 },
  tagSearchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tagSearchInput:  { flex: 1, fontSize: 14 },
  tagGroupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tagGroupLabel:   { fontSize: 11, fontFamily: FONT_INTER.bold },
  tagResultRow:    { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  tagResultChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tagResultText:   { fontSize: 13, fontFamily: FONT_INTER.semibold, maxWidth: 160 },
  tagEmpty:        { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },

  // Checkbox
  checkbox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  // Pinned to the bottom edge and carried up on the keyboard; the footer
  // inside is in flow rather than absolute so it has the dock's size.
  doneDock:        { position: 'absolute', left: 0, right: 0, bottom: 0 },
  doneFooter:      { position: 'relative' },
  footerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  doneBtn:         {
    paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  doneText:        { fontSize: 15, fontFamily: FONT_INTER.bold },
  // Full width at the end of the scroll. The old "sized to its word" rule was
  // about a bar floating over the form; in the flow it's the form's last row.
  submitBtn:       {
    marginHorizontal: 12, marginTop: 20,
    borderRadius: COMMON_RADIUS,
    paddingVertical: 14, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: COLOR_BLACK, fontSize: 17, fontFamily: FONT_INTER.extrabold },
});
