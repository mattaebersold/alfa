import React, { useState, useEffect, useMemo } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../theme/Text';
import FormScrollView, { KEYBOARD_GAP } from '../../keyboard/FormScrollView';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { userTag, type TagItem as PickerTagItem, type TagKind as PickerTagKind } from './PostTagPicker';
import PostTypePicker from '../create/PostTypePicker';
import PostFormSections from '../create/PostFormSections';
import MentionInput from '../ui/MentionInput';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import PostGalleryEditor, { toEditorImages, type EditorImage } from './PostGalleryEditor';
import { EMPTY_OPTIONAL_FIELDS, type OptionalFieldValues } from './PostOptionalFields';
import PollEditor, { pollDraftFrom, pollDraftToInput, type PollDraft } from './PollEditor';
import { uploadFile } from '../../utils/upload';
import {
  useUpdatePostMutation, useSyncPostTagsMutation, useGetPostTagsQuery,
  useGetUserGroupsQuery,
  useGetPreviouslyTaggedUsersQuery, useGetPreviouslyTaggedCarsQuery, useGetPreviouslyTaggedEventsQuery, useGetUserByIdQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';
import type { Post, PostPlace } from '../../types/api';
import { COMMON_RADIUS, PILL_RADIUS, COLOR_BLACK } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

// Tag types come from the picker — see CreateScreen for the same reasoning.
type TagKind = PickerTagKind;
type TagItem = PickerTagItem;

// Map the backend's tag_entry_type to our TagKind.
function kindFromEntryType(t: string): TagKind | null {
  if (t === 'user') return 'user';
  if (t === 'garagecar' || t === 'car') return 'car';
  if (t === 'event') return 'event';
  return null;
}

interface Props {
  post: Post;
  visible: boolean;
  onClose: () => void;
}

export default function PostEditSheet({ post, visible, onClose }: Props) {
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [updatePost, { isLoading }] = useUpdatePostMutation();
  const [syncTags] = useSyncPostTagsMutation();

  const [title, setTitle] = useState(post.title ?? '');
  const [body, setBody] = useState(post.body ?? '');
  const [type, setType] = useState(post.type ?? 'general');
  const [category, setCategory] = useState(post.category ?? '');
  // Editing used to drop every one of these: a listing with a price and a VIN
  // came back from a save with neither, because the form never carried them.
  const [optional, setOptional] = useState<OptionalFieldValues>(EMPTY_OPTIONAL_FIELDS);

  const insets = useSafeAreaInsets();
  // Save's fill: Pro red for a Pro account, blue otherwise.
  const brand = useBrandColor();
  // Only a post that already has a poll shows the poll editor.
  const isPoll = !!post.poll?.options?.length;
  // An older post with words in its body as well as its title.
  const hadBody = !!post.body?.trim();

  // Gallery — existing images plus any newly picked, in display order
  const [images, setImages] = useState<EditorImage[]>(() => toEditorImages(post.gallery));
  const [savingImages, setSavingImages] = useState(false);

  // Tags
  const [taggedUsers, setTaggedUsers] = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars] = useState<TagItem[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);

  // Where it was made — see CreateScreen's "Add a Location".
  const [place, setPlace] = useState<PostPlace | null>(post.place ?? null);

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // Poll — seeded from the post's own, with option ids kept so a relabel
  // keeps its votes (see PollInput).
  const [poll, setPoll] = useState<PollDraft>(() => pollDraftFrom(post.poll));
  // Options somebody has voted for can be reworded but not dropped.
  const lockedOptionIds = useMemo(
    () => new Set((post.poll_summary?.options ?? []).filter((o) => o.count > 0).map((o) => o.internal_id)),
    [post.poll_summary],
  );

  const { data: existingTags } = useGetPostTagsQuery(post.internal_id, { skip: !visible });
  const { data: prevUsersData } = useGetPreviouslyTaggedUsersQuery();
  const { data: prevCarsData } = useGetPreviouslyTaggedCarsQuery();
  const { data: prevEventsData } = useGetPreviouslyTaggedEventsQuery();
  const { data: rawGroups } = useGetUserGroupsQuery(userInfo?.user_id ?? '', { skip: !userInfo?.user_id });
  const userGroups: any[] = Array.isArray(rawGroups) ? rawGroups : (rawGroups as any)?.entries ?? [];

  // Prefill text/type/category/groups when opened.
  useEffect(() => {
    if (visible) {
      setTitle(post.title ?? '');
      setBody(post.body ?? '');
      setType(post.type ?? 'general');
      setCategory(post.category ?? '');
      setOptional({
        year: post.year ?? '',
        make: post.make ?? '',
        model: post.model ?? '',
        trim: post.trim ?? '',
        price: post.price ?? '',
        mileage: post.mileage ?? '',
        condition: post.condition ?? '',
        vin: post.vin ?? '',
        partNumber: post.part_number ?? '',
      });
      const groups = (post as any).group_ids as string[] | undefined;
      setSelectedGroupIds(Array.isArray(groups) ? groups : []);
      // "Post publicly" defaults to checked on edit (previously it unchecked
      // whenever the post had any group, dropping the public flag on save).
      setIsPublic(true);
      setPoll(pollDraftFrom(post.poll));
      setPlace(post.place ?? null);
    }
  }, [visible, post]);

  // Build id → label lookups from the previously-tagged pool so existing tags
  // on this post resolve to readable labels when the editor opens.
  const labelLookup = useMemo(() => {
    const users: Record<string, string> = {};
    // The member themself, so the chip shows their photo, not just initials.
    const userObjs: Record<string, any> = {};
    const cars: Record<string, string> = {};
    const events: Record<string, string> = {};
    const addUser = (u: any) => {
      const id = u.user_id || u.internal_id;
      if (!id) return;
      users[id] = u.username || [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User';
      userObjs[id] = u;
    };
    const addCar = (c: any) => {
      if (c.internal_id) cars[c.internal_id] = [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car';
    };
    const addEvent = (e: any) => { if (e.internal_id) events[e.internal_id] = e.title || 'Event'; };
    (prevUsersData?.users ?? []).forEach(addUser);
    // The post's own tags, when the feed batched the member onto them.
    (post.tags ?? []).forEach((t) => { if (t.tagged_user) addUser(t.tagged_user); });
    (prevCarsData?.cars ?? []).forEach(addCar);
    (prevEventsData?.events ?? []).forEach(addEvent);
    return { users, userObjs, cars, events };
  }, [prevUsersData, prevCarsData, prevEventsData, post.tags]);

  // Prefill selected tags from the post's existing tags (labels resolved best-effort).
  useEffect(() => {
    if (!visible || !existingTags) return;
    const u: TagItem[] = [], c: TagItem[] = [], e: TagItem[] = [];
    existingTags.forEach((t) => {
      const kind = kindFromEntryType(t.tag_entry_type);
      if (!kind) return;
      const id = t.tag_internal_id;
      if (kind === 'user') u.push({ id, kind, label: labelLookup.users[id] ?? 'Tagged user', avatarUser: labelLookup.userObjs[id] });
      else if (kind === 'car') c.push({ id, kind, label: labelLookup.cars[id] ?? 'Tagged car' });
      else e.push({ id, kind, label: labelLookup.events[id] ?? 'Tagged event' });
    });
    setTaggedUsers(u); setTaggedCars(c); setTaggedEvents(e);
  }, [visible, existingTags, labelLookup]);

  const toggleTag = (tag: TagItem) => {
    if (tag.kind === 'group') return;
    const [list, setter] = tag.kind === 'user' ? [taggedUsers, setTaggedUsers]
      : tag.kind === 'car' ? [taggedCars, setTaggedCars]
      : [taggedEvents, setTaggedEvents];
    const exists = (list as TagItem[]).some((t) => t.id === tag.id);
    (setter as any)(exists ? (list as TagItem[]).filter((t) => t.id !== tag.id) : [...(list as TagItem[]), tag]);
  };
  const toggleGroup = (gid: string) =>
    setSelectedGroupIds((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  /** Fields the backend expects on every update, gallery aside. */
  const baseFields = (fd: FormData) => {
    fd.append('internal_id', post.internal_id);
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('type', type);
    if (category) fd.append('category', category);
    // Sent even when blank: clearing a field has to be able to clear it.
    fd.append('year', optional.year.trim());
    fd.append('make', optional.make.trim());
    fd.append('model', optional.model.trim());
    fd.append('trim', optional.trim.trim());
    fd.append('price', optional.price.trim());
    fd.append('mileage', optional.mileage.trim());
    fd.append('condition', optional.condition.trim());
    fd.append('vin', optional.vin.trim());
    fd.append('part_number', optional.partNumber.trim());
    fd.append('group_ids', JSON.stringify(selectedGroupIds));
    if (isPublic) fd.append('also_public', 'true');
    // One JSON field, as on create. Taken off a post that had one, it goes
    // empty — the server's "clear it". Absent means leave it alone, so a post
    // that never had a place doesn't send anything.
    if (place) fd.append('place', JSON.stringify(place));
    else if (post.place) fd.append('place', '');
  };

  /**
   * Saving the gallery is two passes, because the server assigns filenames to
   * newly uploaded images and always appends them to the end:
   *
   *   1. Upload new files and remove deleted ones. The response comes back as
   *      [surviving originals…, newly uploaded…] in upload order.
   *   2. If that isn't the order the user arranged, send `setIndex` commands —
   *      now that every image has a server filename to address it by.
   *
   * Pass 2 is skipped when the resulting order already matches.
   */
  const saveGallery = async (): Promise<void> => {
    const originals = post.gallery ?? [];
    const survivors = new Set(
      images.filter((i) => i.kind === 'existing').map((i) => (i as any).filename as string)
    );
    // Filenames rather than entries: it's all the remove call needs, and a
    // gallery can now hold videos, which have no filename to remove by.
    const removed = originals
      .map((o) => o.filename)
      .filter((f): f is string => !!f && !survivors.has(f));
    const added = images.filter((i) => i.kind === 'new') as Extract<EditorImage, { kind: 'new' }>[];

    const orderChanged = images.some((img, idx) =>
      img.kind === 'existing' && originals[idx]?.filename !== (img as any).filename
    );

    if (removed.length === 0 && added.length === 0 && !orderChanged) return;

    const fd = new FormData();
    baseFields(fd);
    removed.forEach((filename, i) => fd.append(`modifyImage:remove:${i}`, filename));
    added.forEach((img) => fd.append('gallery', uploadFile(img.uri)));

    const updated: any = await updatePost(fd).unwrap();

    // Map the editor's arrangement onto real server filenames.
    const resulting: { filename: string }[] = updated?.gallery ?? [];
    const appended = added.length > 0 ? resulting.slice(resulting.length - added.length) : [];
    let appendedCursor = 0;

    const desired = images.map((img) =>
      img.kind === 'existing'
        ? (img as any).filename as string
        : appended[appendedCursor++]?.filename
    ).filter(Boolean) as string[];

    const alreadyOrdered =
      desired.length === resulting.length &&
      desired.every((fn, i) => resulting[i]?.filename === fn);

    if (alreadyOrdered) return;

    const orderFd = new FormData();
    baseFields(orderFd);
    desired.forEach((filename, index) => {
      orderFd.append(`modifyImage:setIndex:${index}:${filename}`, String(index));
    });
    await updatePost(orderFd).unwrap();
  };

  const handleSave = async () => {
    const pollInput = pollDraftToInput(poll);
    if (pollInput.error) {
      Alert.alert('Check the poll', pollInput.error);
      return;
    }
    const fd = new FormData();
    baseFields(fd);
    /**
     * The poll rides on this first update only. The server reads an absent
     * field as "leave the poll alone", which is what the gallery passes after
     * this one want — sending it three times would merge it three times.
     *
     * Switched off on a post that had one, the field goes empty, which is the
     * server's "remove it". It refuses that once anyone has voted; the message
     * it sends says so, and is shown as-is below.
     */
    if (pollInput.poll) fd.append('poll', JSON.stringify(pollInput.poll));
    else if (post.poll?.options?.length) fd.append('poll', '');
    try {
      setSavingImages(true);
      await updatePost(fd).unwrap();
      await saveGallery();
      await syncTags({
        post_id: post.internal_id,
        tagged_users: taggedUsers.map((t) => t.id),
        tagged_cars: taggedCars.map((t) => t.id),
        tagged_events: taggedEvents.map((t) => t.id),
      }).unwrap().catch(() => {});
      onClose();
    } catch (err: any) {
      // The poll rules come back as a 400 with a sentence fit to show — "that
      // option already has votes", say — which beats a shrug.
      const serverMsg = err?.data?.error ?? err?.data?.message;
      Alert.alert('Error', typeof serverMsg === 'string' && serverMsg ? serverMsg : 'Could not save changes.');
    } finally {
      setSavingImages(false);
    }
  };

  const saveButton = (
    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: brand }, isLoading && styles.saveBtnDisabled]} onPress={handleSave} disabled={isLoading}>
      {isLoading ? <ActivityIndicator color={COLOR_BLACK} size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
    </TouchableOpacity>
  );

  return (
    // The app's one pane (SharedModal): its scrim fading in place, the sheet
    // sliding up, and the grabber floating over the form on a fade, so the
    // form runs to the pane's top edge and scrolls up under it.
    <SharedModal visible={visible} onClose={onClose} hideHeader heightRatio={0.9}>
      {/* Gesture Handler needs its own root inside an RN Modal, or the gallery's
          drag-to-reorder never receives touches. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
            {/* The Save footer floats over the form's bottom edge, so a focused
                field is kept clear of it as well as of the keyboard. On
                Android the button ends the form instead, clear of the
                system's navigation bar. */}
            <FormScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]}
              bottomOffset={KEYBOARD_GAP}
            >
              <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.fg }]}>Edit Post</Text>
              </View>

              {/* Type, then its categories — the new-post form's own pills
                  (PostTypePicker), hydrated with this post's. A legacy
                  listing or want ad shows as picked, offered only to it. */}
              <PostTypePicker
                type={type}
                category={category}
                onChange={(next) => { setType(next.type); setCategory(next.category); }}
                style={styles.typePicker}
              />

              <PostGalleryEditor images={images} onChange={setImages} />

              {/* The words — one field, as the new-post form has: a post's
                  title is what it says. An @ in it tags that member too. */}
              <MentionInput
                value={title}
                onChangeText={(text) => setTitle(text)}
                placeholder="What's on your mind?"
                multiline
                style={styles.mindInput}
                cars={false}
                onMentionUser={(u) => {
                  const tag = userTag(u);
                  setTaggedUsers((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
                }}
              />

              {/* A second field only where there's a description to edit: a
                  poll's, or an older post that was written with one — so its
                  text isn't stranded where it can't be changed. */}
              {(isPoll || hadBody) && (
                <MentionInput
                  value={body}
                  onChangeText={(text) => setBody(text)}
                  placeholder="Description"
                  multiline
                  style={styles.mindInput}
                  cars={false}
                />
              )}

              {/* ── Poll — the same block the create form uses, only on a post
                  that is one. Options with votes keep their ids and can't be
                  removed here. ── */}
              {isPoll && (
                <PollEditor draft={poll} onChange={setPoll} lockedOptionIds={lockedOptionIds} />
              )}

              {/* ── Optional Details, the tags, Location and Post To — the
                  new-post form's own lower half (PostFormSections), hydrated
                  with this post's. Reaches past the form's 16 padding. ── */}
              <PostFormSections
                inset={16}
                optional={optional}
                onOptionalChange={(patch) => setOptional((prev) => ({ ...prev, ...patch }))}
                showOptional={!isPoll}
                showPrice={type === 'listing' || type === 'want'}
                users={taggedUsers}
                cars={taggedCars}
                events={taggedEvents}
                onToggleTag={toggleTag}
                place={place}
                onPlaceChange={setPlace}
                isPublic={isPublic}
                onTogglePublic={() => setIsPublic((v) => !v)}
                groups={userGroups}
                selectedGroupIds={selectedGroupIds}
                onToggleGroup={toggleGroup}
              />

              {/* Ends the form, full width, in the flow rather than pinned. */}
              <View style={styles.inlineSave}>{saveButton}</View>
            </FormScrollView>
            {/* Tagged members neither list above knew: each looked up by id,
                and swapped in with their name and photo once it's back. */}
            {taggedUsers.filter((t) => !t.avatarUser).map((t) => (
              <TaggedUserResolver
                key={t.id}
                id={t.id}
                onResolved={(u) => setTaggedUsers((prev) => prev.map((x) => (x.id === t.id ? userTag(u) : x)))}
              />
            ))}
      </GestureHandlerRootView>
    </SharedModal>
  );
}


