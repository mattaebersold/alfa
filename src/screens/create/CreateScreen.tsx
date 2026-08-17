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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ImagePlus, X, ChevronDown, ChevronUp, Check, Play } from 'lucide-react-native';
import {
  useCreatePostMutation, useGetUserGroupsQuery, useSyncPostTagsMutation,
  useCreateMuxUploadUrlMutation, useAddPostImageMutation, apiService,
} from '../../api/apiService';
import { useAppSelector, useAppDispatch } from '../../store/store';
import MentionInput from '../../components/ui/MentionInput';
import PostTagPicker, { type TagItem as PickerTagItem, type TagKind as PickerTagKind } from '../../components/social/PostTagPicker';
import { colors } from '../../constants/colors';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { useColors } from '../../hooks/useColors';
import type { AppStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';

type AppNav = NativeStackNavigationProp<AppStackParamList>;

// ── Post types ────────────────────────────────────────────────────────────────

type PostType = 'general' | 'record' | 'listing' | 'want' | 'spot';

const POST_TYPES: { type: PostType; label: string; color: string }[] = [
  { type: 'general',  label: 'General',    color: colors.primaryAlt },
  { type: 'record',   label: 'Car Record', color: colors.teal },
  { type: 'listing',  label: 'Listing',    color: '#00C851' },
  { type: 'want',     label: 'Want Ad',    color: '#F1184C' },
  { type: 'spot',     label: 'Spotted',    color: colors.tangerine },
];

const CATEGORIES: Record<PostType, { key: string; label: string }[]> = {
  general: [
    { key: 'show',  label: 'Show' },
    { key: 'misc',  label: 'Misc.' },
  ],
  record: [
    { key: 'general',      label: 'General' },
    { key: 'mod',          label: 'Mod' },
    { key: 'restoration',  label: 'Restoration' },
    { key: 'maintenance',  label: 'Maintenance' },
    { key: 'detailing',    label: 'Detailing' },
  ],
  listing: [
    { key: 'new',         label: 'New Part' },
    { key: 'used',        label: 'Used Part' },
    { key: 'car',         label: 'Car' },
    { key: 'accessories', label: 'Accessories' },
    { key: 'other',       label: 'Other' },
  ],
  want: [
    { key: 'part',  label: 'Part' },
    { key: 'car',   label: 'Car' },
    { key: 'other', label: 'Other' },
  ],
  spot: [
    { key: 'show',    label: 'Show' },
    { key: 'museum',  label: 'Museum' },
    { key: 'wild',    label: 'In the wild' },
  ],
};

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
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

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

  // Optional fields
  const [year, setYear]           = useState('');
  const [make, setMake]           = useState('');
  const [model, setModel]         = useState('');
  const [trim, setTrim]           = useState('');
  const [price, setPrice]         = useState('');
  const [mileage, setMileage]     = useState('');
  const [condition, setCondition] = useState('');
  const [vin, setVin]             = useState('');
  const [partNumber, setPartNumber] = useState('');

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isPublic, setIsPublic]                 = useState(true);

  // Tags (people, cars, events) — the search/autocomplete lives in PostTagPicker
  const [taggedUsers, setTaggedUsers]   = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars]     = useState<TagItem[]>([]);
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

  const currentCategories = CATEGORIES[postType];

  const showPrice    = postType === 'listing' || postType === 'want';
  const showMileage  = postType === 'listing' || postType === 'record';

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

  const pickImage = useCallback(() => {
    Keyboard.dismiss();
    Alert.alert('Add Media', undefined, [
      { text: 'Take Photo', onPress: addFromCamera },
      { text: 'Choose Photos', onPress: addFromLibrary },
      { text: 'Take Video', onPress: addVideoFromCamera },
      { text: 'Choose Video', onPress: addVideoFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [addFromCamera, addFromLibrary, addVideoFromCamera, addVideoFromLibrary]);

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
    postType, category, title, body, mentionedUserIds, year, make, model, trim, price, mileage,
    condition, vin, partNumber, selectedGroupIds, isPublic,
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
        contentContainerStyle={{ paddingBottom: 24 }}
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
          <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
            <ImagePlus size={18} color={colors.primaryAlt} />
            <Text style={[styles.addPhotoText, { color: colors.primaryAlt }]}>
              {video ? 'Change Media' : 'Add Photos or Video'}
            </Text>
          </TouchableOpacity>
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
        <Section label="Optional Fields">
          <FieldRow label="Year">
            <TextInput style={inputStyle} value={year} onChangeText={setYear} placeholder="e.g. 2003" placeholderTextColor={colors.grey} keyboardType="numeric" />
          </FieldRow>
          <FieldRow label="Make">
            <TextInput style={inputStyle} value={make} onChangeText={setMake} placeholder="e.g. Porsche" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="Model">
            <TextInput style={inputStyle} value={model} onChangeText={setModel} placeholder="e.g. 911" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="Trim">
            <TextInput style={inputStyle} value={trim} onChangeText={setTrim} placeholder="e.g. Carrera S" placeholderTextColor={colors.grey} />
          </FieldRow>
          {showPrice && (
            <FieldRow label="Price ($)">
              <TextInput style={inputStyle} value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={colors.grey} keyboardType="numeric" />
            </FieldRow>
          )}
          {showMileage && (
            <FieldRow label="Mileage">
              <TextInput style={inputStyle} value={mileage} onChangeText={setMileage} placeholder="0" placeholderTextColor={colors.grey} keyboardType="numeric" />
            </FieldRow>
          )}
          <FieldRow label="Condition">
            <TextInput style={inputStyle} value={condition} onChangeText={setCondition} placeholder="e.g. Excellent" placeholderTextColor={colors.grey} />
          </FieldRow>
          <FieldRow label="VIN">
            <TextInput style={inputStyle} value={vin} onChangeText={setVin} placeholder="Vehicle ID" placeholderTextColor={colors.grey} autoCapitalize="characters" />
          </FieldRow>
          <FieldRow label="Part #">
            <TextInput style={inputStyle} value={partNumber} onChangeText={setPartNumber} placeholder="Part number" placeholderTextColor={colors.grey} />
          </FieldRow>
        </Section>

        {/* ── Tag people, cars & events — always visible (no accordion) ── */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
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
        <Section label="Post To" defaultOpen>
          {/* Public row — always first, checked by default */}
          <TouchableOpacity
            style={[styles.postToRow, { borderBottomColor: colors.border }]}
            onPress={() => setIsPublic(v => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, { borderColor: colors.primaryAlt }, isPublic && { backgroundColor: colors.primaryAlt }]}>
              {isPublic && <Check size={11} color="#FFF" />}
            </View>
            <Text style={[styles.postToLabel, { color: colors.fg }]}>Post publicly</Text>
          </TouchableOpacity>

          {/* One row per group */}
          {userGroups.map((group) => {
            const gid = group.internal_id;
            const active = selectedGroupIds.includes(gid);
            return (
              <TouchableOpacity
                key={gid}
                style={[styles.postToRow, { borderBottomColor: colors.border }]}
                onPress={() => toggleGroup(gid)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, { borderColor: colors.primaryAlt }, active && { backgroundColor: colors.primaryAlt }]}>
                  {active && <Check size={11} color="#FFF" />}
                </View>
                <Text style={[styles.postToLabel, { color: colors.fg }]} numberOfLines={1}>
                  {group.title ?? 'Group'}
                </Text>
              </TouchableOpacity>
            );
          })}

          {userGroups.length === 0 && (
            <Text style={[styles.postToEmpty, { color: colors.grey }]}>You're not a member of any groups yet.</Text>
          )}
        </Section>
      </ScrollView>

      {/* ── Fixed Post button ── */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Platform.OS === 'android' ? 40 : 20 }]}>
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
  addPhotoBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  addPhotoText: { fontSize: 14, fontWeight: '600' },
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

  postToRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  postToLabel:   { flex: 1, fontSize: 15, fontWeight: '600' },
  postToEmpty:   { paddingHorizontal: 14, paddingVertical: 12, fontSize: 13 },

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

  footer:          { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  submitBtn:       { backgroundColor: colors.primaryAlt, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:      { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
