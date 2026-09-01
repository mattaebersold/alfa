import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, ChevronDown, ChevronUp, Check, Play, Camera, Images, Video } from 'lucide-react-native';
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
import { colors } from '../../constants/colors';
import { POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { useColors } from '../../hooks/useColors';
import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

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
        <View style={styles.videoPlayBadge}><Play size={14} color="#FFFFFF" fill="#FFFFFF" /></View>
      )}
      <TouchableOpacity style={styles.thumbRemove} onPress={onRemove} hitSlop={6}>
        <X size={11} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const appNav = useNavigation<AppNav>();
  const route = useRoute<RouteProp<AppStackParamList, 'Create'>>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  // Opened from a car ("New post" on your own car's card), the post starts with
  // that car already tagged — the tag is the whole reason you started there.
  const prefilledCar: TagItem[] = route.params?.carId
    ? [{ id: route.params.carId, label: route.params.carTitle || 'Car', kind: 'car' }]
    : [];

  // Core
  const [postType, setPostType]   = useState<PostType>('general');
  const [category, setCategory]   = useState('');
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [media, setMedia]         = useState<DraftMedia[]>([]);
  const [videoUploading, setVideoUploading] = useState(false);
  // Photos upload one-at-a-time after the post is created — this is the progress.
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number } | null>(null);

  // Optional fields, in one bag — the shared block owns their shape.
  const [optional, setOptional] = useState<OptionalFieldValues>(EMPTY_OPTIONAL_FIELDS);
  const { year, make, model, trim, price, mileage, condition, vin, partNumber } = optional;

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isPublic, setIsPublic]                 = useState(true);

  // Tags (people, cars, events) — the search/autocomplete lives in PostTagPicker
  const [taggedUsers, setTaggedUsers]   = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars]     = useState<TagItem[]>(prefilledCar);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);

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

  const showPrice    = postType === 'listing' || postType === 'want';
  // Mileage is offered on every kind of post, not just listings and records:
  // a spot, a show photo or a general update is as likely to be worth stamping
  // with the number on the clock.
  const showMileage  = true;

  const handleTypeChange = (t: PostType) => { setPostType(t); setCategory(''); };

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
    });
    if (result.canceled) return;
    appendMedia(await toDraft(result.assets));
  }, [mediaRoom, appendMedia, toDraft]);

  const addFromCamera = useCallback(async () => {
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

  // ── Tag helpers ─────────────────────────────────────────────────────────────

  const toggleTag = useCallback((tag: TagItem) => {
    // Posts don't offer group tagging, so the picker never emits one here.
    if (tag.kind === 'group') return;
    const setter = tag.kind === 'user' ? setTaggedUsers : tag.kind === 'car' ? setTaggedCars : setTaggedEvents;
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
    if (!title.trim() && !body.trim() && media.length === 0) {
      Alert.alert('Content required', 'Please add a title, body, photo, or video.');
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
        for (const { m, index } of videoItems) {
          const { id, url } = await createMuxUploadUrl().unwrap();
          const res = await FileSystem.uploadAsync(url, m.uri, {
            httpMethod: 'PUT',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: { 'Content-Type': 'video/mp4' },
          });
          if (res.status < 200 || res.status >= 300) throw new Error(`Mux upload failed (${res.status})`);
          uploads.push({ upload_id: id, index });
        }
        fd.append('mux_uploads', JSON.stringify(uploads));
      } catch (e) {
        setVideoUploading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Video upload failed', 'Could not upload the video. Please try again.');
        return;
      }
      setVideoUploading(false);
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

      const hasAnyTags = taggedUsers.length > 0 || taggedCars.length > 0 || taggedEvents.length > 0;
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
    postType, category, title, body, mentionedUserIds, optional, selectedGroupIds, isPublic,
    taggedUsers, taggedCars, taggedEvents, media,
    createPost, createMuxUploadUrl, addPostImage, dispatch, syncTags, appNav,
  ]);

  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }];

  /**
   * Clearance for the software keyboard.
   *
   * Nothing in this screen moved when the keyboard opened, so writing a
   * description left the body field and the media picker pinned to the top of
   * the keyboard with no room to work in — and the only way to put the keyboard
   * away was to guess that dragging the form would do it.
   *
   * The scroll gets the keyboard's height added to its tail so everything below
   * the caret can still be scrolled into view, and the footer rises to sit just
   * above the keys. `insets.bottom` comes off that: the footer is positioned
   * inside a bottom-inset SafeAreaView, so it already starts above the home
   * indicator, while the keyboard's height is measured from the screen edge and
   * counts that strip. Adding both would float it a home indicator too high.
   */
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const keyboardUp = keyboardHeight > 0;
  const footerInset = keyboardUp
    ? Math.max(0, keyboardHeight - insets.bottom) + 10
    : Platform.OS === 'android' ? 40 : 20;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 140 + keyboardHeight }}
      >
        {/* Type selector */}
        <View style={[styles.typeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          {POST_TYPES.map(({ type, label, color }) => {
            const active = postType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, {
                  borderColor: active ? color : colors.inputBorder,
                  backgroundColor: active ? color : colors.inputBg,
                }]}
                onPress={() => handleTypeChange(type)}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeLabel, { color: active ? '#FFFFFF' : colors.fg }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category chips */}
        {currentCategories.length > 0 && (
          <View style={[styles.catRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            {currentCategories.map(({ key, label }) => {
              const active = category === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.catChip, {
                    borderColor: active ? colors.primaryAlt : colors.inputBorder,
                    backgroundColor: active ? colors.primaryAlt : colors.inputBg,
                  }]}
                  onPress={() => setCategory(active ? '' : key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.catLabel, { color: active ? '#FFFFFF' : colors.fg }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Title */}
        <View style={[styles.inputBlock, { backgroundColor: colors.card }]}>
          <TextInput
            style={[styles.titleInput, { backgroundColor: colors.inputBg, color: colors.fg, borderColor: colors.inputBorder }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Title..."
            placeholderTextColor={colors.grey}
            returnKeyType="next"
          />
        </View>

        {/* Body */}
        <View style={[styles.inputBlock, { backgroundColor: colors.card, paddingBottom: 12 }]}>
          <MentionInput
            style={[styles.bodyInput, { backgroundColor: colors.inputBg, color: colors.fg, borderColor: colors.inputBorder }]}
            value={body}
            onChangeText={(text, ids) => { setBody(text); setMentionedUserIds(ids); }}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.grey}
            multiline
          />
        </View>

        {/* Photos / video */}
        <View style={[styles.photosSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <PhotoPickerField
            onPress={pickImage}
            title={media.length ? 'Add More Media' : 'Add Photos or Video'}
            hint="Photos and video together, in the order you add them"
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

        {/* ── Optional fields ── */}
        <PostOptionalFields
          values={optional}
          onChange={(patch) => setOptional((prev) => ({ ...prev, ...patch }))}
          showPrice={showPrice}
        />

        {/* ── Tag people, cars & events — always visible (no accordion) ── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.fg }]}>Tag People, Cars & Events</Text>
          </View>
          <PostTagPicker
            users={taggedUsers}
            cars={taggedCars}
            events={taggedEvents}
            onToggle={toggleTag}
          />
        </View>

        {/* ── Post to ── */}
        <View style={[styles.postToCard, { backgroundColor: colors.card, borderColor: colors.borderDark }]}>
          <Text style={[styles.sectionLabel, { color: colors.fg, marginBottom: 12 }]}>Post To</Text>
          <PostToSelector
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
      </ScrollView>

      {/* ── Fixed Post button ── */}
      <StickyFormFooter color={colors.cream} bottomInset={footerInset}>
        <View style={styles.footerRow}>
        {/* The body field is multiline, so its return key inserts a newline and
            can't double as a dismiss. Without this the only way out of the
            keyboard is to know that dragging the form closes it. */}
        {keyboardUp && (
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
            onPress={() => Keyboard.dismiss()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss keyboard"
          >
            <Text style={[styles.doneText, { color: colors.fg }]}>Done</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, (submitting || videoUploading || imageProgress !== null) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || videoUploading || imageProgress !== null}
        >
          {submitting || videoUploading || imageProgress !== null ? (
            <>
              <ActivityIndicator color="#FFFFFF" size="small" />
              {videoUploading ? (
                <Text style={[styles.submitText, { marginLeft: 8 }]}>Uploading video…</Text>
              ) : imageProgress ? (
                <Text style={[styles.submitText, { marginLeft: 8 }]}>Uploading {imageProgress.current} of {imageProgress.total}…</Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.submitText}>Post</Text>
          )}
        </TouchableOpacity>
        </View>
      </StickyFormFooter>

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

const styles = StyleSheet.create({
  scroll:       { flex: 1 },

  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderBottomWidth: 1 },
  typeBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  typeLabel:    { fontSize: 12, fontWeight: '700' },

  catRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  catChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  catLabel:     { fontSize: 12, fontWeight: '600' },

  inputBlock:   { paddingHorizontal: 12, paddingTop: 12 },
  titleInput:   { paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, fontWeight: '700', borderWidth: 1, borderRadius: 10 },
  bodyInput:    { paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 110, lineHeight: 22, borderWidth: 1, borderRadius: 10, textAlignVertical: 'top' as const },

  photosSection:{ borderBottomWidth: 1, paddingBottom: 10 },
  photoField:   { marginHorizontal: 14, marginTop: 12, marginBottom: 4 },
  thumbRow:     { paddingHorizontal: 14 },
  thumbWrap:    { marginRight: 8, position: 'relative' },
  thumb:        { width: 72, height: 72, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#2A2A2A' },
  videoPlayBadge: {
    position: 'absolute', top: '50%', left: '50%', marginTop: -16, marginLeft: -16,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbRemove:  {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  sectionLabel:  { fontSize: 14, fontWeight: '700' },
  fieldRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  fieldLabel:    { fontSize: 13, fontWeight: '600', width: 90 },
  fieldValue:    { flex: 1 },
  input:         { flex: 1, fontSize: 14, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderRadius: 8 },

  postToCard: {
    marginHorizontal: 12, marginTop: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  postToEmpty: { paddingTop: 12, fontSize: 13 },

  // Tags
  selectedTags:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingTop: 10 },
  tagChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagChipText:     { fontSize: 12, fontWeight: '600', maxWidth: 120 },
  tagSearchRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tagSearchInput:  { flex: 1, fontSize: 14 },
  tagGroupHeader:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tagGroupLabel:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  tagResultRow:    { paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  tagResultChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tagResultText:   { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  tagEmpty:        { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },

  // Checkbox
  checkbox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  // Sized to its word rather than to the screen — a full-bleed bar over the
  // gradient read as a wall across the form.
  footerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  doneBtn:         {
    paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: 999, borderWidth: 1,
  },
  doneText:        { fontSize: 15, fontWeight: '700' },
  submitBtn:       {
    minWidth: 180,
    backgroundColor: colors.primaryAlt, borderRadius: 999,
    paddingVertical: 11, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