const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  scroll:      { flex: 1 },
  // The title, first in the form.
  header:      { marginBottom: 6 },
  headerTitle: { fontSize: 17, fontFamily: FONT_INTER.bold },
  // Clear of the grabber floating over the form's top.
  form:        { padding: 16, paddingTop: PANE_GRABBER_H, gap: 6, paddingBottom: 120 },
  // Room above and below the type and category rows.
  typePicker:  { marginTop: 12, marginBottom: 12 },
  // The photo well's corners, as the new-post form's field.
  mindInput:   { borderRadius: COMMON_RADIUS },

  selectedTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tagChipText:    { fontSize: 12, fontFamily: FONT_INTER.semibold, maxWidth: 140 },
  tagSearchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  tagSearchInput: { flex: 1, fontSize: 14 },
  tagGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10, paddingBottom: 6 },
  tagGroupLabel:  { fontSize: 11, fontFamily: FONT_INTER.bold },
  tagResultRow:   { paddingVertical: 2, gap: 8 },
  tagResultChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: PILL_RADIUS, borderWidth: 1 },
  tagResultText:  { fontSize: 13, fontFamily: FONT_INTER.semibold, maxWidth: 160 },

  postToRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  postToLabel: { flex: 1, fontSize: 15, fontFamily: FONT_INTER.semibold },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  // The create form's Post button: full width, brand-filled, black type.
  saveBtn:     {
    borderRadius: COMMON_RADIUS,
    paddingVertical: 14, paddingHorizontal: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  inlineSave:  { marginTop: 24 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: COLOR_BLACK, fontFamily: FONT_INTER.extrabold, fontSize: 17 },
});

/** Looks one tagged member up by id and hands them back — renders nothing. */
function TaggedUserResolver({ id, onResolved }: { id: string; onResolved: (user: any) => void }) {
  const { data } = useGetUserByIdQuery(id, { skip: !id });
  useEffect(() => {
    if (data) onResolved(data);
    // Once per member: the parent swaps the tag out, which unmounts this.
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
