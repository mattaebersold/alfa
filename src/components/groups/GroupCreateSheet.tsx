import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import {
  useCreatePostMutation,
  useAddPostImageMutation,
  useCreateGroupForumPostMutation,
  useCreateGroupNewsPostMutation,
  useCreateGroupResourceMutation,
} from '../../api/apiService';
import SharedModal from '../ui/SharedModal';
import ActionSheet from '../ui/ActionSheet';
import PhotoPickerField from '../ui/PhotoPickerField';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import { POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';

/**
 * "New <whatever you're looking at>" for a group section.
 *
 * One sheet rather than four, because the four differ only in which endpoint
 * they hit and which fields they show. It closes on success and lets RTK
 * Query's tag invalidation refresh the list behind it — no manual refetch, and
 * nothing to navigate back from.
 */

export type CreateKind = 'posts' | 'forum' | 'news' | 'resources';

const KIND_TITLE: Record<CreateKind, string> = {
  posts:     'New Post',
  forum:     'New Forum Post',
  news:      'New News Item',
  resources: 'New Resource',
};

interface Props {
  kind: CreateKind;
  groupId: string;
  groupTitle?: string;
  /** Categories offered for this section, already narrowed to the real set. */
  categories: { key: string; label: string }[];
  /** Preselected when opened from a category header; still changeable here. */
  initialCategory?: string;
  visible: boolean;
  onClose: () => void;
}

export default function GroupCreateSheet({
  kind, groupId, groupTitle, categories, initialCategory, visible, onClose,
}: Props) {
  const c = useColors();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState<string>('general');
  // Posts made here are ordinary posts, so they get the ordinary choices —
  // the same type and category pills the main create form offers. This used to
  // hardcode `general` and offer the group's own category list.
  const [postType, setPostType] = useState<PostType>('general');
  const [images, setImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [mediaSheet, setMediaSheet] = useState(false);
  // Photos upload one at a time once the post exists — this is the progress.
  const [imageProgress, setImageProgress] = useState<{ current: number; total: number } | null>(null);
  /**
   * Off by default. A post made from inside a group is a post *to that group*;
   * pushing it to the public feed as well is the deliberate extra step.
   */
  const [alsoPublic, setAlsoPublic] = useState(false);

  const [createPost, { isLoading: postingPost }] = useCreatePostMutation();
  const [addPostImage] = useAddPostImageMutation();
  const [createForum, { isLoading: postingForum }] = useCreateGroupForumPostMutation();
  const [createNews, { isLoading: postingNews }] = useCreateGroupNewsPostMutation();
  const [createResource, { isLoading: postingResource }] = useCreateGroupResourceMutation();
  const saving = postingPost || postingForum || postingNews || postingResource;

  // Reset on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (visible) {
      setTitle('');
      setBody('');
      setUrl('');
      setCategory(initialCategory ?? categories[0]?.key ?? 'general');
      setPostType('general');
      setImages([]);
      setImageProgress(null);
      setAlsoPublic(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCategory = kind === 'posts' || kind === 'forum' || kind === 'resources';
  // A post's categories follow its type; a forum thread's or a resource's come
  // from the group's own list.
  const categoryOptions = kind === 'posts' ? POST_CATEGORIES[postType] : categories;

  const addFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access needed', 'Please allow camera access in Settings to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const picked = await normalizePickedAssets(result.assets);
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);

  const addFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.85,
    });
    if (!result.canceled) {
      const picked = await normalizePickedAssets(result.assets);
      setImages((prev) => [...prev, ...picked].slice(0, 8));
    }
  }, []);
  const showUrl = kind === 'news' || kind === 'resources';
  const bodyRequired = kind !== 'posts'; // a photo-less post can still be a caption

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Give this a title first.');
      return;
    }
    if (bodyRequired && !body.trim()) {
      Alert.alert('Body required', 'Add some detail before posting.');
      return;
    }

    try {
      if (kind === 'posts') {
        const fd = new FormData();
        fd.append('title', title.trim());
        fd.append('body', body.trim());
        fd.append('type', postType);
        fd.append('entry_type', postType);
        fd.append('category', category);
        // Pre-selected and not editable here — you're posting from inside it.
        fd.append('group_ids', JSON.stringify([groupId]));
        if (alsoPublic) fd.append('also_public', 'true');
        const result = await createPost(fd).unwrap();

        // Photos go up one at a time against the created post, rather than as
        // one giant multipart request — same as the main create form.
        const postId = (result as any)?._id
          ?? (result as any)?.entry?.internal_id
          ?? (result as any)?.internal_id;
        if (images.length > 0 && postId) {
          setImageProgress({ current: 0, total: images.length });
          let done = 0;
          for (const img of images) {
            const ifd = new FormData();
            ifd.append('internal_id', postId);
            ifd.append('gallery', uploadFile(img.uri));
            try { await addPostImage(ifd).unwrap(); } catch { /* keep going; partial upload */ }
            setImageProgress({ current: ++done, total: images.length });
          }
          setImageProgress(null);
        }
      } else if (kind === 'forum') {
        await createForum({ group_id: groupId, title: title.trim(), body: body.trim(), category }).unwrap();
      } else if (kind === 'news') {
        await createNews({ group_id: groupId, title: title.trim(), body: body.trim(), url: url.trim() || undefined }).unwrap();
      } else {
        await createResource({ group_id: groupId, title: title.trim(), body: body.trim(), url: url.trim() || undefined, category }).unwrap();
      }
      onClose();
    } catch {
      setImageProgress(null);
      // Stay open with everything typed still there — a network blip shouldn't
      // cost you the whole form.
      Alert.alert('Could not save', 'Please try again.');
    }
  };

  return (
    <SharedModal visible={visible} onClose={onClose} title={KIND_TITLE[kind]} heightRatio={0.85}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {groupTitle ? (
          <View style={[styles.groupChip, { backgroundColor: c.secondary, borderColor: c.borderDark }]}>
            <Text style={[styles.groupChipLabel, { color: c.grey }]}>Posting to</Text>
            <Text style={[styles.groupChipName, { color: c.fg }]} numberOfLines={1}>{groupTitle}</Text>
          </View>
        ) : null}

        {kind === 'posts' && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Type</Text>
            <View style={styles.chips}>
              {POST_TYPES.map(({ type, label, color }) => {
                const active = postType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    onPress={() => {
                      setPostType(type);
                      // The categories change with the type, so the old pick
                      // would be a category this type doesn't have.
                      setCategory(POST_CATEGORIES[type][0]?.key ?? 'general');
                    }}
                    style={[
                      styles.chip,
                      { borderColor: c.borderDark, backgroundColor: c.secondary },
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#FFFFFF' : c.fg }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={[styles.label, { color: c.grey }]}>Title</Text>
        <TextInput
          style={[styles.input, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={c.grey}
          autoFocus
        />

        <Text style={[styles.label, { color: c.grey }]}>
          {kind === 'posts' ? 'Body' : 'Details'}
        </Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
          value={body}
          onChangeText={setBody}
          placeholder={kind === 'posts' ? "What's on your mind…" : 'Add some detail…'}
          placeholderTextColor={c.grey}
          multiline
        />

        {showUrl && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Link (optional)</Text>
            <TextInput
              style={[styles.input, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
              value={url}
              onChangeText={setUrl}
              placeholder="https://…"
              placeholderTextColor={c.grey}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </>
        )}

        {showCategory && categoryOptions.length > 0 && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Category</Text>
            <View style={styles.chips}>
              {categoryOptions.map((cat) => {
                const active = category === cat.key;
                const tint = categoryColor(cat.key);
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setCategory(cat.key)}
                    style={[
                      styles.chip,
                      { borderColor: c.borderDark, backgroundColor: c.secondary },
                      active && { backgroundColor: tint, borderColor: tint },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? pillTextColor(tint) : c.fg }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {kind === 'posts' && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Photos</Text>
            <PhotoPickerField
              onPress={() => { Keyboard.dismiss(); setMediaSheet(true); }}
              title={images.length ? 'Add More Photos' : 'Add Photos'}
              compact={images.length > 0}
            />
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {images.map((img, i) => (
                  <View key={img.uri} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <X size={11} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        )}

        {kind === 'posts' && (
          <TouchableOpacity
            style={styles.publicRow}
            onPress={() => setAlsoPublic((v) => !v)}
            activeOpacity={0.75}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: alsoPublic }}
          >
            <View style={[
              styles.checkbox,
              { borderColor: c.borderDark },
              alsoPublic && { backgroundColor: c.primaryAlt, borderColor: c.primaryAlt },
            ]}>
              {alsoPublic && <Text style={[styles.checkMark, { color: contrastText(c.primaryAlt) }]}>✓</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.publicLabel, { color: c.fg }]}>Also post publicly</Text>
              <Text style={[styles.publicHint, { color: c.grey }]}>
                Off by default — this goes to the group either way.
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submit, { backgroundColor: c.pro }, (saving || !title.trim()) && styles.submitOff]}
          onPress={submit}
          disabled={saving || imageProgress !== null || !title.trim()}
        >
          {saving || imageProgress
            ? (
              <View style={styles.submitBusy}>
                <ActivityIndicator color="#000000" />
                {imageProgress && (
                  <Text style={styles.submitText}>
                    Uploading {imageProgress.current} of {imageProgress.total}…
                  </Text>
                )}
              </View>
            )
            : <Text style={styles.submitText}>Post</Text>}
        </TouchableOpacity>
      </ScrollView>

      <ActionSheet
        visible={mediaSheet}
        onClose={() => setMediaSheet(false)}
        title="Add photos"
        options={[
          { label: 'Take Photo', onPress: addFromCamera },
          { label: 'Choose Photos', onPress: addFromLibrary },
        ]}
      />
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  body:        { padding: 16, paddingBottom: 40 },
  groupChip:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4,
  },
  groupChipLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  groupChipName:  { fontSize: 13, fontWeight: '700' },
  label:       { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 6 },
  input:       { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  inputMulti:  { height: 120, paddingTop: 12, textAlignVertical: 'top' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  chipText:    { fontSize: 12, fontWeight: '700' },
  publicRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark:   { fontSize: 13, fontWeight: '900' },
  publicLabel: { fontSize: 15, fontWeight: '600' },
  publicHint:  { fontSize: 12, marginTop: 2 },
  thumbRow:    { marginTop: 10 },
  thumbWrap:   { marginRight: 8, position: 'relative' },
  thumb:       { width: 72, height: 72, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  submitBusy:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submit:      { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  submitOff:   { opacity: 0.4 },
  submitText:  { fontSize: 16, fontWeight: '800', color: '#000000' },
});
