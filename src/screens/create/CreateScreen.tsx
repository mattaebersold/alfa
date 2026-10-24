import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Keyboard, Platform, PanResponder, Animated,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { FormScrollView, KeyboardStickyView, KEYBOARD_GAP } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, ChevronDown, ChevronUp, Check, Play, Video, Send, MessageSquare, BarChart3, Tag, Plus, MapPin } from 'lucide-react-native';
import { useGetUserGroupsQuery, apiService } from '../../api/apiService';
import { useAppSelector, store } from '../../store/store';
import { startPostUpload, takePostUploadDraft, type PostUploadJob } from '../../utils/postUpload';
import ActionSheet from '../../components/ui/ActionSheet';
import MentionInput from '../../components/ui/MentionInput';
import PhotoPickerField from '../../components/ui/PhotoPickerField';
import CameraSheet, { type CameraCapture } from '../../components/media/CameraSheet';
import PostTagPicker, { type TagItem as PickerTagItem, type TagKind as PickerTagKind } from '../../components/social/PostTagPicker';
import PostOptionalFields, { EMPTY_OPTIONAL_FIELDS, type OptionalFieldValues } from '../../components/social/PostOptionalFields';
import SubTabs from '../../components/ui/SubTabs';
import MainTabs from '../../components/ui/MainTabs';
import StickyFormFooter from '../../components/ui/StickyFormFooter';
import PostToSelector from '../../components/social/PostToSelector';
import PostLocationField from '../../components/social/PostLocationField';
import PollEditor, { emptyPollDraft, pollDraftToInput, type PollDraft } from '../../components/social/PollEditor';
import { ListingCreateSheet } from '../marketplace/ListingCreateScreen';
import { colors } from '../../constants/colors';
import { CREATABLE_POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';
import { uploadFile, toUploadableJpeg } from '../../utils/upload';
import { blockProfanity } from '../../utils/profanity';
import { uploadVideoToMux, compressVideo } from '../../utils/muxUpload';
import { useColors } from '../../hooks/useColors';
import { contrastText, useBrandColor } from '../../hooks/useBrandColor';
import type { AppStackParamList } from '../../navigation/types';
import type { PostPlace } from '../../types/api';
import { ss } from '../../styles/shared';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_GRAY_42, COLOR_WHITE, INPUT_LINE_HEIGHT, INPUT_TEXT, COLOR_BLACK, COLOR_GRAY_14, FORM_RADIUS } from '../../constants/config';
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
  /**
   * `uri` is the picked file, shown at once; `uploadUri` is the shrunk JPEG
   * made from it in the background, and what goes up. Until it exists the
   * tile marks itself `pending`, and posting waits for it.
   */
  | { key: string; kind: 'image'; uri: string; uploadUri?: string; pending?: boolean; name: string; type: string }
  | { key: string; kind: 'video'; uri: string; poster: string | null };

/**
 * The form as it stood when Post was tapped — kept with the upload, so a post
 * that fails can be put back in the form to fix (see utils/postUpload).
 */
type CreateDraft = {
  kind: CreateKind;
  postType: PostType;
  category: string;
  title: string;
  body: string;
  mentionedUserIds: string[];
  media: DraftMedia[];
  optional: OptionalFieldValues;
  selectedGroupIds: string[];
  isPublic: boolean;
  poll: PollDraft;
  taggedUsers: TagItem[];
  taggedCars: TagItem[];
  taggedEvents: TagItem[];
  place: PostPlace | null;
  /** Videos already on Mux — see `sentVideos`. */
  sentVideos: Map<string, string>;
};

let _mediaSeq = 0;
const nextMediaKey = () => `m${++_mediaSeq}_${Date.now()}`;

/** How much media one post can carry. */
const MAX_MEDIA = 10;

