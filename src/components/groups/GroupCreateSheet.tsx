import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Keyboard,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { FormScrollView } from '@ors/kit';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { X, AlertCircle } from 'lucide-react-native';
import {
  useCreatePostMutation,
  useAddPostImageMutation,
  useCreateGroupDiscussionPostMutation,
  useCreateGroupNewsPostMutation,
  useCreateGroupResourceMutation,
  useUpdateGroupDiscussionPostMutation,
  useUpdateGroupResourceMutation,
  useCreateGroupDiscussionPostFormMutation, useCreateGroupNewsPostFormMutation, useCreateGroupResourceFormMutation,
  useGetGroupQuery, useGetUserGroupsQuery,
} from '../../api/apiService';
import SharedModal, { PANE_GUTTER } from '../ui/SharedModal';
import ActionSheet from '../ui/ActionSheet';
import PhotoPickerField from '../ui/PhotoPickerField';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { categoryColor, pillTextColor } from '../../utils/categoryColor';
import { CREATABLE_POST_TYPES, POST_CATEGORIES, type PostType } from '../../constants/postTypes';
import { uploadFile, normalizePickedAssets } from '../../utils/upload';
import { describeApiError } from '../../utils/apiError';
import { groupCarsOf, groupCarLabel } from '../../utils/groupCars';
import { handleize } from '../../utils/handleize';
import { carScopeKey } from '../../utils/carScope';
import { useAppSelector } from '../../store/store';
import type { CrossModel } from '../../types/api';
import { COMMON_RADIUS, COLOR_BLACK, COLOR_WHITE, COLOR_DANGER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * "New <whatever you're looking at>" for a group section.
 *
 * One sheet rather than four, because the four differ only in which endpoint
 * they hit and which fields they show. It closes on success and lets RTK
 * Query's tag invalidation refresh the list behind it — no manual refetch, and
 * nothing to navigate back from.
 */

export type CreateKind = 'posts' | 'discussion' | 'news' | 'resources';

const KIND_TITLE: Record<CreateKind, string> = {
  posts:     'New Post',
  discussion:     'New Discussion',
  news:      'New News Item',
  resources: 'New Resource',
};

const EDIT_TITLE: Partial<Record<CreateKind, string>> = {
  discussion: 'Edit Discussion',
  resources:  'Edit Resource',
};

/** An existing discussion post or resource to edit in place of creating one. */
export interface EditableGroupItem {
  internal_id: string;
  title?: string;
  body?: string;
  url?: string;
  category?: string;
}

/** How long a save runs before the form says it's still going. */
const SLOW_AFTER_MS = 8000;

interface Props {
  kind: CreateKind;
  /** The group — or, with `scope`, the car model's cache key (utils/carScope). */
  groupId: string;
  /**
   * Post to a car model's page instead of a group: discussion and resources
   * only, and open to anyone. The server takes the make + model in place of a
   * group id.
   */
  scope?: { make: string; model: string };
  groupTitle?: string;
  /** Categories offered for this section, already narrowed to the real set. */
  categories: { key: string; label: string }[];
  /** Preselected when opened from a category header; still changeable here. */
  initialCategory?: string;
  /**
   * Edits this item instead of creating a new one. Discussion and resources
   * only — the fields are prefilled and Post becomes Save.
   */
  editing?: EditableGroupItem | null;
  visible: boolean;
  onClose: () => void;
}

export default function GroupCreateSheet({
  kind, groupId, scope, groupTitle, categories, initialCategory, editing, visible, onClose,
}: Props) {
  // Where a new discussion or resource goes: the group, or the model's page.
  const home = scope ? { make: scope.make, model: scope.model } : { group_id: groupId };
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
  const [createDiscussion, { isLoading: postingDiscussion }] = useCreateGroupDiscussionPostMutation();
  const [createNews, { isLoading: postingNews }] = useCreateGroupNewsPostMutation();
  const [createResource, { isLoading: postingResource }] = useCreateGroupResourceMutation();
  const [createDiscussionForm, { isLoading: postingDiscussionForm }] = useCreateGroupDiscussionPostFormMutation();
  const [createNewsForm, { isLoading: postingNewsForm }] = useCreateGroupNewsPostFormMutation();
  const [createResourceForm, { isLoading: postingResourceForm }] = useCreateGroupResourceFormMutation();
  const [updateDiscussion, { isLoading: updatingDiscussion }] = useUpdateGroupDiscussionPostMutation();
  const [updateResource, { isLoading: updatingResource }] = useUpdateGroupResourceMutation();
  // Every way this form can be sending — the multipart creates included. They
  // used to be left out, so a discussion or resource with photos showed no
  // spinner and stayed tappable for the whole upload.
  const saving = postingPost || postingDiscussion || postingNews || postingResource
    || postingDiscussionForm || postingNewsForm || postingResourceForm
    || updatingDiscussion || updatingResource;
  /**
   * Set for the whole of `submit`, not just while a request is in flight —
   * between the create and the first photo, say, nothing is loading but the
   * form still isn't done.
   */
  const [submitting, setSubmitting] = useState(false);
  const busy = saving || submitting || imageProgress !== null;
  /** Why the last try failed, shown over the button — and kept until you edit or retry. */
  const [error, setError] = useState<string | null>(null);
  /** A save still going after a while: say so, rather than leave a spinner to explain itself. */
  const [slow, setSlow] = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (slowTimer.current) clearTimeout(slowTimer.current); }, []);

  /**
   * Somewhere else this could also go, asked for as it's posted — a new
   * discussion or resource only. One item either way, listed in both places,
   * with one thread and one set of votes.
   *
   *  - In a group: the model pages of the cars the group is about. A make-wide
   *    group car ("Porsche") has no page of its own, so only ones with a model.
   *  - On a model's page: the groups you're an active member of that are about
   *    this model — or about its whole make.
   */
  const crossable = !editing && (kind === 'discussion' || kind === 'resources');
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  const { data: homeGroup } = useGetGroupQuery(groupId, { skip: !visible || !crossable || !!scope });
  const { data: myGroups } = useGetUserGroupsQuery(myId ?? '', { skip: !visible || !crossable || !scope || !myId });
  const crossOptions = useMemo<{ key: string; label: string; hint: string; model?: CrossModel; groupId?: string }[]>(() => {
    if (!crossable) return [];
    if (!scope) {
      const seen = new Set<string>();
      return groupCarsOf(homeGroup).flatMap((car) => {
        if (!car.model) return [];
        const key = `m:${carScopeKey(car.make, car.model)}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{
          key,
          label: `The ${groupCarLabel(car)} page`,
          hint: 'Public — anyone can see it there.',
          model: { make: car.make, model: car.model },
        }];
      });
    }
    const make = handleize(scope.make);
    const model = handleize(scope.model);
    return (myGroups ?? [])
      .filter((g) => (g.membership?.status ?? 'active') === 'active')
      .filter((g) => groupCarsOf(g).some((car) =>
        handleize(car.make) === make && (!car.model || handleize(car.model) === model)))
      .map((g) => ({
        key: `g:${g.internal_id}`,
        label: g.title ?? 'Group',
        hint: 'Its members will see it there too.',
        groupId: g.internal_id,
      }));
  }, [crossable, scope, homeGroup, myGroups]);
  /** Ticked cross-posts, by option key. Off by default — it's the deliberate extra step. */
  const [crossPicked, setCrossPicked] = useState<Set<string>>(() => new Set());
  const toggleCross = (key: string) => setCrossPicked((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const picked = crossOptions.filter((o) => crossPicked.has(o.key));
  const cross = {
    also_models: picked.flatMap((o) => (o.model ? [o.model] : [])),
    also_groups: picked.flatMap((o) => (o.groupId ? [o.groupId] : [])),
  };

  // Reset on open, not on close — clearing while it animates out is visible.
  useEffect(() => {
    if (visible) {
      setTitle(editing?.title ?? '');
      setBody(editing?.body ?? '');
      setUrl(editing?.url ?? '');
      setCategory(editing?.category ?? initialCategory ?? categories[0]?.key ?? 'general');
      setPostType('general');
      setImages([]);
      setImageProgress(null);
      setAlsoPublic(false);
      setError(null);
      setSlow(false);
      setCrossPicked(new Set());
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const showCategory = kind === 'posts' || kind === 'discussion' || kind === 'resources';
  // A news item carries one picture (the server's uploadSingle); the rest a
  // gallery. Not offered on an edit: the server reads an edit's gallery as
  // "keep these, add those", and this form doesn't yet list what's kept.
  const maxImages = kind === 'news' ? 1 : 8;
  const showPhotos = !editing;
  // A post's categories follow its type; a discussion thread's or a resource's come
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
      setImages((prev) => [...prev, ...picked].slice(0, maxImages));
    }
  }, [maxImages]);

  const addFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: maxImages > 1, selectionLimit: maxImages, quality: 0.85,
    });
    if (!result.canceled) {
      const picked = await normalizePickedAssets(result.assets);
      setImages((prev) => [...prev, ...picked].slice(0, maxImages));
    }
  }, [maxImages]);
  const showUrl = kind === 'news' || kind === 'resources';
  const bodyRequired = kind !== 'posts'; // a photo-less post can still be a caption

  /**
   * What's still missing, in words — shown under the disabled button, so it
   * says why it can't be pressed rather than only looking faded.
   */
  const missing = !title.trim()
    ? 'Add a title to post.'
    : bodyRequired && !body.trim()
      ? 'Add some details to post.'
      : null;

  const submit = async () => {
    if (missing || busy) return;

    setError(null);
    setSubmitting(true);
    setSlow(false);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    try {
      if (editing && kind === 'discussion') {
        await updateDiscussion({
          internal_id: editing.internal_id, group_id: groupId,
          title: title.trim(), body: body.trim(), category,
        }).unwrap();
      } else if (editing && kind === 'resources') {
        await updateResource({
          internal_id: editing.internal_id, group_id: groupId,
          title: title.trim(), body: body.trim(), url: url.trim(), category,
        }).unwrap();
      } else if (kind === 'posts') {
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
      } else if (images.length > 0) {
        // With photos it's multipart: the same fields, on a form, and the
        // files under the name each route reads.
        const fd = new FormData();
        Object.entries(home).forEach(([k, v]) => { if (v != null && v !== '') fd.append(k, String(v)); });
        fd.append('title', title.trim());
        fd.append('body', body.trim());
        if (kind !== 'news' && category) fd.append('category', category);
        if (kind !== 'discussion' && url.trim()) fd.append('url', url.trim());
        if (kind === 'news') {
          fd.append('group_id', groupId);
          fd.append('file', uploadFile(images[0].uri));
          await createNewsForm({ group_id: groupId, form: fd }).unwrap();
        } else {
          images.forEach((img) => fd.append('gallery', uploadFile(img.uri)));
          if (cross.also_models.length) fd.append('also_models', JSON.stringify(cross.also_models));
          if (cross.also_groups.length) fd.append('also_groups', JSON.stringify(cross.also_groups));
          if (kind === 'discussion') await createDiscussionForm({ ...home, ...cross, form: fd }).unwrap();
          else await createResourceForm({ ...home, ...cross, form: fd }).unwrap();
        }
      } else if (kind === 'discussion') {
        await createDiscussion({ ...home, ...cross, title: title.trim(), body: body.trim(), category }).unwrap();
      } else if (kind === 'news') {
        await createNews({ group_id: groupId, title: title.trim(), body: body.trim(), url: url.trim() || undefined }).unwrap();
      } else {
        await createResource({ ...home, ...cross, title: title.trim(), body: body.trim(), url: url.trim() || undefined, category }).unwrap();
      }
      onClose();
    } catch (err) {
      setImageProgress(null);
      // Stay open with everything typed still there — a network blip shouldn't
      // cost you the whole form — and say what actually went wrong.
      setError(describeApiError(err));
    } finally {
      setSubmitting(false);
      setSlow(false);
      if (slowTimer.current) clearTimeout(slowTimer.current);
    }
  };

  /** The button's words while it works: what it's doing, not just that it is. */
  const busyLabel = imageProgress
    ? `Uploading ${imageProgress.current} of ${imageProgress.total}…`
    : images.length > 0 && kind !== 'posts'
      ? `Uploading ${images.length === 1 ? 'photo' : `${images.length} photos`}…`
      : editing ? 'Saving…' : 'Posting…';

  // Any edit clears the last failure: it no longer describes this form.
  useEffect(() => { setError(null); }, [title, body, url, category, images.length]);

  return (
    <SharedModal
      visible={visible}
      // Not while it's sending: closed mid-upload, the save carries on unseen
      // and you'd never learn whether it landed.
      onClose={busy ? () => {} : onClose}
      title={(editing && EDIT_TITLE[kind]) || KIND_TITLE[kind]}
      // Where it's going, up in the heading's corner rather than as the first
      // thing in the form — it's context, not a field.
      headerRight={groupTitle ? (
        <View style={[styles.groupChip, { backgroundColor: c.secondary, borderColor: c.borderDark }]}>
          <Text style={[styles.groupChipLabel, { color: c.grey }]}>Group:</Text>
          <Text style={[styles.groupChipName, { color: c.fg }]} numberOfLines={1}>{groupTitle}</Text>
        </View>
      ) : undefined}
      heightRatio={0.85}
    >
      <FormScrollView contentContainerStyle={styles.body}>

        {kind === 'posts' && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>Type</Text>
            <View style={styles.chips}>
              {CREATABLE_POST_TYPES.map(({ type, label, color }) => {
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
                    <Text style={[styles.chipText, { color: active ? COLOR_WHITE : c.fg }]}>{label}</Text>
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
          editable={!busy}
          placeholder="Title"
          placeholderTextColor={c.grey}
          // Not on an edit: what's there is the point, and the keyboard rising
          // as the pane slides in over the item made the two fight for room.
          autoFocus={!editing}
        />

        <Text style={[styles.label, { color: c.grey }]}>
          {kind === 'posts' ? 'Body' : 'Details'}
        </Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { borderColor: c.borderDark, color: c.fg, backgroundColor: c.card }]}
          value={body}
          onChangeText={setBody}
          editable={!busy}
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
              editable={!busy}
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
            {/* One row that scrolls, rather than wrapping: a group's categories
                run to a dozen, and wrapped they were a block the title had to
                be found under. Bled to the sheet's edges so the row runs off
                them, with the body's inset carried as content padding. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              {categoryOptions.map((cat) => {
                const active = category === cat.key;
                const tint = categoryColor(cat.key);
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => setCategory(cat.key)}
                    disabled={busy}
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
            </ScrollView>
          </>
        )}

        {showPhotos && (
          <>
            <Text style={[styles.label, { color: c.grey }]}>{maxImages === 1 ? 'Photo' : 'Photos'}</Text>
            <PhotoPickerField
              onPress={() => { if (busy) return; Keyboard.dismiss(); setMediaSheet(true); }}
              title={images.length
                ? (maxImages === 1 ? 'Change Photo' : 'Add More Photos')
                : (maxImages === 1 ? 'Add a Photo (optional)' : 'Add Photos (optional)')}
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
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                    >
                      <X size={11} color={COLOR_WHITE} />
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

        {/* The same checkbox as "Also post publicly", one per place it could
            also go — see crossOptions. Nothing shows when there's nowhere. */}
        {crossOptions.length > 0 && (
          <>
            <Text style={[styles.label, styles.crossHeading, { color: c.grey }]}>Also post to</Text>
            {crossOptions.map((o, i) => {
              const on = crossPicked.has(o.key);
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[styles.publicRow, i === 0 ? styles.crossFirst : styles.crossNext]}
                  onPress={() => toggleCross(o.key)}
                  disabled={busy}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: busy }}
                >
                  <View style={[
                    styles.checkbox,
                    { borderColor: c.borderDark },
                    on && { backgroundColor: c.primaryAlt, borderColor: c.primaryAlt },
                  ]}>
                    {on && <Text style={[styles.checkMark, { color: contrastText(c.primaryAlt) }]}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.publicLabel, { color: c.fg }]} numberOfLines={1}>{o.label}</Text>
                    <Text style={[styles.publicHint, { color: c.grey }]}>{o.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {/* The last failure, in place of an alert: it stays while you decide
            what to do, and the button under it is the retry. */}
        {error && !busy ? (
          <View style={[styles.errorBox, { borderColor: COLOR_DANGER }]} accessibilityRole="alert">
            <AlertCircle size={16} color={COLOR_DANGER} />
            <Text style={[styles.errorText, { color: c.fg }]}>{error}</Text>
          </View>
        ) : null}

        {/* Three looks: ready (full colour), not ready (greyed, with why
            beneath), and working (full colour, spinner and what it's doing,
            not pressable). Working isn't faded — fading read as "broken". */}
        <TouchableOpacity
          style={[
            styles.submit,
            missing
              ? { backgroundColor: c.secondary, borderColor: c.borderDark, borderWidth: 1 }
              : { backgroundColor: c.pro },
          ]}
          onPress={submit}
          disabled={busy || !!missing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !!missing, busy }}
        >
          {busy
            ? (
              <View style={styles.submitBusy}>
                <ActivityIndicator color={COLOR_BLACK} />
                <Text style={styles.submitText}>{busyLabel}</Text>
              </View>
            )
            : (
              <Text style={[styles.submitText, missing && { color: c.grey }]}>
                {error ? 'Try again' : editing ? 'Save' : 'Post'}
              </Text>
            )}
        </TouchableOpacity>

        {missing && !busy ? (
          <Text style={[styles.hint, { color: c.grey }]}>{missing}</Text>
        ) : busy && slow ? (
          <Text style={[styles.hint, { color: c.grey }]}>
            {images.length > 0
              ? 'Still uploading — photos can take a minute on a slow connection. Keep this open.'
              : 'Still working — hang on a moment.'}
          </Text>
        ) : null}
      </FormScrollView>

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
  // Close under the heading: the header carries its own foot padding.
  body:        { paddingHorizontal: PANE_GUTTER, paddingTop: 4, paddingBottom: 40 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    maxWidth: 190,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, borderWidth: StyleSheet.hairlineWidth,
  },
  groupChipLabel: { fontSize: 12, fontFamily: FONT_INTER.semibold },
  groupChipName: { fontSize: 12, fontFamily: FONT_INTER.bold, flexShrink: 1 },
  label:       { fontSize: 11, fontFamily: FONT_INTER.extrabold, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input:       { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  inputMulti:  { height: 96, paddingTop: 12, textAlignVertical: 'top' },
  chips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipScroller:{ marginHorizontal: -PANE_GUTTER },
  chipRow:     { flexDirection: 'row', gap: 8, paddingHorizontal: PANE_GUTTER },
  chip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  chipText:    { fontSize: 12, fontFamily: FONT_INTER.bold },
  publicRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 22 },
  checkbox:    { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark:   { fontSize: 13, fontFamily: FONT_INTER.black },
  publicLabel: { fontSize: 15, fontFamily: FONT_INTER.semibold },
  publicHint:  { fontSize: 12, marginTop: 2 },
  crossHeading:{ marginTop: 22 },
  crossFirst:  { marginTop: 4 },
  crossNext:   { marginTop: 14 },
  thumbRow:    { marginTop: 10 },
  thumbWrap:   { marginRight: 8, position: 'relative' },
  thumb:       { width: 72, height: 72, borderRadius: 8 },
  thumbRemove: {
    position: 'absolute', top: 3, right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 9,
    width: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  submitBusy:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submit:      { height: 50, borderRadius: COMMON_RADIUS, alignItems: 'center', justifyContent: 'center', marginTop: 26 },
  hint:        { fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 10 },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 22, padding: 12, borderRadius: 10, borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  errorText:   { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: FONT_INTER.medium },
  submitText:  { fontSize: 16, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
});
