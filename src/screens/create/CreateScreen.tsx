import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Alert, ActivityIndicator, Keyboard, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, ChevronDown, ChevronUp, Check, Play, Camera, Images, Video, Film } from 'lucide-react-native';
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

function VideoPreview({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  const player = useVideoPlayer(uri, (p) => { p.muted = true; });
  return (
    <View style={styles.videoPreviewWrap}>
      <VideoView player={player} style={styles.videoPreview} contentFit="cover" nativeControls={false} />
      <View style={styles.videoPlayBadge}><Play size={18} color="#FFFFFF" fill="#FFFFFF" /></View>
      <TouchableOpacity style={styles.thumbRemove} onPress={onRemove}>
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
  const [images, setImages]       = useState<{ uri: string; name: string; type: string }[]>([]);
  // A post is either photos or a single video, never both.
  const [video, setVideo]         = useState<{ uri: string } | null>(null);
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

  const addFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const picked = await normalizePickedAssets(result.assets);
      setVideo(null); // photos and video are mutually exclusive
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

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
    if (!result.canceled && result.assets[0]) {
      const picked = await normalizePickedAssets(result.assets);
      setVideo(null);
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

  const addVideoFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 120,
    });
    if (!result.canceled && result.assets[0]) {
      setImages([]); // video replaces photos
      setVideo({ uri: result.assets[0].uri });
    }
  }, []);

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
    if (!result.canceled && result.assets[0]) {
      setImages([]);
      setVideo({ uri: result.assets[0].uri });
    }
  }, []);

  // A sheet rather than Alert.alert: Android's platform dialog takes three
  // buttons and drops the rest, so two of these four options and the Cancel
  // never made it to the screen — and what was left couldn't be dismissed by
  // tapping outside or by the back button.
  const [mediaSheet, setMediaSheet] = useState(false);
  const pickImage = useCallback(() => {
    Keyboard.dismiss();
    setMediaSheet(true);
  }, []);

  const removeImage = useCallback((idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
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
    if (!title.trim() && !body.trim() && images.length === 0 && !video) {
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

    // Video goes straight to Mux (never through our API); attach its upload id.
    if (video) {
      setVideoUploading(true);
      try {
        const { id, url } = await createMuxUploadUrl().unwrap();
        const res = await FileSystem.uploadAsync(url, video.uri, {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': 'video/mp4' },
        });
        if (res.status < 200 || res.status >= 300) throw new Error(`Mux upload failed (${res.status})`);
        fd.append('mux_upload_id', id);
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

      // Upload photos sequentially, then refresh the feed so they appear.
      if (!video && images.length > 0 && postId) {
        setImageProgress({ current: 0, total: images.length });
        let done = 0;
        for (const img of images) {
          const ifd = new FormData();
          ifd.append('internal_id', postId);
          ifd.append('gallery', uploadFile(img.uri));
          try { await addPostImage(ifd).unwrap(); } catch { /* keep going; partial upload */ }
          done += 1;
          setImageProgress({ current: done, total: images.length });
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
    taggedUsers, taggedCars, taggedEvents, images, video,
    createPost, createMuxUploadUrl, addPostImage, dispatch, syncTags, appNav,
  ]);

  const inputStyle = [styles.input, { color: colors.fg, borderColor: colors.inputBorder, backgroundColor: colors.inputBg }];

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>

      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 140 }}
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
            title={video ? 'Change Media' : images.length ? 'Add More Media' : 'Add Photos or Video'}
            hint="Take one now or choose from your library"
            compact={!!video || images.length > 0}
            style={styles.photoField}
          />
          {video ? (
            <View style={styles.thumbRow}>
              <VideoPreview uri={video.uri} onRemove={() => setVideo(null)} />
            </View>
          ) : images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
              {images.map((img, idx) => (
                <View key={idx} style={styles.thumbWrap}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                  <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(idx)}>
                    <X size={11} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}
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
      <StickyFormFooter color={colors.cream} bottomInset={Platform.OS === 'android' ? 40 : 20}>
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
      </StickyFormFooter>

      <ActionSheet
        visible={mediaSheet}
        onClose={() => setMediaSheet(false)}
        title="Add media"
        message="A post carries either photos or one video."
        options={[
          { label: 'Take Photo',   Icon: Camera, onPress: addFromCamera },
          { label: 'Choose Photos', Icon: Images, onPress: addFromLibrary },
          { label: 'Take Video',   Icon: Video,  onPress: addVideoFromCamera },
          { label: 'Choose Video', Icon: Film,   onPress: addVideoFromLibrary },
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
  videoPreviewWrap: { width: 140, height: 90, borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  videoPreview: { width: '100%', height: '100%' },
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
  submitBtn:       {
    alignSelf: 'center', minWidth: 180,
    backgroundColor: colors.primaryAlt, borderRadius: 999,
    paddingVertical: 11, paddingHorizontal: 28,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