/** The tabs under the header — what the thing being made is. */
type CreateKind = 'post' | 'poll' | 'listing';
const CREATE_KINDS: { key: CreateKind; label: string; Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }[] = [
  { key: 'post',    label: 'Post',    Icon: MessageSquare },
  { key: 'poll',    label: 'Poll',    Icon: BarChart3 },
  { key: 'listing', label: 'Listing', Icon: Tag },
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
      {item.kind === 'image' && item.pending && (
        <View style={styles.thumbBusy}><ActivityIndicator size="small" color={COLOR_WHITE} /></View>
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

  /**
   * A failed post put back in the form — the upload bar's "Edit post". Taken
   * once, on the first render: taking it drops the failed upload, since this
   * form's Post will start a new one.
   */
  const restoredRef = useRef<CreateDraft | null | undefined>(undefined);
  if (restoredRef.current === undefined) {
    restoredRef.current = route.params?.draftId ? takePostUploadDraft<CreateDraft>(route.params.draftId) : null;
  }
  const restored = restoredRef.current;

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
  const [kind, setKind] = useState<CreateKind>(restored?.kind ?? 'post');
  /** The listing flow's Back / progress / Next row, pinned under the tabs. */
  const [listingNav, setListingNav] = useState<React.ReactNode>(null);

  // Core
  const [postType, setPostType]   = useState<PostType>(restored?.postType ?? 'general');
  // The first of the type's categories, chosen up front — see handleTypeChange.
  const [category, setCategory]   = useState(() => restored?.category ?? POST_CATEGORIES.general[0]?.key ?? '');
  const [title, setTitle]         = useState(restored?.title ?? '');
  const [body, setBody]           = useState(restored?.body ?? '');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>(restored?.mentionedUserIds ?? []);
  // A restored photo still marked pending was shrunk by the job, or never will
  // be now: either way it goes up as it is.
  const [media, setMedia]         = useState<DraftMedia[]>(
    () => restored?.media.map((m) => (m.kind === 'image' ? { ...m, pending: false } : m)) ?? [],
  );
  /**
   * Videos already on Mux, by file. A post that fails after its first video
   * made it — the second one, or the create itself — is tried again with the
   * same Post tap, and re-sending a video that already arrived is minutes of
   * someone's data for nothing.
   */
  const sentVideos = useRef(restored?.sentVideos ?? new Map<string, string>());

  // Optional fields, in one bag — the shared block owns their shape.
  const [optional, setOptional] = useState<OptionalFieldValues>(restored?.optional ?? EMPTY_OPTIONAL_FIELDS);
  const { year, make, model, trim, price, mileage, condition, vin, partNumber } = optional;

  // Groups. Opened from a group's own page, that group starts ticked — and
  // only that one; the rest are the author's to add.
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(
    restored?.selectedGroupIds ?? (route.params?.groupId ? [route.params.groupId] : []),
  );
  const [isPublic, setIsPublic]                 = useState(restored?.isPublic ?? true);

  // Poll — off until the author switches it on; the editor owns the shape.
  const [poll, setPoll] = useState<PollDraft>(restored?.poll ?? emptyPollDraft);

  // Tags (people, cars, events) — the search/autocomplete lives in PostTagPicker
  const [taggedUsers, setTaggedUsers]   = useState<TagItem[]>(restored?.taggedUsers ?? []);
  const [taggedCars, setTaggedCars]     = useState<TagItem[]>(restored?.taggedCars ?? prefilledCar);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>(restored?.taggedEvents ?? []);

  /**
   * Where it was made — "Add a Location", at the foot of the form. A Google
   * place rather than a tag: it stands on its own, where photo spots were a
   * kind of tag, and it rides on the create itself rather than the tag sync.
   */
  const [place, setPlace] = useState<PostPlace | null>(restored?.place ?? null);

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

  /**
   * Work that's still running on picked media: each photo's shrink to an
   * uploadable JPEG, each video's compression. Started the moment something
   * is picked, so by the time Post is tapped it's usually done; Post waits on
   * whatever isn't. Keyed by the draft, so a tile that's removed is simply
   * never read.
   */
  const shrinking = useRef(new Map<string, Promise<string>>());
  const compressing = useRef(new Map<string, Promise<string>>());
  const mediaRef = useRef<DraftMedia[]>([]);
  mediaRef.current = media;

  const patchMedia = useCallback((key: string, patch: Partial<DraftMedia>) => {
    setMedia((prev) => prev.map((m) => (m.key === key ? { ...m, ...patch } as DraftMedia : m)));
  }, []);

  /**
   * Picked media as drafts — at once, from the picked files, so the tiles
   * appear as the picker closes. The slow parts follow in the background:
   * each photo is shrunk to the upload size and swapped in as `uploadUri`,
   * each video gets its poster frame and starts compressing for Mux.
   */
  const toDraft = useCallback(async (
    assets: ImagePicker.ImagePickerAsset[],
  ): Promise<DraftMedia[]> => {
    const drafts: DraftMedia[] = assets.map((a) => {
      const key = nextMediaKey();
      if (a.type === 'video') return { key, kind: 'video', uri: a.uri, poster: null };
      const name = (a.fileName ?? `photo_${Date.now()}.jpg`).replace(/\.(heic|heif|png)$/i, '.jpg');
      return { key, kind: 'image', uri: a.uri, pending: true, name, type: 'image/jpeg' };
    });

    assets.forEach((a, i) => {
      const d = drafts[i];
      if (d.kind === 'image') {
        const job = toUploadableJpeg(a.uri, { width: a.width, height: a.height })
          // Resolves to what goes up, for a post sent before the tile caught up.
          .then((uploadUri) => { patchMedia(d.key, { uploadUri, pending: false }); return uploadUri; })
          .catch(() => { patchMedia(d.key, { uploadUri: a.uri, pending: false }); return a.uri; })
          .finally(() => { shrinking.current.delete(d.key); });
        shrinking.current.set(d.key, job);
      } else {
        void posterFor(a.uri).then((poster) => { if (poster) patchMedia(d.key, { poster }); });
        // Compression is the long part of posting a video; begun now, it's
        // done by the time Post is tapped more often than not.
        compressing.current.set(d.uri, compressVideo(a.uri, () => {}).catch(() => a.uri));
      }
    });
    return drafts;
  }, [posterFor, patchMedia]);

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

  /**
   * Add Media opens the app's own camera (CameraSheet): take a photo, record
   * a clip, or step out to the library from there. Always the camera — the
   * old "is there a camera" guess read a real iPhone as the Simulator and sent
   * it to the library; with the app's own camera there's nothing to crash,
   * and the Simulator's black preview still has the library button on it.
   */
  const [cameraOpen, setCameraOpen] = useState(false);
  const pickImage = useCallback(() => {
    Keyboard.dismiss();
    if (media.length >= MAX_MEDIA) {
      Alert.alert('Media limit reached', `A post can carry up to ${MAX_MEDIA} photos and videos.`);
      return;
    }
    setCameraOpen(true);
  }, [media.length]);

  /** A shot from the sheet, as a draft — the same path a picked file takes. */
  const onCaptured = useCallback(async (c: CameraCapture) => {
    const asset = (c.kind === 'image'
      ? { uri: c.uri, width: c.width ?? 0, height: c.height ?? 0, type: 'image', fileName: `photo_${Date.now()}.jpg` }
      : { uri: c.uri, width: 0, height: 0, type: 'video', fileName: `video_${Date.now()}.mp4` }) as ImagePicker.ImagePickerAsset;
    appendMedia(await toDraft([asset]));
    if (mediaRef.current.length + 1 >= MAX_MEDIA) setCameraOpen(false);
  }, [appendMedia, toDraft]);

  const removeMedia = useCallback((key: string) => {
    shrinking.current.delete(key);
    setMedia((prev) => prev.filter((m) => m.key !== key));
  }, []);


  // ── Tag helpers ─────────────────────────────────────────────────────────────

  const toggleTag = useCallback((tag: TagItem) => {
    // Posts don't offer group or spot tagging, so the picker never emits
    // either here — where a post was made is its location, below.
    if (tag.kind === 'group' || tag.kind === 'spot') return;
    const setter = tag.kind === 'user' ? setTaggedUsers
      : tag.kind === 'car' ? setTaggedCars
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
    // Before any photo or video goes up: the server would refuse the post
    // after the upload, and the member would have waited for nothing.
    if (blockProfanity({
      title,
      description: body,
      poll: kind === 'poll' ? [poll.question, ...poll.options.map((o) => o.label)] : null,
    })) return;
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

    // Everything left — the videos, the post, the photos, the tags — goes on
    // after the form closes, under the bar at the top of the home feed (see
    // utils/postUpload). Captured here, as it stands at the tap: the job
    // outlives this screen.
    const current = mediaRef.current;
    // Photos still shrinking: the job waits on each as it gets to it.
    const shrinks = new Map(shrinking.current);
    const compressions = new Map(compressing.current);
    const sent = sentVideos.current;
    const tags = {
      tagged_users: taggedUsers.map((t) => t.id),
      tagged_cars: taggedCars.map((t) => t.id),
      tagged_events: taggedEvents.map((t) => t.id),
    };
    const formDraft: CreateDraft = {
      kind, postType, category, title, body, mentionedUserIds, media: current, optional,
      selectedGroupIds, isPublic, poll, taggedUsers, taggedCars, taggedEvents, place, sentVideos: sent,
    };

    const buildFormData = () => {
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

      // The place, the same way: one JSON field. A post's only — the Poll tab
      // doesn't offer one, and a place picked on the Post tab stays there.
      if (kind === 'post' && place) fd.append('place', JSON.stringify(place));
      return fd;
    };

    // Videos go straight to Mux (never through our API). Each one is sent with
    // the position it occupies in the post's media, because Mux takes minutes to
    // encode and the server has to hold the slot in the meantime — without the
    // index a video would land wherever it happened to finish.
    const videoItems = current
      .map((m, index) => ({ m, index }))
      .filter((x): x is { m: Extract<DraftMedia, { kind: 'video' }>; index: number } =>
        x.m.kind === 'video');
    // Photos go one at a time after the post exists, so we never send one
    // giant multipart request. Each carries its position in the media list —
    // the server can't infer it, since a video may already hold a slot.
    const photoItems = current
      .map((m, index) => ({ m, index }))
      .filter((x): x is { m: Extract<DraftMedia, { kind: 'image' }>; index: number } =>
        x.m.kind === 'image');

    // What the bar counts through: each video twice (prepared, then sent),
    // the post itself, then each photo.
    const steps = videoItems.length * 2 + 1 + photoItems.length;
    /** Set once the post exists — a retry after that doesn't make a second one. */
    let postId: string | null = null;

    const job: PostUploadJob = async (report) => {
      const at = (done: number, label: string, fraction = 0) =>
        report({ progress: (done + fraction) / steps, label });
      try {
        if (!postId) {
          const fd = buildFormData();
          const uploads: { upload_id: string; index: number }[] = [];
          for (const [n, { m, index }] of videoItems.entries()) {
            const which = videoItems.length > 1 ? ` ${n + 1} of ${videoItems.length}` : '';
            // Already on Mux from a try that failed later: not sent twice.
            let id = sent.get(m.uri);
            if (!id) {
              at(n * 2, `Preparing video${which}…`);
              // Begun when it was picked (see toDraft); usually done by now.
              const file = await (compressions.get(m.uri) ?? compressVideo(
                m.uri,
                (f) => at(n * 2, `Preparing video${which}…`, f),
              ));
              at(n * 2 + 1, `Uploading video${which}…`);
              id = await uploadVideoToMux(
                file,
                () => store.dispatch(apiService.endpoints.createMuxUploadUrl.initiate(undefined)).unwrap(),
                (f) => at(n * 2 + 1, `Uploading video${which}…`, f),
              );
              sent.set(m.uri, id);
            }
            uploads.push({ upload_id: id, index });
          }
          if (uploads.length > 0) fd.append('mux_uploads', JSON.stringify(uploads));

          at(videoItems.length * 2, 'Posting…');
          const result = await store.dispatch(apiService.endpoints.createPostDeferred.initiate(fd)).unwrap();
          postId =
            (result as any)?._id ??
            (result as any)?.entry?.internal_id ??
            (result as any)?.internal_id ??
            null;
        }

        if (postId) {
          const base = videoItems.length * 2 + 1;
          for (const [n, { m, index }] of photoItems.entries()) {
            at(base + n, `Uploading photo ${n + 1} of ${photoItems.length}…`);
            const uploadUri = m.uploadUri ?? (await shrinks.get(m.key)) ?? m.uri;
            const ifd = new FormData();
            ifd.append('internal_id', postId);
            ifd.append('index', String(index));
            ifd.append('gallery', uploadFile(uploadUri));
            try {
              await store.dispatch(apiService.endpoints.addPostImage.initiate(ifd)).unwrap();
            } catch { /* keep going; partial upload */ }
          }

          if (tags.tagged_users.length > 0 || tags.tagged_cars.length > 0 || tags.tagged_events.length > 0) {
            try {
              await store.dispatch(apiService.endpoints.syncPostTags.initiate({ post_id: postId, ...tags })).unwrap();
            } catch (e) {
              console.warn('[CreatePost] tag sync failed:', JSON.stringify(e));
            }
          }
        }

        store.dispatch(apiService.util.invalidateTags(['Post', 'UserEntries']));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.error('[CreatePost] failed:', JSON.stringify(err, null, 2));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        throw err;
      }
    };

    const lead = current[0];
    startPostUpload({
      job,
      draft: formDraft,
      thumb: !lead ? null : lead.kind === 'image' ? (lead.uploadUri ?? lead.uri) : lead.poster,
    });
    appNav.goBack();
  }, [
    kind, postType, category, title, body, mentionedUserIds, optional, selectedGroupIds, isPublic, poll,
    taggedUsers, taggedCars, taggedEvents, media, place, appNav,
  ]);

  /**
   * Drag down from the top to close. Claims the touch only once it's clearly
   * a downward pull, so a tap on the grabber (which also closes) and the
   * tabs under it keep theirs; lets go with a flick or past a hand's width.
   */
  const dismissPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 80 || g.vy > 0.6) appNav.goBack();
    },
  })).current;

  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }];

  // The Done footer is only there while the keyboard is — see below.
  const keyboardUp = useKeyboardState((st) => st.isVisible);

  return (
    // One ground from top to bottom: the card colour the type row and photos
    // sit on, so the sections below don't read as a second surface.
    // No bottom edge: the form runs to the foot of the screen, under the home
    // indicator, and its own end padding (below) is what clears it.
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.card }]} edges={[]}>
      {/* iOS presents this as a page sheet, already clear of the status bar:
          a top inset there only pushed the grabber down a notch's height.
          Android's modal is full screen, so it still needs one. */}
      <SafeAreaView edges={Platform.OS === 'ios' ? [] : ['top']} style={{ backgroundColor: colors.card }}>
        {/* A sheet's grabber in place of the X: tap it or drag it down to
            close, as every other sheet in the app closes. The drag is read
            here for Android; iOS's modal has the gesture natively. */}
        {/* The drag takes the tabs as well as the grabber: a pull down
            anywhere across the top starts it, where the grabber's own strip
            was a thin target. A tap on a tab is still a tap — the pan only
            claims a move that's clearly downward. */}
        <View {...dismissPan.panHandlers}>
          <TouchableOpacity
            onPress={() => appNav.goBack()}
            style={styles.grabberHit}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <View style={styles.grabber} />
          </TouchableOpacity>
          {/* What this becomes — main tabs, the home screen's. The listing tab
              opens the marketplace's own form over this one, with the photos;
              closing it lands back here. */}
          <MainTabs
            tabs={CREATE_KINDS}
            value={kind}
            onChange={setKind}
            inset={12}
            stretch
            contentContainerStyle={styles.kindRow}
          />
        </View>
        {/* The listing's step row stays put while its steps scroll. */}
        {kind === 'listing' && listingNav ? <View style={styles.pinnedNav}>{listingNav}</View> : null}
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
        {kind === 'listing' ? (
          /* The marketplace's own flow, in the pane under its tab, with the
             photos taken so far. It keeps its steps, its allowance check and
             its own Post; done, this pane closes. */
          <ListingCreateSheet
            inline
            initialKind="sale"
            initialGroupId={route.params?.groupId}
            initialImages={media.filter((m): m is Extract<DraftMedia, { kind: 'image' }> => m.kind === 'image')
              .map((m) => ({ uri: m.uploadUri ?? m.uri, name: m.name, type: m.type }))}
            onDismissed={() => appNav.goBack()}
            onNav={setListingNav}
          />
        ) : (<>
        {/* Type, then the type's categories — one choice in two steps, so
            the same control twice and no labels: the options say what they
            are. First on the form, ahead of the photos. */}
        {kind === 'post' && (
          <View style={styles.typeBlock}>
            <SubTabs
              options={CREATABLE_POST_TYPES.map(({ type, label }) => ({ key: type, label }))}
              value={postType}
              onChange={handleTypeChange}
            />
            {currentCategories.length > 0 && (
              <SubTabs
                options={currentCategories.map(({ key, label }) => ({ key, label }))}
                value={category}
                onChange={setCategory}
              />
            )}
          </View>
        )}

        {/* Photos / video */}
        <View style={[styles.photosSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {media.length === 0 ? (
            <PhotoPickerField
              onPress={pickImage}
              title="Add Media"
              hint=""
              muted
              style={styles.photoField}
            />
          ) : (
            /* With something picked, the well gives way to the row: the
               previews, then an "add" tile the same size and shape at its
               end, so adding more is one more thing in the same line. */
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbRow}
              contentContainerStyle={styles.thumbRowInner}
              keyboardShouldPersistTaps="handled"
            >
              {media.map((item) => (
                <MediaThumb key={item.key} item={item} onRemove={() => removeMedia(item.key)} />
              ))}
              <TouchableOpacity
                style={[styles.thumb, styles.addTile, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                onPress={pickImage}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add media"
              >
                <Plus size={20} color={colors.grey} strokeWidth={2.4} />
                <Text style={[styles.addTileText, { color: colors.grey }]}>Add Media</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {kind === 'post' && (<>
        {/* Title */}
        <View style={[styles.inputBlock, { backgroundColor: colors.card }]}>
          <TextInput
            style={[ss.formInput, { backgroundColor: colors.inputBg, color: colors.fg }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
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
            style={[ss.formInput, ss.formInputMulti, { backgroundColor: colors.inputBg, color: colors.fg }]}
            value={body}
            onChangeText={(text, ids) => { setBody(text); setMentionedUserIds(ids); }}
            placeholder="Description"
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
            onToggle={toggleTag}
          />
        </View>

        {/* ── Post to ── */}
        {/* Framed and headed like the tag cards and Optional Details above it. */}
        <View style={[styles.postToCard, { backgroundColor: COLOR_GRAY_14 }]}>
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

        {/* ── Add a location ──
            Last of the cards, after Post To: where it was made is an extra,
            and the tag cards' old "Tag Photo Spots" is gone in its favour.
            A post's — the poll tab has none. */}
        {kind === 'post' && (
          <View style={[styles.postToCard, { backgroundColor: COLOR_GRAY_14 }]}>
            <View style={styles.postToHead}>
              <MapPin size={15} color={COLOR_WHITE} />
              <Text style={[styles.postToTitle, { color: colors.fg }]}>Add a Location</Text>
            </View>
            <PostLocationField value={place} onChange={setPlace} />
          </View>
        )}

        {/* ── Post button ──
            Ends the form, full width, rather than floating over it: posting is
            the last thing you do here, after the fields above it, and pinned
            over the scroll it sat on top of whatever was being filled in. */}
        <TouchableOpacity
          // The brand colour — Pro gold or blue — with black on it, like every
          // other brand-filled button.
          // Never busy: the form closes on the tap, and the upload's progress
          // is the bar at the top of the home feed (utils/postUpload).
          style={[styles.submitBtn, { backgroundColor: brand }]}
          onPress={handleSubmit}
          accessibilityRole="button"
          accessibilityLabel={kind === 'poll' ? 'Create poll' : 'Create post'}
        >
          <Text style={styles.submitText}>{kind === 'poll' ? 'Create poll' : 'Post'}</Text>
        </TouchableOpacity>
        </>)}
      </FormScrollView>



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

      <CameraSheet
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={onCaptured}
        // The sheet goes first, then the library over the form — one modal
        // over another is what iOS refuses.
        onPickLibrary={() => { setCameraOpen(false); setTimeout(() => { void addFromLibrary(); }, 400); }}
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

  // The sheet's grabber (SharedModal's measures), then the title under it.
  // The grabber alone leads the sheet; the tabs under it say what this is.
  grabberHit:  { alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  grabber:     { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  // Under the header: the app header's tab row, three across, each taking
  // a third — its type, its gold, its underline.
  kindRow:       { paddingBottom: 10 },
  pollBlock: { paddingTop: 4 },
  // Under the tabs, on the header's ground, with a rule to the scroller.
  pinnedNav: { paddingBottom: 10 },
  // Tight to the header above — the header's own padding is the gap.
  // Small captions over the type and category, the group form's.
  // No top padding: the tab row's own 10 below it is the gap.
  typeBlock:    { gap: 8 },

  inputBlock:   { paddingHorizontal: 12, paddingTop: 12 },

  photosSection:{ borderBottomWidth: 1, paddingBottom: 2 },
  // The width of the form, like the fields under it — the well's own default
  // is a narrower box centred on the page.
  photoField:   { alignSelf: 'stretch', maxWidth: '100%', marginHorizontal: 14, marginTop: 12, marginBottom: 0 },
  thumbRow:     { paddingHorizontal: 14 },
  thumbRowInner:{ paddingVertical: 12 },
  // The add tile: the preview's size and shape, outlined, the word under a plus.
  addTile:      { borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  addTileText:  { fontSize: 10, fontFamily: FONT_INTER.bold, textAlign: 'center' },
  thumbWrap:    { marginRight: 8, position: 'relative' },
  thumb:        { width: 72, height: 72, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: COLOR_GRAY_42 },
  // Over a photo still being shrunk for upload.
  thumbBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8 },
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
  // None of its own: the first tag card's marginTop is the gap.
  tagSection:    { marginTop: 0 },
  sectionLabel:  { fontSize: 14, fontFamily: FONT_INTER.bold },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  fieldLabel:    { fontSize: 13, fontFamily: FONT_INTER.semibold, width: 90 },
  fieldValue:    { flex: 1 },
  input:         { flex: 1, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderRadius: 8 },

  // Optional Details' block: a ground a step darker than the form, no edge.
  postToCard: {
    marginHorizontal: 12, marginTop: 12,
    padding: POST_TO_PAD, borderRadius: FORM_RADIUS,
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
  submitText:      { color: COLOR_BLACK, fontSize: 17, fontFamily: FONT_INTER.extrabold },
});
