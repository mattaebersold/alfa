import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { X, Search, Check, User as UserIcon, Car as CarIcon, Flag } from 'lucide-react-native';
import {
  useUpdatePostMutation, useSyncPostTagsMutation, useGetPostTagsQuery,
  useGetUserGroupsQuery, useSearchQuery,
  useGetPreviouslyTaggedUsersQuery, useGetPreviouslyTaggedCarsQuery, useGetPreviouslyTaggedEventsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import type { Post } from '../../types/api';

const TYPES = [
  { key: 'general', label: 'Post' },
  { key: 'record',  label: 'Record' },
  { key: 'spot',    label: 'Spotted' },
  { key: 'listing', label: 'Listing' },
  { key: 'want',    label: 'Want Ad' },
];

const CATEGORIES_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  general: [{ key: 'show', label: 'Show' }, { key: 'misc', label: 'Misc.' }],
  record:  [
    { key: 'general', label: 'General' }, { key: 'mod', label: 'Mod' },
    { key: 'restoration', label: 'Restoration' }, { key: 'maintenance', label: 'Maintenance' },
    { key: 'detailing', label: 'Detailing' },
  ],
  spot:    [{ key: 'show', label: 'Show' }, { key: 'museum', label: 'Museum' }, { key: 'wild', label: 'In the Wild' }],
  listing: [
    { key: 'new', label: 'New Part' }, { key: 'used', label: 'Used Part' },
    { key: 'car', label: 'Car' }, { key: 'accessories', label: 'Accessories' }, { key: 'other', label: 'Other' },
  ],
  want:    [{ key: 'part', label: 'Part' }, { key: 'car', label: 'Car' }, { key: 'other', label: 'Other' }],
};

type TagKind = 'user' | 'car' | 'event';
interface TagItem { id: string; label: string; kind: TagKind }

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

  // Tags
  const [taggedUsers, setTaggedUsers] = useState<TagItem[]>([]);
  const [taggedCars, setTaggedCars] = useState<TagItem[]>([]);
  const [taggedEvents, setTaggedEvents] = useState<TagItem[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Groups
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  const { data: existingTags } = useGetPostTagsQuery(post.internal_id, { skip: !visible });
  const { data: searchData } = useSearchQuery(debouncedSearch, { skip: debouncedSearch.length < 2 });
  const { data: prevUsersData } = useGetPreviouslyTaggedUsersQuery();
  const { data: prevCarsData } = useGetPreviouslyTaggedCarsQuery();
  const { data: prevEventsData } = useGetPreviouslyTaggedEventsQuery();
  const { data: rawGroups } = useGetUserGroupsQuery(userInfo?.user_id ?? '', { skip: !userInfo?.user_id });
  const userGroups: any[] = Array.isArray(rawGroups) ? rawGroups : (rawGroups as any)?.entries ?? [];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(tagSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [tagSearch]);

  // Prefill text/type/category/groups when opened.
  useEffect(() => {
    if (visible) {
      setTitle(post.title ?? '');
      setBody(post.body ?? '');
      setType(post.type ?? 'general');
      setCategory(post.category ?? '');
      const groups = (post as any).group_ids as string[] | undefined;
      setSelectedGroupIds(Array.isArray(groups) ? groups : []);
      setIsPublic(!(Array.isArray(groups) && groups.length > 0));
      setTagSearch('');
    }
  }, [visible, post]);

  // Build id → label lookups from the previously-tagged / search pools.
  const labelLookup = useMemo(() => {
    const users: Record<string, string> = {};
    const cars: Record<string, string> = {};
    const events: Record<string, string> = {};
    const addUser = (u: any) => {
      const id = u.user_id || u.internal_id;
      if (id) users[id] = u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User';
    };
    const addCar = (c: any) => {
      if (c.internal_id) cars[c.internal_id] = [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car';
    };
    const addEvent = (e: any) => { if (e.internal_id) events[e.internal_id] = e.title || 'Event'; };
    (prevUsersData?.users ?? []).forEach(addUser);
    (searchData?.users ?? []).forEach(addUser);
    (prevCarsData?.cars ?? []).forEach(addCar);
    (searchData?.cars ?? []).forEach(addCar);
    (prevEventsData?.events ?? []).forEach(addEvent);
    (searchData?.events ?? []).forEach(addEvent);
    return { users, cars, events };
  }, [prevUsersData, prevCarsData, prevEventsData, searchData]);

  // Prefill selected tags from the post's existing tags (labels resolved best-effort).
  useEffect(() => {
    if (!visible || !existingTags) return;
    const u: TagItem[] = [], c: TagItem[] = [], e: TagItem[] = [];
    existingTags.forEach((t) => {
      const kind = kindFromEntryType(t.tag_entry_type);
      if (!kind) return;
      const id = t.tag_internal_id;
      if (kind === 'user') u.push({ id, kind, label: labelLookup.users[id] ?? 'Tagged user' });
      else if (kind === 'car') c.push({ id, kind, label: labelLookup.cars[id] ?? 'Tagged car' });
      else e.push({ id, kind, label: labelLookup.events[id] ?? 'Tagged event' });
    });
    setTaggedUsers(u); setTaggedCars(c); setTaggedEvents(e);
  }, [visible, existingTags, labelLookup]);

  const categories = CATEGORIES_BY_TYPE[type] ?? [];

  const toggleTag = (tag: TagItem) => {
    const [list, setter] = tag.kind === 'user' ? [taggedUsers, setTaggedUsers]
      : tag.kind === 'car' ? [taggedCars, setTaggedCars]
      : [taggedEvents, setTaggedEvents];
    const exists = (list as TagItem[]).some((t) => t.id === tag.id);
    (setter as any)(exists ? (list as TagItem[]).filter((t) => t.id !== tag.id) : [...(list as TagItem[]), tag]);
  };
  const isTagged = (id: string, kind: TagKind) => {
    const list = kind === 'user' ? taggedUsers : kind === 'car' ? taggedCars : taggedEvents;
    return list.some((t) => t.id === id);
  };

  const toggleGroup = (gid: string) =>
    setSelectedGroupIds((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));

  const searchUsers = (debouncedSearch.length >= 2 ? (searchData?.users ?? []) : (prevUsersData?.users ?? [])) as any[];
  const searchCars = (debouncedSearch.length >= 2 ? (searchData?.cars ?? []) : (prevCarsData?.cars ?? [])) as any[];
  const searchEvents = (debouncedSearch.length >= 2 ? (searchData?.events ?? []) : (prevEventsData?.events ?? [])) as any[];
  const allTags = [...taggedUsers, ...taggedCars, ...taggedEvents];

  const handleSave = async () => {
    const fd = new FormData();
    fd.append('internal_id', post.internal_id);
    fd.append('title', title.trim());
    fd.append('body', body.trim());
    fd.append('type', type);
    if (category) fd.append('category', category);
    fd.append('group_ids', JSON.stringify(selectedGroupIds));
    if (isPublic) fd.append('also_public', 'true');
    try {
      await updatePost(fd).unwrap();
      await syncTags({
        post_id: post.internal_id,
        tagged_users: taggedUsers.map((t) => t.id),
        tagged_cars: taggedCars.map((t) => t.id),
        tagged_events: taggedEvents.map((t) => t.id),
      }).unwrap().catch(() => {});
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
          <View style={[styles.sheet, { backgroundColor: colors.cream }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.headerTitle, { color: colors.fg }]}>Edit Post</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={22} color={colors.grey} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={[styles.label, { color: colors.grey }]}>Title</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.fg, backgroundColor: colors.card }]}
                value={title} onChangeText={setTitle} placeholder="Add a title..." placeholderTextColor={colors.grey}
              />

              <Text style={[styles.label, { color: colors.grey }]}>Body</Text>
              <TextInput
                style={[styles.input, styles.bodyInput, { borderColor: colors.border, color: colors.fg, backgroundColor: colors.card }]}
                value={body} onChangeText={setBody} placeholder="What's on your mind?" placeholderTextColor={colors.grey} multiline
              />

              <Text style={[styles.label, { color: colors.grey }]}>Type</Text>
              <View style={styles.pills}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.card },
                      type === t.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }]}
                    onPress={() => { setType(t.key); setCategory(''); }}
                  >
                    <Text style={[styles.pillText, { color: colors.grey }, type === t.key && { color: '#FFF' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {categories.length > 0 && (
                <>
                  <Text style={[styles.label, { color: colors.grey }]}>Category</Text>
                  <View style={styles.pills}>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.pill, { borderColor: colors.border, backgroundColor: colors.card },
                          category === c.key && { backgroundColor: colors.primaryAlt, borderColor: colors.primaryAlt }]}
                        onPress={() => setCategory(c.key)}
                      >
                        <Text style={[styles.pillText, { color: colors.grey }, category === c.key && { color: '#FFF' }]}>{c.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* ── Tags ── */}
              <Text style={[styles.label, { color: colors.grey }]}>Tag People, Cars & Events</Text>
              {allTags.length > 0 && (
                <View style={styles.selectedTags}>
                  {allTags.map((tag) => {
                    const kc = tag.kind === 'user' ? colors.primaryAlt : tag.kind === 'car' ? colors.teal : colors.tangerine;
                    return (
                      <View key={`${tag.kind}-${tag.id}`} style={[styles.tagChip, { backgroundColor: kc + '22', borderColor: kc + '55' }]}>
                        <Text style={[styles.tagChipText, { color: kc }]} numberOfLines={1}>{tag.label}</Text>
                        <TouchableOpacity onPress={() => toggleTag(tag)} hitSlop={6}><X size={12} color={kc} /></TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={[styles.tagSearchRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.tagSearchInput, { color: colors.fg }]}
                  value={tagSearch} onChangeText={setTagSearch}
                  placeholder="Search people, cars, events…" placeholderTextColor={colors.grey}
                  autoCorrect={false}
                />
                {tagSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setTagSearch('')} hitSlop={6}><X size={14} color={colors.grey} /></TouchableOpacity>
                )}
              </View>

              {searchUsers.length > 0 && (
                <TagResults
                  Icon={UserIcon} label={debouncedSearch.length >= 2 ? 'People' : 'Recently Tagged People'}
                  items={searchUsers.slice(0, 10).map((u) => ({ id: u.user_id || u.internal_id, label: u.username ? `@${u.username}` : [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username, kind: 'user' as TagKind }))}
                  activeColor={colors.primaryAlt} colors={colors} isTagged={isTagged} onToggle={toggleTag}
                />
              )}
              {searchCars.length > 0 && (
                <TagResults
                  Icon={CarIcon} label={debouncedSearch.length >= 2 ? 'Cars' : 'Recently Tagged Cars'}
                  items={searchCars.slice(0, 10).map((c) => ({ id: c.internal_id, label: [c.year, c.make, c.model].filter(Boolean).join(' ') || c.title || 'Car', kind: 'car' as TagKind }))}
                  activeColor={colors.teal} colors={colors} isTagged={isTagged} onToggle={toggleTag}
                />
              )}
              {searchEvents.length > 0 && (
                <TagResults
                  Icon={Flag} label={debouncedSearch.length >= 2 ? 'Events' : 'Recently Tagged Events'}
                  items={searchEvents.slice(0, 10).map((e) => ({ id: e.internal_id, label: e.title || 'Event', kind: 'event' as TagKind }))}
                  activeColor={colors.tangerine} colors={colors} isTagged={isTagged} onToggle={toggleTag}
                />
              )}

              {/* ── Post To ── */}
              <Text style={[styles.label, { color: colors.grey }]}>Post To</Text>
              <TouchableOpacity style={styles.postToRow} onPress={() => setIsPublic((v) => !v)} activeOpacity={0.7}>
                <View style={[styles.checkbox, { borderColor: colors.primaryAlt }, isPublic && { backgroundColor: colors.primaryAlt }]}>
                  {isPublic && <Check size={11} color="#FFF" />}
                </View>
                <Text style={[styles.postToLabel, { color: colors.fg }]}>Post publicly</Text>
              </TouchableOpacity>
              {userGroups.map((group) => {
                const gid = group.internal_id;
                const active = selectedGroupIds.includes(gid);
                return (
                  <TouchableOpacity key={gid} style={styles.postToRow} onPress={() => toggleGroup(gid)} activeOpacity={0.7}>
                    <View style={[styles.checkbox, { borderColor: colors.primaryAlt }, active && { backgroundColor: colors.primaryAlt }]}>
                      {active && <Check size={11} color="#FFF" />}
                    </View>
                    <Text style={[styles.postToLabel, { color: colors.fg }]} numberOfLines={1}>{group.title ?? 'Group'}</Text>
                  </TouchableOpacity>
                );
              })}
              {userGroups.length === 0 && (
                <Text style={[styles.postToEmpty, { color: colors.grey }]}>You're not a member of any groups.</Text>
              )}

              <TouchableOpacity style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]} onPress={handleSave} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function TagResults({
  Icon, label, items, activeColor, colors, isTagged, onToggle,
}: {
  Icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  items: TagItem[];
  activeColor: string;
  colors: ReturnType<typeof useColors>;
  isTagged: (id: string, kind: TagKind) => boolean;
  onToggle: (tag: TagItem) => void;
}) {
  return (
    <View>
      <View style={styles.tagGroupHeader}>
        <Icon size={12} color={colors.grey} />
        <Text style={[styles.tagGroupLabel, { color: colors.grey }]}>{label}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagResultRow}>
        {items.map((item) => {
          const tagged = isTagged(item.id, item.kind);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.tagResultChip, { borderColor: tagged ? activeColor : colors.border }, tagged && { backgroundColor: activeColor }]}
              onPress={() => onToggle(item)}
            >
              {tagged && <Check size={11} color="#FFF" />}
              <Text style={[styles.tagResultText, { color: tagged ? '#FFF' : colors.fg }]} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(100,100,100,0.55)' },
  backdrop:    { ...StyleSheet.absoluteFillObject },
  sheetWrap:   { maxHeight: '90%' },
  sheet:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  form:        { padding: 16, gap: 6, paddingBottom: 32 },
  label:       { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  bodyInput:   { minHeight: 100, textAlignVertical: 'top' },
  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  pillText:    { fontSize: 13, fontWeight: '600' },

  selectedTags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tagChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  tagChipText:    { fontSize: 12, fontWeight: '600', maxWidth: 140 },
  tagSearchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1, marginTop: 8 },
  tagSearchInput: { flex: 1, fontSize: 14 },
  tagGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10, paddingBottom: 6 },
  tagGroupLabel:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  tagResultRow:   { paddingVertical: 2, gap: 8 },
  tagResultChip:  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  tagResultText:  { fontSize: 13, fontWeight: '600', maxWidth: 160 },

  postToRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  postToLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  postToEmpty: { paddingVertical: 8, fontSize: 13 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },

  saveBtn:     { backgroundColor: colors.primaryAlt, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
